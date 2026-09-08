import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import {
  encodePathSegment,
  paginationQuery,
  paginationSchema,
  registerJsonTool,
} from "./_shared.js";

export function registerCrmTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-crm-leads",
    {
      description: "List CRM leads (GET /api/public/crm/leads). Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/crm/leads",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "get-crm-lead",
    {
      description: "Fetch a CRM lead (GET /api/public/crm/leads/{id}). Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("CRM lead id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/crm/leads/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "approve-crm-lead",
    {
      description: "Approve a CRM lead (POST /api/public/crm/leads/{id}/approve). Scope: crm:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("CRM lead id."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `/api/public/crm/leads/${encodePathSegment(input.id)}/approve`,
        body: {},
      }),
  );

  registerJsonTool(
    server,
    "reject-crm-lead",
    {
      description: "Reject a CRM lead (POST /api/public/crm/leads/{id}/reject). Scope: crm:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("CRM lead id."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `/api/public/crm/leads/${encodePathSegment(input.id)}/reject`,
        body: {},
      }),
  );

  registerJsonTool(
    server,
    "list-crm-submissions",
    {
      description: "List CRM lead submissions (GET /api/public/crm/submissions). Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/crm/submissions",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "get-crm-submission",
    {
      description:
        "Fetch a CRM lead submission (GET /api/public/crm/submissions/{id}). Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Submission id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/crm/submissions/${encodePathSegment(input.id)}` }),
  );
}
