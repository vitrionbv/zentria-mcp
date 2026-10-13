import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { registerApiTool } from "./_shared.js";

const id = (what: string) => z.number().int().positive().describe(`${what} id.`);

const noteBody = {
  body: z.string().min(1).max(10000).describe("Note text."),
  pinned: z.boolean().optional().describe("Pin the note to the top."),
};

const activityFields = {
  type: z.string().min(1).describe("Activity type: call, meeting, task, email, deadline or lunch."),
  title: z.string().min(1).max(255).describe("Activity title."),
  body: z.string().max(10000).optional().describe("Activity description."),
  dueAt: z.string().optional().describe("ISO 8601 date and time."),
  assigneeUserId: z.number().int().positive().optional().describe("Team member who owns the activity."),
};

const originList = z
  .array(z.string())
  .optional()
  .describe("Allowed origins: http(s) URLs. Wildcards are not allowed.");

/** Tools for sales deletes, activity actions, nested notes and activities, pipelines, stages, forms and settings. */
export function registerSalesAdminTools(server: McpServer, client: ZentriaClient): void {
  // Deletes (scope sales:delete)
  registerApiTool(server, client, {
    name: "delete-deal",
    description:
      "Delete a sales deal together with its activities and notes (DELETE /api/public/sales/deals/{id}). Scope: sales:delete.",
    method: "DELETE",
    path: "/api/public/sales/deals/{id}",
    input: { id: id("Deal") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "delete-person",
    description:
      "Delete a sales person (DELETE /api/public/sales/people/{id}). Refused with 422 while the person still has deals. Scope: sales:delete.",
    method: "DELETE",
    path: "/api/public/sales/people/{id}",
    input: { id: id("Person") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "delete-organization",
    description:
      "Delete a sales organization (DELETE /api/public/sales/organizations/{id}). Refused with 422 while it still has people or deals. Scope: sales:delete.",
    method: "DELETE",
    path: "/api/public/sales/organizations/{id}",
    input: { id: id("Organization") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "delete-activity",
    description:
      "Delete a sales activity (DELETE /api/public/sales/activities/{id}). Log entries cannot be deleted. Scope: sales:delete.",
    method: "DELETE",
    path: "/api/public/sales/activities/{id}",
    input: { id: id("Activity") },
    destructive: true,
  });

  // Activity actions (scope sales:write)
  registerApiTool(server, client, {
    name: "complete-activity",
    description:
      "Mark an open sales activity as done (POST /api/public/sales/activities/{id}/complete). Scope: sales:write.",
    method: "POST",
    path: "/api/public/sales/activities/{id}/complete",
    input: { id: id("Activity") },
  });

  registerApiTool(server, client, {
    name: "cancel-activity",
    description:
      "Cancel an open sales activity, with an optional reason (POST /api/public/sales/activities/{id}/cancel). Scope: sales:write.",
    method: "POST",
    path: "/api/public/sales/activities/{id}/cancel",
    input: {
      id: id("Activity"),
      cancelledReason: z.string().max(255).optional().describe("Why the activity is cancelled."),
    },
  });

  // Notes and activities on a deal, person or organization (scope sales:write)
  registerApiTool(server, client, {
    name: "create-deal-note",
    description:
      "Add a note to a deal (POST /api/public/sales/deals/{id}/notes). Scope: sales:write.",
    method: "POST",
    path: "/api/public/sales/deals/{id}/notes",
    input: { id: id("Deal"), ...noteBody },
  });

  registerApiTool(server, client, {
    name: "create-person-note",
    description:
      "Add a note to a person (POST /api/public/sales/people/{id}/notes). Scope: sales:write.",
    method: "POST",
    path: "/api/public/sales/people/{id}/notes",
    input: { id: id("Person"), ...noteBody },
  });

  registerApiTool(server, client, {
    name: "create-organization-note",
    description:
      "Add a note to an organization (POST /api/public/sales/organizations/{id}/notes). Scope: sales:write.",
    method: "POST",
    path: "/api/public/sales/organizations/{id}/notes",
    input: { id: id("Organization"), ...noteBody },
  });

  registerApiTool(server, client, {
    name: "create-deal-activity",
    description:
      "Add an activity to a deal (POST /api/public/sales/deals/{id}/activities). Scope: sales:write.",
    method: "POST",
    path: "/api/public/sales/deals/{id}/activities",
    input: { id: id("Deal"), ...activityFields },
  });

  registerApiTool(server, client, {
    name: "create-person-activity",
    description:
      "Add an activity for a person on one of the deals (POST /api/public/sales/people/{id}/activities). dealId is required. Scope: sales:write.",
    method: "POST",
    path: "/api/public/sales/people/{id}/activities",
    input: { id: id("Person"), dealId: id("Deal"), ...activityFields },
  });

  // Pipelines and stages (scope sales-admin:write)
  registerApiTool(server, client, {
    name: "create-pipeline",
    description:
      "Create a sales pipeline with the default stages (POST /api/public/sales/pipelines). Scope: sales-admin:write.",
    method: "POST",
    path: "/api/public/sales/pipelines",
    input: { name: z.string().min(1).max(255).describe("Pipeline name, unique within the team.") },
  });

  registerApiTool(server, client, {
    name: "update-pipeline",
    description:
      "Update a sales pipeline: name, default flag, rot warning days, visibility and members (PUT /api/public/sales/pipelines/{id}). Scope: sales-admin:write.",
    method: "PUT",
    path: "/api/public/sales/pipelines/{id}",
    input: {
      id: id("Pipeline"),
      name: z.string().min(1).max(255).optional(),
      isDefault: z.boolean().optional().describe("true makes this the default pipeline."),
      rotAfterDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .nullable()
        .optional()
        .describe("Days without activity before a deal is shown as rotting. null turns it off."),
      visibility: z.enum(["team", "restricted"]).optional(),
      memberIds: z
        .array(z.number().int().positive())
        .optional()
        .describe("Team members who can open a restricted pipeline."),
    },
  });

  registerApiTool(server, client, {
    name: "delete-pipeline",
    description:
      "Delete a sales pipeline (DELETE /api/public/sales/pipelines/{id}). Refused with 422 for the default or last pipeline and while it has deals or forms. Scope: sales-admin:write.",
    method: "DELETE",
    path: "/api/public/sales/pipelines/{id}",
    input: { id: id("Pipeline") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "archive-pipeline",
    description:
      "Archive a sales pipeline (POST /api/public/sales/pipelines/{id}/archive). The default and the last pipeline cannot be archived. Scope: sales-admin:write.",
    method: "POST",
    path: "/api/public/sales/pipelines/{id}/archive",
    input: { id: id("Pipeline") },
  });

  registerApiTool(server, client, {
    name: "restore-pipeline",
    description:
      "Restore an archived sales pipeline (POST /api/public/sales/pipelines/{id}/restore). Scope: sales-admin:write.",
    method: "POST",
    path: "/api/public/sales/pipelines/{id}/restore",
    input: { id: id("Pipeline") },
  });

  registerApiTool(server, client, {
    name: "create-pipeline-stage",
    description:
      "Add a stage at the end of a pipeline (POST /api/public/sales/pipelines/{id}/stages). Returns the pipeline with its stages. A pipeline has at most one won and one lost stage. Scope: sales-admin:write.",
    method: "POST",
    path: "/api/public/sales/pipelines/{id}/stages",
    input: {
      id: id("Pipeline"),
      name: z.string().min(1).max(255).describe("Stage name."),
      isWon: z.boolean().optional().describe("Mark as the won stage."),
      isLost: z.boolean().optional().describe("Mark as the lost stage."),
    },
  });

  registerApiTool(server, client, {
    name: "update-pipeline-stages",
    description:
      "Rename and reorder the stages of a pipeline in one go (PUT /api/public/sales/pipelines/{id}/stages). Send every stage in the new order. Scope: sales-admin:write.",
    method: "PUT",
    path: "/api/public/sales/pipelines/{id}/stages",
    input: {
      id: id("Pipeline"),
      stages: z
        .array(
          z.object({
            id: id("Stage"),
            name: z.string().min(1).max(255),
            isWon: z.boolean().optional(),
            isLost: z.boolean().optional(),
          }),
        )
        .min(1)
        .describe("All stages of the pipeline, in the new order."),
    },
  });

  registerApiTool(server, client, {
    name: "delete-pipeline-stage",
    description:
      "Delete a stage (DELETE /api/public/sales/pipelines/{id}/stages/{stageId}). Refused with 422 while the stage has deals or is the last stage. Scope: sales-admin:write.",
    method: "DELETE",
    path: "/api/public/sales/pipelines/{id}/stages/{stageId}",
    input: { id: id("Pipeline"), stageId: id("Stage") },
    destructive: true,
  });

  // Forms (scope sales-admin:write unless noted)
  registerApiTool(server, client, {
    name: "delete-form",
    description:
      "Delete a sales form (DELETE /api/public/sales/forms/{id}). Refused with 422 while the form has deals or submissions. Scope: sales-admin:write.",
    method: "DELETE",
    path: "/api/public/sales/forms/{id}",
    input: { id: id("Form") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "rotate-form-token",
    description:
      "Give a form a new public token (POST /api/public/sales/forms/{id}/rotate-token). The old embed URL stops working at once. Scope: sales-admin:write.",
    method: "POST",
    path: "/api/public/sales/forms/{id}/rotate-token",
    input: { id: id("Form") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "publish-form",
    description:
      "Publish the editor draft of a form, with its settings (POST /api/public/sales/forms/{id}/publish). Scope: sales-admin:write.",
    method: "POST",
    path: "/api/public/sales/forms/{id}/publish",
    input: {
      id: id("Form"),
      name: z.string().min(1).max(255),
      pipelineId: z.number().int().positive().optional(),
      allowedOrigins: originList,
      calEventTypeId: z.string().max(255).nullable().optional().describe("Cal.com event type path or URL."),
      isActive: z.boolean().optional(),
    },
  });

  registerApiTool(server, client, {
    name: "get-form-draft",
    description:
      "Read the unpublished editor draft of a form: canvas files, lead contract and meta (GET /api/public/sales/forms/{id}/draft). Needs the manage-forms permission. Scope: sales:read.",
    path: "/api/public/sales/forms/{id}/draft",
    input: { id: id("Form") },
  });

  registerApiTool(server, client, {
    name: "update-form-draft",
    description:
      "Write parts of the editor draft of a form (PUT /api/public/sales/forms/{id}/draft). Nothing goes live until publish-form. Scope: sales-admin:write.",
    method: "PUT",
    path: "/api/public/sales/forms/{id}/draft",
    input: {
      id: id("Form"),
      canvasHtml: z.string().nullable().optional(),
      canvasCss: z.string().nullable().optional(),
      canvasJs: z.string().nullable().optional(),
      leadContract: z.record(z.string(), z.unknown()).optional(),
      meta: z
        .object({
          name: z.string().max(255).nullable().optional(),
          isActive: z.boolean().nullable().optional(),
          pipelineId: z.number().int().positive().nullable().optional(),
          allowedOrigins: originList.nullable(),
          calEventTypeId: z.string().max(255).nullable().optional(),
        })
        .optional()
        .describe("Settings that publish-form applies."),
    },
  });

  registerApiTool(server, client, {
    name: "preview-form-submit",
    description:
      "Dry run a sample payload through the lead contract of a form draft without creating anything (POST /api/public/sales/forms/{id}/preview-submit). Scope: sales:read.",
    method: "POST",
    path: "/api/public/sales/forms/{id}/preview-submit",
    input: {
      id: id("Form"),
      payload: z.record(z.string(), z.unknown()).describe("Sample form fields, for example {email, name}."),
    },
    readOnly: true,
  });

  // Settings
  registerApiTool(server, client, {
    name: "get-sales-settings",
    description:
      "Read the sales settings: Cal.com connection status, Pipedrive connection status and pipelines with counts. No secrets (GET /api/public/sales/settings). Needs the manage-sales-settings permission. Scope: sales:read.",
    path: "/api/public/sales/settings",
    input: {},
  });

  registerApiTool(server, client, {
    name: "update-sales-settings",
    description:
      "Connect or disconnect Cal.com (PUT /api/public/sales/settings). calApiKey is write-only and never returned. Scope: sales-admin:write.",
    method: "PUT",
    path: "/api/public/sales/settings",
    input: {
      calApiKey: z.string().max(255).optional().describe("Cal.com API key to save."),
      clearCalApiKey: z.boolean().optional().describe("true removes the Cal.com connection."),
    },
  });
}
