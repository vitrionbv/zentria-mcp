import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZentriaClient, normalizeBaseUrl } from "./client.js";
import { ZentriaUnauthorizedError } from "./errors.js";
import { collectionItems } from "./query.js";

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes and /api/public suffix", () => {
    expect(normalizeBaseUrl("https://app.zentria.nl/")).toBe("https://app.zentria.nl");
    expect(normalizeBaseUrl("https://app.zentria.nl/api/public")).toBe("https://app.zentria.nl");
  });
});

describe("collectionItems", () => {
  it("unwraps hydra collections", () => {
    expect(collectionItems({ member: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    expect(collectionItems({ "hydra:member": [{ id: 2 }] })).toEqual([{ id: 2 }]);
  });
});

describe("ZentriaClient", () => {
  beforeEach(() => {
    process.env.ZENTRIA_API_KEY = "pat-test";
    process.env.ZENTRIA_BASE_URL = "https://app.zentria.nl";
  });

  afterEach(() => {
    delete process.env.ZENTRIA_API_KEY;
    delete process.env.ZENTRIA_BASE_URL;
    vi.restoreAllMocks();
  });

  it("requires an API key", () => {
    delete process.env.ZENTRIA_API_KEY;
    expect(() => new ZentriaClient()).toThrow("ZENTRIA_API_KEY");
  });

  it("sends Authorization Bearer and parses JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 1, name: "Demo" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new ZentriaClient({ fetchImpl });
    const result = await client.request({ path: "/api/public/me" });

    expect(result).toEqual({ id: 1, name: "Demo" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer pat-test",
      Accept: "application/json",
    });
  });

  it("maps 401 to ZentriaUnauthorizedError", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ message: "Invalid token" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new ZentriaClient({ fetchImpl });
    await expect(client.request({ path: "/api/public/me" })).rejects.toBeInstanceOf(
      ZentriaUnauthorizedError,
    );
  });

  it("caches getMe and getBoundTeamId", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ currentTeam: { id: 42, name: "Sales" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new ZentriaClient({ fetchImpl });
    expect(await client.getBoundTeamId()).toBe(42);
    expect(await client.getBoundTeamId()).toBe(42);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
