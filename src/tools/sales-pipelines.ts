import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import {
  encodePathSegment,
  paginationQuery,
  paginationSchema,
  registerJsonTool,
} from "./_shared.js";

export function registerSalesPipelineTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-pipelines",
    {
      description: "List sales pipelines (GET /api/public/sales/pipelines). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/sales/pipelines",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "get-pipeline",
    {
      description: "Fetch a sales pipeline with stages (GET /api/public/sales/pipelines/{id}). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Pipeline id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/sales/pipelines/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "get-default-pipeline",
    {
      description:
        "Fetch the team default sales pipeline (GET /api/public/sales/pipeline). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({}),
    },
    async () => client.request({ path: "/api/public/sales/pipeline" }),
  );
}
