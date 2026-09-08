import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import {
  compactBody,
  encodePathSegment,
  paginationQuery,
  paginationSchema,
  registerJsonTool,
} from "./_shared.js";

export function registerMemberTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-members",
    {
      description: "List team members (GET /api/public/members). Scope: members:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/members",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "get-member",
    {
      description: "Fetch a team member (GET /api/public/members/{id}). Scope: members:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Member user id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/members/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "invite-member",
    {
      description: "Invite a member by email (POST /api/public/members). Scope: members:write.",
      inputSchema: z.object({
        email: z.string().email().describe("Invitee email."),
        role: z.string().min(1).describe("Team role name."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/members",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "change-member-role",
    {
      description: "Change a member role (PATCH /api/public/members/{id}/role). Scope: members:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Member user id."),
        role: z.string().min(1).describe("New team role name."),
      }),
    },
    async (input) =>
      client.request({
        method: "PATCH",
        path: `/api/public/members/${encodePathSegment(input.id)}/role`,
        body: { role: input.role },
      }),
  );
}

export function registerSettingsTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "get-settings",
    {
      description:
        "Fetch non-secret team settings (GET /api/public/settings). Scope: settings:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({}),
    },
    async () => client.request({ path: "/api/public/settings" }),
  );

  registerJsonTool(
    server,
    "get-integrations",
    {
      description:
        "List connected integrations without secrets (GET /api/public/integrations). Scope: integrations:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({}),
    },
    async () => client.request({ path: "/api/public/integrations" }),
  );
}
