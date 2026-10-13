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

  registerJsonTool(
    server,
    "list-crm-calls",
    {
      description:
        "List Voys phone calls of the team, newest first (GET /api/public/crm/calls). Each call has direction, answered, outcome, duration, numbers, AI summary and the linked lead id. Use get-crm-call for the transcript. Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...paginationSchema,
        q: z.string().optional().describe("Search by caller name or phone number."),
        receivedAfter: z
          .string()
          .optional()
          .describe("ISO-8601 datetime. Only calls that started at or after this instant."),
        receivedBefore: z
          .string()
          .optional()
          .describe("ISO-8601 datetime. Only calls that started at or before this instant."),
        customerId: z.number().int().positive().optional().describe("Only calls for this customer."),
        campaignId: z.number().int().positive().optional().describe("Only calls for this campaign."),
        leadId: z.number().int().positive().optional().describe("Only calls linked to this CRM lead."),
        outcome: z
          .enum(["live_conversation", "voicemail", "busy", "unavailable", "machine", "missed"])
          .optional()
          .describe("Call outcome. missed means nobody answered."),
        direction: z.enum(["incoming", "outgoing"]).optional().describe("Call direction."),
        answered: z.boolean().optional().describe("true for answered calls, false for unanswered calls."),
        phone: z.string().optional().describe("Partial phone number of the caller or the number called."),
      }),
    },
    async (input) =>
      client.request({
        path: "/api/public/crm/calls",
        query: {
          ...paginationQuery(input),
          "receivedAt[after]": input.receivedAfter,
          "receivedAt[before]": input.receivedBefore,
          customerId: input.customerId,
          campaignId: input.campaignId,
          leadId: input.leadId,
          outcome: input.outcome,
          direction: input.direction,
          answered: input.answered,
          phone: input.phone,
        },
      }),
  );

  registerJsonTool(
    server,
    "get-crm-call",
    {
      description:
        "Fetch one Voys phone call with its transcript, AI summary and linked CRM lead (GET /api/public/crm/calls/{id}). Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Call id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/crm/calls/${encodePathSegment(input.id)}` }),
  );
}
