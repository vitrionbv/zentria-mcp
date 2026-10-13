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

export function registerSalesDealTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-deals",
    {
      description:
        "List sales deals (GET /api/public/sales/deals). Optional pipelineId filter. Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...paginationSchema,
        pipelineId: z.number().int().positive().optional().describe("Filter by pipeline id."),
      }),
    },
    async (input) => {
      const { pipelineId, ...pagination } = input;
      const query = paginationQuery(pagination);

      if (pipelineId !== undefined) {
        query.pipelineId = pipelineId;
      }

      return client.request({ path: "/api/public/sales/deals", query });
    },
  );

  registerJsonTool(
    server,
    "create-deal",
    {
      description:
        "Create a sales deal (POST /api/public/sales/deals). pipelineId and a contact are required: personId or organizationId, or nested person/organization to create (or reuse) them. Scope: sales:write.",
      inputSchema: z.object({
        title: z.string().min(1).describe("Deal title."),
        pipelineId: z.number().int().positive().describe("Pipeline id."),
        value: z.number().optional().describe("Deal value."),
        personId: z.number().int().positive().optional(),
        organizationId: z.number().int().positive().optional(),
        person: z
          .object({
            name: z.string().min(1).max(255),
            email: z.string().email().optional(),
            phone: z.string().max(32).optional(),
          })
          .optional()
          .describe("A new person for the deal. An existing person with the same email or phone is reused."),
        organization: z
          .object({ name: z.string().min(1).max(255) })
          .optional()
          .describe("A new company for the deal. An existing company with the same name is reused."),
        stageId: z.number().int().positive().optional(),
        ownerUserId: z.number().int().positive().optional(),
        expectedCloseDate: z.string().optional().describe("ISO date YYYY-MM-DD."),
        lostReason: z.string().optional(),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/sales/deals",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-deal",
    {
      description: "Fetch a sales deal (GET /api/public/sales/deals/{id}). Scope: sales:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Deal id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/sales/deals/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-deal",
    {
      description: "Update a sales deal (PUT /api/public/sales/deals/{id}). Scope: sales:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Deal id."),
        title: z.string().optional(),
        value: z.number().nullable().optional(),
        personId: z.number().int().positive().nullable().optional(),
        organizationId: z.number().int().positive().nullable().optional(),
        stageId: z.number().int().positive().optional(),
        ownerUserId: z.number().int().positive().nullable().optional(),
        expectedCloseDate: z.string().nullable().optional(),
        lostReason: z.string().nullable().optional(),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PUT",
        path: `/api/public/sales/deals/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );

  registerJsonTool(
    server,
    "move-deal-stage",
    {
      description:
        "Move a deal to another pipeline stage (PATCH /api/public/sales/deals/{id}/stage). Scope: sales:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Deal id."),
        stageId: z.number().int().positive().describe("Target stage id."),
        lostReason: z.string().max(255).optional().describe("Why the deal is lost, when the stage is the lost stage."),
      }),
    },
    async (input) =>
      client.request({
        method: "PATCH",
        path: `/api/public/sales/deals/${encodePathSegment(input.id)}/stage`,
        body: compactBody({ stageId: input.stageId, lostReason: input.lostReason }) ?? {},
      }),
  );
}
