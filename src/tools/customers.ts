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
      description:
        "List customers (GET /api/public/customers). Archived customers are left out unless status is archived or all; archivedAt is set on archived ones. Scope: customers:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...paginationSchema,
        status: z
          .enum(["active", "archived", "all"])
          .optional()
          .describe("active (default), archived or all."),
      }),
    },
    async (input) => {
      const { status, ...page } = input;

      return client.request({
        path: "/api/public/customers",
        query: { ...paginationQuery(page), ...(status ? { status } : {}) },
      });
    },
  );

  registerJsonTool(
    server,
    "create-customer",
    {
      description:
        "Create a customer with the same fields as the customer form (POST /api/public/customers). Scope: customers:write.",
      inputSchema: z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        billingLine1: z.string().nullable().optional().describe("Street and house number."),
        billingCity: z.string().nullable().optional(),
        billingPostalCode: z.string().nullable().optional(),
        billingCountry: z.string().length(2).nullable().optional().describe("2-letter country code, for example NL."),
        billingKvkNumber: z.string().nullable().optional().describe("KvK number. A business with invoicing on needs a KvK or VAT number."),
        billingVatNumber: z.string().nullable().optional(),
        billingRecipientType: z.enum(["business", "consumer"]).optional(),
        billingLocale: z.string().optional().describe("Invoice language, for example nl_NL."),
        invoicingEnabled: z.boolean().optional().describe("Whether the customer gets weekly invoices."),
        weeklyDigestEnabled: z.boolean().optional().describe("Whether the customer gets the weekly lead mail."),
        labels: z.array(z.string()).optional().describe("Customer labels. Replaces the current labels."),
        dedupePeerIds: z.array(z.number().int().positive()).optional().describe("Customer ids that share a lead dedupe pool with this customer. Replaces the current list."),
        crmAuthenticityNotes: z.string().nullable().optional().describe("Notes for judging whether leads of this customer are real."),
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
      description:
        "Update a customer (PUT /api/public/customers/{id}). Send only the fields to change, the others keep their value. Scope: customers:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Customer id."),
        name: z.string().optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        billingLine1: z.string().nullable().optional().describe("Street and house number."),
        billingCity: z.string().nullable().optional(),
        billingPostalCode: z.string().nullable().optional(),
        billingCountry: z.string().length(2).nullable().optional().describe("2-letter country code, for example NL."),
        billingKvkNumber: z.string().nullable().optional().describe("KvK number. A business with invoicing on needs a KvK or VAT number."),
        billingVatNumber: z.string().nullable().optional(),
        billingRecipientType: z.enum(["business", "consumer"]).optional(),
        billingLocale: z.string().optional().describe("Invoice language, for example nl_NL."),
        invoicingEnabled: z.boolean().optional().describe("Whether the customer gets weekly invoices."),
        weeklyDigestEnabled: z.boolean().optional().describe("Whether the customer gets the weekly lead mail."),
        labels: z.array(z.string()).optional().describe("Customer labels. Replaces the current labels."),
        dedupePeerIds: z.array(z.number().int().positive()).optional().describe("Customer ids that share a lead dedupe pool with this customer. Replaces the current list."),
        crmAuthenticityNotes: z.string().nullable().optional().describe("Notes for judging whether leads of this customer are real."),
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
      description:
        "Archive a customer (PATCH /api/public/customers/{id}/archive). Everything is kept; the customer leaves lists and pickers, is no longer invoiced and gets no weekly lead mail. Undo with restore-customer. Scope: customers:write.",
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

  registerJsonTool(
    server,
    "restore-customer",
    {
      description:
        "Restore an archived customer so it is active again (PATCH /api/public/customers/{id}/restore). Scope: customers:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Customer id."),
      }),
    },
    async (input) =>
      client.request({
        method: "PATCH",
        path: `/api/public/customers/${encodePathSegment(input.id)}/restore`,
        body: {},
      }),
  );
}
