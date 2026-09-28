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

export function registerCustomerContactTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-customer-contacts",
    {
      description:
        "List contacts for a customer (GET /api/public/customers/{customerId}/contacts). Scope: customers:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        customerId: z.number().int().positive().describe("Customer id."),
        ...paginationSchema,
      }),
    },
    async (input) => {
      const { customerId, ...pagination } = input;

      return client.request({
        path: `/api/public/customers/${encodePathSegment(customerId)}/contacts`,
        query: paginationQuery(pagination),
      });
    },
  );

  registerJsonTool(
    server,
    "create-customer-contact",
    {
      description:
        "Create a contact on a customer (POST /api/public/customers/{customerId}/contacts). Scope: customers:write.",
      inputSchema: z.object({
        customerId: z.number().int().positive().describe("Customer id."),
        name: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        isPrimary: z.boolean().optional(),
      }),
    },
    async (input) => {
      const { customerId, ...body } = input;

      return client.request({
        method: "POST",
        path: `/api/public/customers/${encodePathSegment(customerId)}/contacts`,
        body: compactBody(body) ?? {},
      });
    },
  );

  registerJsonTool(
    server,
    "get-contact",
    {
      description: "Fetch a customer contact (GET /api/public/contacts/{id}). Scope: customers:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Contact id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/contacts/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-contact",
    {
      description: "Update a customer contact (PUT /api/public/contacts/{id}). Scope: customers:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Contact id."),
        name: z.string().optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        isPrimary: z.boolean().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PUT",
        path: `/api/public/contacts/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );
}
