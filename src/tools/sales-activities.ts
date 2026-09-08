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

export function registerSalesActivityTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-activities",
    {
      description: "List sales activities (GET /api/public/sales/activities). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/sales/activities",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-activity",
    {
      description: "Create a sales activity (POST /api/public/sales/activities). Scope: sales:write.",
      inputSchema: z.object({
        type: z.string().min(1).describe("Activity type (call, meeting, task, etc.)."),
        title: z.string().min(1).describe("Activity title."),
        dealId: z.number().int().positive().optional(),
        personId: z.number().int().positive().optional(),
        dueAt: z.string().optional().describe("ISO datetime."),
        assigneeUserId: z.number().int().positive().optional(),
        body: z.string().optional(),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/sales/activities",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-activity",
    {
      description: "Fetch a sales activity (GET /api/public/sales/activities/{id}). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Activity id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/sales/activities/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-activity",
    {
      description:
        "Update or complete/cancel a sales activity (PATCH /api/public/sales/activities/{id}). Set status to done or cancelled. Scope: sales:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Activity id."),
        title: z.string().optional(),
        dueAt: z.string().nullable().optional(),
        assigneeUserId: z.number().int().positive().nullable().optional(),
        body: z.string().nullable().optional(),
        status: z.enum(["open", "done", "cancelled"]).optional(),
        cancelledReason: z.string().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;
      return client.request({
        method: "PATCH",
        path: `/api/public/sales/activities/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );
}
