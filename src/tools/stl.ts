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

export function registerStlTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-stl-flows",
    {
      description: "List Speed to Lead flows (GET /api/public/stl/flows). Scope: stl:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/stl/flows",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-stl-flow",
    {
      description: "Create a Speed to Lead flow (POST /api/public/stl/flows). Scope: stl:write.",
      inputSchema: z.object({
        name: z.string().min(1),
        customerIntegrationId: z.number().int().positive(),
        receivingPhone: z.string().min(1),
        status: z.enum(["draft", "active", "inactive"]).optional(),
        templateJson: z.record(z.string(), z.unknown()).optional(),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/stl/flows",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-stl-flow",
    {
      description: "Fetch a Speed to Lead flow (GET /api/public/stl/flows/{id}). Scope: stl:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Flow id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/stl/flows/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-stl-flow",
    {
      description: "Update a Speed to Lead flow (PUT /api/public/stl/flows/{id}). Scope: stl:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Flow id."),
        name: z.string().optional(),
        customerIntegrationId: z.number().int().positive().optional(),
        receivingPhone: z.string().optional(),
        status: z.enum(["draft", "active", "inactive"]).optional(),
        templateJson: z.record(z.string(), z.unknown()).optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PUT",
        path: `/api/public/stl/flows/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );

  registerJsonTool(
    server,
    "delete-stl-flow",
    {
      description: "Delete a Speed to Lead flow (DELETE /api/public/stl/flows/{id}). Scope: stl:write.",
      annotations: { destructiveHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Flow id."),
      }),
    },
    async (input) =>
      client.request({
        method: "DELETE",
        path: `/api/public/stl/flows/${encodePathSegment(input.id)}`,
      }),
  );

  registerJsonTool(
    server,
    "list-stl-sms-templates",
    {
      description: "List STL SMS templates (GET /api/public/stl/sms-templates). Scope: stl:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/stl/sms-templates",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-stl-sms-template",
    {
      description: "Create an STL SMS template (POST /api/public/stl/sms-templates). Scope: stl:write.",
      inputSchema: z.object({
        name: z.string().min(1),
        body: z.string().min(1).describe("SMS template body."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/stl/sms-templates",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-stl-sms-template",
    {
      description:
        "Fetch an STL SMS template (GET /api/public/stl/sms-templates/{id}). Scope: stl:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Template id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/stl/sms-templates/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-stl-sms-template",
    {
      description:
        "Update an STL SMS template (PUT /api/public/stl/sms-templates/{id}). Scope: stl:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Template id."),
        name: z.string().optional(),
        body: z.string().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PUT",
        path: `/api/public/stl/sms-templates/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );

  registerJsonTool(
    server,
    "delete-stl-sms-template",
    {
      description:
        "Delete an STL SMS template (DELETE /api/public/stl/sms-templates/{id}). Scope: stl:write.",
      annotations: { destructiveHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Template id."),
      }),
    },
    async (input) =>
      client.request({
        method: "DELETE",
        path: `/api/public/stl/sms-templates/${encodePathSegment(input.id)}`,
      }),
  );

  registerJsonTool(
    server,
    "list-stl-leads",
    {
      description: "List Speed to Lead leads (GET /api/public/stl/leads). Scope: stl:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/stl/leads",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "get-stl-lead",
    {
      description: "Fetch an STL lead (GET /api/public/stl/leads/{id}). Scope: stl:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Lead id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/stl/leads/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "delete-stl-lead",
    {
      description: "Delete an STL lead (DELETE /api/public/stl/leads/{id}). Scope: stl:write.",
      annotations: { destructiveHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Lead id."),
      }),
    },
    async (input) =>
      client.request({
        method: "DELETE",
        path: `/api/public/stl/leads/${encodePathSegment(input.id)}`,
      }),
  );
}
