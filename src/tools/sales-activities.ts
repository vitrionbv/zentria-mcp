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
      description:
        "List sales activities (GET /api/public/sales/activities). Optional dealId, personId, assigneeUserId and status filters. Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...paginationSchema,
        dealId: z.number().int().positive().optional().describe("Only activities on this deal."),
        personId: z.number().int().positive().optional().describe("Only activities for this person."),
        assigneeUserId: z.number().int().positive().optional().describe("Only activities of this assignee."),
        status: z.enum(["open", "done", "cancelled"]).optional(),
      }),
    },
    async (input) => {
      const { dealId, personId, assigneeUserId, status, ...pagination } = input;

      return client.request({
        path: "/api/public/sales/activities",
        query: {
          ...paginationQuery(pagination),
          ...(dealId !== undefined ? { dealId } : {}),
          ...(personId !== undefined ? { personId } : {}),
          ...(assigneeUserId !== undefined ? { assigneeUserId } : {}),
          ...(status !== undefined ? { status } : {}),
        },
      });
    },
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
