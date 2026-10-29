import { describe, expect, it } from "vitest";
import { registerStatusTools } from "./status.js";

type Call = { method?: string; path: string; query?: Record<string, unknown>; body?: unknown };

function statusTools() {
  const calls: Call[] = [];
  const handlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>();
  const server = {
    registerTool: (name: string, _options: unknown, fn: (input: Record<string, unknown>) => Promise<unknown>) => {
      handlers.set(name, fn);
    },
  };
  const client = {
    request: async (options: Call) => {
      calls.push(options);
      return { ok: true };
    },
  };
  registerStatusTools(server as never, client as never);

  return { calls, run: (name: string, input: Record<string, unknown>) => handlers.get(name)!(input) };
}

describe("status tools", () => {
  it("asks the campaign status with the period as query", async () => {
    const { calls, run } = statusTools();
    await run("get-campaign-status", { id: 12, period: "last_90" });
    expect(calls[0]).toEqual({ method: "GET", path: "/api/public/campaigns/12/status", query: { period: "last_90" }, body: undefined });
  });

  it("starts a grid run with a POST to the location", async () => {
    const { calls, run } = statusTools();
    await run("start-business-profile-grid-run", { locationId: 5 });
    expect(calls[0]).toMatchObject({ method: "POST", path: "/api/public/business-profiles/locations/5/grid/run" });
  });

  it("sends the cheap mode of a grid run in the body", async () => {
    const { calls, run } = statusTools();
    await run("start-business-profile-grid-run", { locationId: 5, mode: "standard" });
    expect(calls[0]).toMatchObject({ method: "POST", path: "/api/public/business-profiles/locations/5/grid/run", body: { mode: "standard" } });
  });

  it("filters grid runs on campaign and keyword", async () => {
    const { calls, run } = statusTools();
    await run("list-business-profile-grid-runs", { campaignId: 3, keyword: "dakdekker", page: 2 });
    expect(calls[0]?.query).toEqual({ campaignId: 3, keyword: "dakdekker", page: 2 });
  });
});
