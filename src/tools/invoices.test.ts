import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../create-server.js";
import { registerInvoiceTools } from "./invoices.js";

type Call = { method?: string; path: string; query?: Record<string, unknown>; body?: unknown };
type ToolOptions = { annotations?: { readOnlyHint?: boolean } };

function invoiceTools() {
  const calls: Call[] = [];
  const handlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>();
  const options = new Map<string, ToolOptions>();
  const server = {
    registerTool: (name: string, toolOptions: ToolOptions, fn: (input: Record<string, unknown>) => Promise<unknown>) => {
      handlers.set(name, fn);
      options.set(name, toolOptions);
    },
  };
  const client = {
    request: async (request: Call) => {
      calls.push(request);
      return { id: 42, url: "https://app.zentria.test/invoice-pdf/42?signature=abc", expiresAt: "2026-11-04T12:15:00+00:00" };
    },
  };
  registerInvoiceTools(server as never, client as never);

  return { calls, options, run: (name: string, input: Record<string, unknown>) => handlers.get(name)!(input) };
}

describe("get-invoice-pdf-link", () => {
  beforeEach(() => {
    process.env.ZENTRIA_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.ZENTRIA_API_KEY;
  });

  it("asks a signed PDF link with a POST and is marked read only", async () => {
    const { calls, options, run } = invoiceTools();
    const result = (await run("get-invoice-pdf-link", { id: 42 })) as { content: Array<{ text: string }> };

    expect(calls[0]).toMatchObject({ method: "POST", path: "/api/public/invoices/42/pdf-link" });
    expect(options.get("get-invoice-pdf-link")?.annotations?.readOnlyHint).toBe(true);
    expect(result.content[0].text).toContain("invoice-pdf/42");
  });

  it("is listed for a token with invoices:read", () => {
    const server = createServer({ scopes: ["invoices:read"] }) as unknown as { _registeredTools: Record<string, unknown> };

    expect(Object.keys(server._registeredTools)).toContain("get-invoice-pdf-link");
  });
});
