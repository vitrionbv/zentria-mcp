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

export function registerSalesFormTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-forms",
    {
      description: "List sales forms (GET /api/public/sales/forms). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/sales/forms",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-form",
    {
      description: "Create a sales form (POST /api/public/sales/forms). Scope: sales:write.",
      inputSchema: z.object({
        name: z.string().min(1),
        pipelineId: z.number().int().positive(),
        allowedOrigins: z.array(z.string()).optional(),
        canvasHtml: z.string().optional(),
        canvasCss: z.string().optional(),
        canvasJs: z.string().optional(),
        leadContract: z.record(z.string(), z.unknown()).optional(),
        isActive: z.boolean().optional(),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/sales/forms",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-form",
    {
      description: "Fetch a sales form (GET /api/public/sales/forms/{id}). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Form id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/sales/forms/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-form",
    {
      description: "Update a sales form (PUT /api/public/sales/forms/{id}). Scope: sales:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Form id."),
        name: z.string().optional(),
        pipelineId: z.number().int().positive().optional(),
        allowedOrigins: z.array(z.string()).optional(),
        canvasHtml: z.string().optional(),
        canvasCss: z.string().optional(),
        canvasJs: z.string().optional(),
        leadContract: z.record(z.string(), z.unknown()).optional(),
        isActive: z.boolean().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PUT",
        path: `/api/public/sales/forms/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );
}

export function registerSalesSubmissionTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-form-submissions",
    {
      description: "List sales form submissions (GET /api/public/sales/submissions). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/sales/submissions",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "get-form-submission",
    {
      description:
        "Fetch a sales form submission (GET /api/public/sales/submissions/{id}). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Submission id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/sales/submissions/${encodePathSegment(input.id)}` }),
  );
}
