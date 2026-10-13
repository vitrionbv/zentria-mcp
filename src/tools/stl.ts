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
      description:
        "Create a draft Speed to Lead flow for one Elementor connection (POST /api/public/stl/flows). Uses the team default SMS template unless smsTemplateId is given. A connection that already has a flow is rejected; use create-stl-flows-batch for several connections. Publish it with update-stl-flow (status active). Scope: stl:write.",
      inputSchema: z.object({
        name: z.string().min(1),
        customerIntegrationId: z.number().int().positive().describe("Elementor connection id."),
        receivingPhone: z.string().min(1).describe("Phone number that receives the SMS."),
        smsTemplateId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("SMS template from the team library. Defaults to the team default."),
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
    "create-stl-flows-batch",
    {
      description:
        "Create Speed to Lead flows for several Elementor connections in one call (POST /api/public/stl/flows/batch). Pass customerIntegrationIds, or campaignId for every Elementor connection of that campaign. Each connection gets its own draft flow with the same name, receiving phone and SMS template; with more than one connection the flow is named \"{name} · {connection name}\". Connections that already have a flow are skipped and returned under skipped. Scope: stl:write.",
      inputSchema: z
        .object({
          name: z.string().min(1),
          receivingPhone: z.string().min(1),
          customerIntegrationIds: z
            .array(z.number().int().positive())
            .min(1)
            .max(100)
            .optional()
            .describe("Elementor connection ids. Required unless campaignId is given."),
          campaignId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Use every Elementor connection of this campaign."),
          smsTemplateId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("SMS template from the team library. Defaults to the team default."),
        })
        .refine(
          (input) => input.customerIntegrationIds !== undefined || input.campaignId !== undefined,
          { message: "Pass customerIntegrationIds or campaignId." },
        ),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/stl/flows/batch",
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
      description:
        "Update a Speed to Lead flow (PUT /api/public/stl/flows/{id}). Fields you leave out keep their value. A flow only goes active when its Elementor connection has exactly one field tagged as the lead name. Set the SMS text with templateText (plain text with {{Name}}, {{Adres}}, {{Telefoon}}, {{Email}}, {{Omschrijving}} placeholders) or templateJson (Tiptap). applyToCampaignFlows copies phone, status and SMS text to the other flows of the same campaign; the result lists appliedToFlowIds and notActivatedFlowIds. Scope: stl:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Flow id."),
        name: z.string().optional(),
        customerIntegrationId: z.number().int().positive().optional(),
        receivingPhone: z.string().optional(),
        status: z.enum(["draft", "active", "inactive"]).optional(),
        templateText: z.string().optional().describe("SMS text as plain text with {{placeholders}}."),
        templateJson: z.record(z.string(), z.unknown()).optional().describe("SMS text as a Tiptap document."),
        applyToCampaignFlows: z.boolean().optional().describe("Also copy phone, status and SMS text to the other flows of the campaign."),
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
    "send-stl-flow-test-sms",
    {
      description:
        "Send a real test SMS with sample data for a flow, through the team's Twilio account (POST /api/public/stl/flows/{flowId}/test-sms). Optionally test an unsaved template with templateJson. Needs the edit-flows permission. Scope: stl:write.",
      inputSchema: z.object({
        flowId: z.number().int().positive().describe("Flow id."),
        to: z.string().min(1).describe("Phone number that receives the test SMS."),
        templateJson: z.record(z.string(), z.unknown()).optional().describe("Optional unsaved Tiptap template to test."),
      }),
    },
    async (input) => {
      const { flowId, ...body } = input;

      return client.request({
        method: "POST",
        path: `/api/public/stl/flows/${encodePathSegment(flowId)}/test-sms`,
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
      description:
        "Create an STL SMS template (POST /api/public/stl/sms-templates). Give templateText (plain text with {{Name}}, {{Adres}}, {{Telefoon}}, {{Email}}, {{Omschrijving}} placeholders; {{Omschrijving|truncate(100)}} shortens) or templateJson (Tiptap). The first template of a team becomes the default. Needs the manage-team-settings permission. Scope: stl:write.",
      inputSchema: z.object({
        name: z.string().min(1),
        templateText: z.string().min(1).optional().describe("SMS text as plain text with {{placeholders}}."),
        templateJson: z.record(z.string(), z.unknown()).optional().describe("SMS text as a Tiptap document."),
        isDefault: z.boolean().optional().describe("Make this the team default template."),
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
        "Replace the name and text of an STL SMS template (PUT /api/public/stl/sms-templates/{id}). Send name plus templateText or templateJson. Needs the manage-team-settings permission. Scope: stl:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Template id."),
        name: z.string().min(1),
        templateText: z.string().min(1).optional().describe("SMS text as plain text with {{placeholders}}."),
        templateJson: z.record(z.string(), z.unknown()).optional().describe("SMS text as a Tiptap document."),
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
    "set-default-stl-sms-template",
    {
      description:
        "Make an SMS template the team default for new flows (PUT /api/public/stl/sms-templates/{id}/default). Needs the manage-team-settings permission. Scope: stl:write.",
      annotations: { idempotentHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Template id."),
      }),
    },
    async (input) =>
      client.request({
        method: "PUT",
        path: `/api/public/stl/sms-templates/${encodePathSegment(input.id)}/default`,
        body: {},
      }),
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
