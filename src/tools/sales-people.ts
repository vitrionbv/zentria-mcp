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

export function registerSalesPeopleTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-people",
    {
      description: "List sales people/contacts (GET /api/public/sales/people). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/sales/people",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-person",
    {
      description: "Create a sales person (POST /api/public/sales/people). Scope: sales:write.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Person name."),
        email: z.string().email().optional().describe("Email address."),
        phone: z.string().optional().describe("Phone number."),
        organizationId: z.number().int().positive().optional().describe("Linked organization id."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/sales/people",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-person",
    {
      description: "Fetch a sales person (GET /api/public/sales/people/{id}). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Person id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/sales/people/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-person",
    {
      description: "Update a sales person (PUT /api/public/sales/people/{id}). Scope: sales:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Person id."),
        name: z.string().optional().describe("Person name."),
        email: z.string().email().optional().describe("Email address."),
        phone: z.string().optional().describe("Phone number."),
        organizationId: z.number().int().positive().nullable().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PUT",
        path: `/api/public/sales/people/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );
}
