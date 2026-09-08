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

export function registerSalesNoteTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-notes",
    {
      description: "List sales notes (GET /api/public/sales/notes). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/sales/notes",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-note",
    {
      description: "Create a sales note (POST /api/public/sales/notes). Scope: sales:write.",
      inputSchema: z.object({
        body: z.string().min(1).describe("Note body."),
        dealId: z.number().int().positive().optional(),
        personId: z.number().int().positive().optional(),
        organizationId: z.number().int().positive().optional(),
        pinned: z.boolean().optional(),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/sales/notes",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-note",
    {
      description: "Fetch a sales note (GET /api/public/sales/notes/{id}). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Note id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/sales/notes/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-note",
    {
      description: "Update a sales note (PATCH /api/public/sales/notes/{id}). Scope: sales:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Note id."),
        body: z.string().optional(),
        pinned: z.boolean().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;
      return client.request({
        method: "PATCH",
        path: `/api/public/sales/notes/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );

  registerJsonTool(
    server,
    "delete-note",
    {
      description: "Delete a sales note (DELETE /api/public/sales/notes/{id}). Scope: sales:write.",
      annotations: { destructiveHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Note id."),
      }),
    },
    async (input) =>
      client.request({
        method: "DELETE",
        path: `/api/public/sales/notes/${encodePathSegment(input.id)}`,
      }),
  );
}
