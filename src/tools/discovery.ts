import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { encodePathSegment, paginationQuery, paginationSchema, registerJsonTool } from "./_shared.js";

export function registerDiscoveryTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "get-me",
    {
      description:
        "Return the signed-in user, PAT-bound team, enabled modules, and token scopes (GET /api/public/me). Call this first to learn team id and available modules.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({}),
    },
    async () => client.getMe(true),
  );

  registerJsonTool(
    server,
    "list-teams",
    {
      description: "List teams visible to this PAT (GET /api/public/teams). A team-bound PAT returns exactly one team.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/teams",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "get-team",
    {
      description: "Fetch a team by id (GET /api/public/teams/{id}).",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Team id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/teams/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "list-tenants",
    {
      description: "List tenants for this PAT (GET /api/public/tenants).",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/tenants",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "get-tenant",
    {
      description: "Fetch a tenant by id (GET /api/public/tenants/{id}).",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Tenant id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/tenants/${encodePathSegment(input.id)}` }),
  );
}
