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

export function registerCustomerTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-customers",
    {
      description: "List customers (GET /api/public/customers). Scope: customers:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/customers",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-customer",
    {
      description: "Create a customer (POST /api/public/customers). Scope: customers:write.",
      inputSchema: z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/customers",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-customer",
    {
      description: "Fetch a customer (GET /api/public/customers/{id}). Scope: customers:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Customer id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/customers/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-customer",
    {
      description: "Update a customer (PUT /api/public/customers/{id}). Scope: customers:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Customer id."),
        name: z.string().optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PUT",
        path: `/api/public/customers/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );

  registerJsonTool(
    server,
    "archive-customer",
    {
      description: "Archive a customer (PATCH /api/public/customers/{id}/archive). Scope: customers:write.",
      annotations: { destructiveHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Customer id."),
      }),
    },
    async (input) =>
      client.request({
        method: "PATCH",
        path: `/api/public/customers/${encodePathSegment(input.id)}/archive`,
        body: {},
      }),
  );
}
