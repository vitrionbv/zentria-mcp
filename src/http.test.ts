import { describe, expect, it, vi } from "vitest";
import { createHttpHandler, httpOptionsFromEnv } from "./http.js";

const RESOURCE_URL = "https://app.zentria.nl/mcp";

const ME = {
  id: 7,
  name: "Dana",
  email: "dana@example.com",
  currentTeam: { id: 3, name: "Alpha" },
  scopes: ["todos:read"],
};

function fakeZentria(validToken = "good-token") {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);

    if (headers.get("Authorization") !== `Bearer ${validToken}`) {
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    }

    if (String(input).endsWith("/api/public/me")) {
      return Response.json(ME);
    }

    return Response.json({ data: [] });
  });
}

function mcpRequest(body: unknown, token?: string): Request {
  return new Request(RESOURCE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function jsonRpcResult(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const payload = text.startsWith("{")
    ? text
    : (text
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length) ?? "{}");

  return JSON.parse(payload) as Record<string, unknown>;
}

describe("createHttpHandler", () => {
  it("answers health checks without a token", async () => {
    const handle = createHttpHandler({ baseUrl: "https://app.zentria.nl", resourceUrl: RESOURCE_URL, fetchImpl: fakeZentria() });

    const response = await handle(new Request("https://app.zentria.nl/healthz"));

    expect(response.status).toBe(200);
  });

  it("challenges requests without a token with the protected resource metadata", async () => {
    const handle = createHttpHandler({ baseUrl: "https://app.zentria.nl", resourceUrl: RESOURCE_URL, fetchImpl: fakeZentria() });

    const response = await handle(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain(
      'resource_metadata="https://app.zentria.nl/.well-known/oauth-protected-resource/mcp"',
    );
  });

  it("challenges tokens Zentria does not accept", async () => {
    const handle = createHttpHandler({ baseUrl: "https://app.zentria.nl", resourceUrl: RESOURCE_URL, fetchImpl: fakeZentria() });

    const response = await handle(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "revoked"));

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("invalid_token");
  });

  it("serves tools for a valid token and verifies it once per cache window", async () => {
    const fetchImpl = fakeZentria();
    const handle = createHttpHandler({ baseUrl: "https://app.zentria.nl", resourceUrl: RESOURCE_URL, fetchImpl });

    const first = await handle(mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "good-token"));
    expect(first.status).toBe(200);

    const result = (await jsonRpcResult(first)).result as { tools: Array<{ name: string }> };
    expect(result.tools.map((tool) => tool.name)).toContain("get-me");

    const second = await handle(
      mcpRequest(
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list-todos", arguments: {} } },
        "good-token",
      ),
    );
    expect(second.status).toBe(200);
    expect((await jsonRpcResult(second)).error).toBeUndefined();

    const meCalls = fetchImpl.mock.calls.filter(([url]) => String(url).endsWith("/api/public/me"));
    expect(meCalls).toHaveLength(1);

    const todoCall = fetchImpl.mock.calls.find(([url]) => String(url).includes("/api/public/teams/3/todos"));
    expect(new Headers(todoCall?.[1]?.headers).get("Authorization")).toBe("Bearer good-token");
  });

  it("only serves the MCP path", async () => {
    const handle = createHttpHandler({ baseUrl: "https://app.zentria.nl", resourceUrl: RESOURCE_URL, fetchImpl: fakeZentria() });

    const response = await handle(new Request("https://app.zentria.nl/other", { method: "POST" }));

    expect(response.status).toBe(404);
  });
});

describe("httpOptionsFromEnv", () => {
  it("derives the resource URL from the base URL", () => {
    expect(httpOptionsFromEnv({ ZENTRIA_BASE_URL: "https://app.zentria.nl/" })).toEqual({
      baseUrl: "https://app.zentria.nl",
      resourceUrl: "https://app.zentria.nl/mcp",
      port: 3333,
      host: "127.0.0.1",
    });
  });
});
