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

export function registerWebhookTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-webhooks",
    {
      description: "List outbound webhook endpoints (GET /api/public/webhooks). Scope: webhooks:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/webhooks",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-webhook",
    {
      description:
        "Create a webhook endpoint. Signing secret returned once (POST /api/public/webhooks). Scope: webhooks:write.",
      inputSchema: z.object({
        url: z.string().url().describe("HTTPS callback URL."),
        events: z.array(z.string()).min(1).describe("Event names, e.g. sales.deal.updated."),
        description: z.string().optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
        source: z.string().optional().describe("Source label (default api)."),
        isActive: z.boolean().optional(),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/webhooks",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-webhook",
    {
      description: "Fetch a webhook endpoint (GET /api/public/webhooks/{id}). Scope: webhooks:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Webhook id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/webhooks/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-webhook",
    {
      description: "Update a webhook endpoint (PATCH /api/public/webhooks/{id}). Scope: webhooks:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Webhook id."),
        url: z.string().url().optional(),
        events: z.array(z.string()).optional(),
        description: z.string().nullable().optional(),
        filters: z.record(z.string(), z.unknown()).nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PATCH",
        path: `/api/public/webhooks/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );

  registerJsonTool(
    server,
    "delete-webhook",
    {
      description: "Delete a webhook endpoint (DELETE /api/public/webhooks/{id}). Scope: webhooks:write.",
      annotations: { destructiveHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Webhook id."),
      }),
    },
    async (input) =>
      client.request({
        method: "DELETE",
        path: `/api/public/webhooks/${encodePathSegment(input.id)}`,
      }),
  );
}
