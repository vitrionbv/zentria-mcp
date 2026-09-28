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

export function registerSalesOrganizationTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-organizations",
    {
      description: "List sales organizations (GET /api/public/sales/organizations). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/sales/organizations",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-organization",
    {
      description: "Create a sales organization (POST /api/public/sales/organizations). Scope: sales:write.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Organization name."),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/sales/organizations",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-organization",
    {
      description:
        "Fetch a sales organization (GET /api/public/sales/organizations/{id}). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Organization id."),
      }),
    },
    async (input) =>
      client.request({
        path: `/api/public/sales/organizations/${encodePathSegment(input.id)}`,
      }),
  );

  registerJsonTool(
    server,
    "update-organization",
    {
      description:
        "Update a sales organization (PUT /api/public/sales/organizations/{id}). Scope: sales:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Organization id."),
        name: z.string().optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PUT",
        path: `/api/public/sales/organizations/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );
}
