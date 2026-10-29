import { describe, expect, it } from "vitest";
import * as z from "zod/v4";
import { registerApiTool } from "./_shared.js";

type Call = { method?: string; path: string; query?: Record<string, unknown>; body?: unknown };

function setup(spec: Parameters<typeof registerApiTool>[2]) {
  const calls: Call[] = [];
  let handler: ((input: Record<string, unknown>) => Promise<unknown>) | undefined;
  const server = {
    registerTool: (_name: string, _options: unknown, fn: (input: Record<string, unknown>) => Promise<unknown>) => {
      handler = fn;
    },
  };
  const client = {
    request: async (options: Call) => {
      calls.push(options);
      return { ok: true };
    },
  };
  registerApiTool(server as never, client, spec);

  return { calls, run: (input: Record<string, unknown>) => handler!(input) };
}

describe("registerApiTool", () => {
  it("fills path placeholders and sends the rest as body for writes", async () => {
    const { calls, run } = setup({
      name: "update-thing",
      description: "x",
      method: "PUT",
      path: "/api/public/things/{id}",
      input: { id: z.number(), name: z.string().optional(), note: z.string().optional() },
      rename: { note: "internalNote" },
    });
    await run({ id: 7, name: "A", note: "n" });
    expect(calls[0]).toEqual({
      method: "PUT",
      path: "/api/public/things/7",
      query: undefined,
      body: { name: "A", internalNote: "n" },
    });
  });

  it("sends everything except path keys as query for GET and skips undefined", async () => {
    const { calls, run } = setup({
      name: "list-things",
      description: "x",
      path: "/api/public/things",
      input: { page: z.number().optional(), after: z.string().optional() },
      rename: { after: "createdAt[after]" },
    });
    await run({ page: 2, after: undefined });
    expect(calls[0]).toEqual({ method: "GET", path: "/api/public/things", query: { page: 2 }, body: undefined });
  });

  it("honours an explicit query list on write methods", async () => {
    const { calls, run } = setup({
      name: "post-thing",
      description: "x",
      method: "POST",
      path: "/api/public/things/{id}/go",
      input: { id: z.number(), dryRun: z.boolean().optional(), reason: z.string() },
      query: ["dryRun"],
    });
    await run({ id: 1, dryRun: true, reason: "r" });
    expect(calls[0]).toEqual({
      method: "POST",
      path: "/api/public/things/1/go",
      query: { dryRun: true },
      body: { reason: "r" },
    });
  });

  it("sends mapped input keys as headers, not in the body", async () => {
    const { calls, run } = setup({
      name: "send-thing",
      description: "x",
      method: "POST",
      path: "/api/public/things",
      input: { idempotencyKey: z.string().optional(), subject: z.string() },
      headers: { idempotencyKey: "Idempotency-Key" },
    });
    await run({ idempotencyKey: "abc-1", subject: "Hi" });
    await run({ subject: "Again" });
    expect(calls[0]).toEqual({
      method: "POST",
      path: "/api/public/things",
      query: undefined,
      body: { subject: "Hi" },
      headers: { "Idempotency-Key": "abc-1" },
    });
    expect(calls[1]).not.toHaveProperty("headers");
  });
});
