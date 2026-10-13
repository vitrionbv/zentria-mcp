import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { encodePathSegment, idSchema, paginationSchema, registerApiTool, registerJsonTool } from "./_shared.js";

const EXPORT_TYPES = [
  "users",
  "teams",
  "tenants",
  "audits",
  "crm_leads",
  "lead_submissions",
  "leads",
  "flows",
  "sms_templates",
  "customers",
] as const;

/** Tools for the team profile and settings, members and invitations, roles, and exports. */
export function registerTeamAdminTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "update-team",
    {
      description:
        "Rename the PAT-bound team, the team profile (PUT /api/public/teams/{id}). The slug follows the name. Needs the edit-team permission. Scope: team:write.",
      inputSchema: z.object({ name: z.string().min(1).max(255).describe("New team name.") }),
    },
    async (input) => {
      const teamId = await client.getBoundTeamId();

      return client.request({
        method: "PUT",
        path: `/api/public/teams/${encodePathSegment(teamId)}`,
        body: { name: input.name },
      });
    },
  );

  registerApiTool(server, client, {
    name: "get-team-setting",
    description:
      "Fetch one team setting by key, for example twilio_from or default_phone_country (GET /api/public/settings/{key}). Secrets are never returned, only hasValue. Needs the manage-team-settings permission. Scope: settings:read.",
    path: "/api/public/settings/{key}",
    input: { key: z.string().min(1).describe("Setting key, see get-settings for the list.") },
  });

  registerApiTool(server, client, {
    name: "update-team-setting",
    description:
      "Set one team setting, the way the settings page does (PUT /api/public/settings/{key}). Use get-settings for the keys, types and options. An empty value or null clears the setting; an empty value for a secret (twilio_sid, twilio_token, mollie_api_key) leaves it unchanged; switches take true or false. Speed to Lead sending (Twilio) is configured here. Needs the manage-team-settings permission. Scope: team:write.",
    method: "PUT",
    path: "/api/public/settings/{key}",
    input: {
      key: z.string().min(1).describe("Setting key."),
      value: z
        .union([z.string(), z.number(), z.boolean(), z.null()])
        .describe("New value. Empty string or null clears the setting."),
    },
  });

  registerApiTool(server, client, {
    name: "list-roles",
    description:
      "List the roles of the team with their member counts; use a role name for invite-member and change-member-role (GET /api/public/roles). Scope: members:read.",
    path: "/api/public/roles",
    input: {},
  });

  registerApiTool(server, client, {
    name: "remove-member",
    description:
      "Remove a member from the team (DELETE /api/public/members/{id}). Their API keys for this team and pending export links stop working. You cannot remove yourself. Needs the remove-members permission. Scope: members:write.",
    method: "DELETE",
    path: "/api/public/members/{id}",
    input: { id: idSchema.describe("Member user id.") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "list-invitations",
    description:
      "List the pending team invitations that have not expired (GET /api/public/invitations). Invite someone with invite-member. Scope: members:read.",
    path: "/api/public/invitations",
    input: { ...paginationSchema },
  });

  registerApiTool(server, client, {
    name: "get-invitation",
    description: "Fetch one pending invitation (GET /api/public/invitations/{id}). Scope: members:read.",
    path: "/api/public/invitations/{id}",
    input: { id: idSchema.describe("Invitation id.") },
  });

  registerApiTool(server, client, {
    name: "resend-invitation",
    description:
      "Send the invitation mail again for a pending invitation; the expiry date does not change (POST /api/public/invitations/{id}/resend). Needs the invite-members permission. Scope: members:write.",
    method: "POST",
    path: "/api/public/invitations/{id}/resend",
    input: { id: idSchema.describe("Invitation id.") },
  });

  registerApiTool(server, client, {
    name: "cancel-invitation",
    description:
      "Cancel a pending invitation (DELETE /api/public/invitations/{id}). Needs the invite-members permission. Scope: members:write.",
    method: "DELETE",
    path: "/api/public/invitations/{id}",
    input: { id: idSchema.describe("Invitation id.") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "list-exports",
    description:
      "List the data exports of the team, newest first (GET /api/public/exports). Filter with q (file name or type) and status. Completed exports have a downloadUrl. Needs the view-exports permission. Scope: exports:read.",
    path: "/api/public/exports",
    input: {
      ...paginationSchema,
      status: z.enum(["pending", "processing", "completed", "failed"]).optional().describe("Only exports with this status."),
    },
  });

  registerApiTool(server, client, {
    name: "get-export",
    description:
      "Fetch one export with its status, progress and, when completed, the downloadUrl; fetch the file from that URL with the same API key (GET /api/public/exports/{id}). Scope: exports:read.",
    path: "/api/public/exports/{id}",
    input: { id: idSchema.describe("Export id.") },
  });

  registerApiTool(server, client, {
    name: "start-export",
    description:
      "Queue a spreadsheet export (POST /api/public/exports). Returns exportId; poll get-export until the status is completed. type is one of users, teams, tenants, audits, crm_leads, lead_submissions, leads, flows, sms_templates, customers. filters takes the filters of the export dialog in the web app, for example { reviewStatus: \"approved\", dateFrom: \"2026-01-01\", customerId: 12 }. Each type needs its own permission and module, as in the web app. Scope: exports:write.",
    method: "POST",
    path: "/api/public/exports",
    input: {
      type: z.enum(EXPORT_TYPES).describe("What to export."),
      filters: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Optional filters, for example search, sortBy, sortDirection, dateFrom, dateTo, customerId, source, reviewStatus, status, flowId."),
    },
  });

  registerApiTool(server, client, {
    name: "start-team-data-export",
    description:
      "Queue the full export of the team data: members, invitations, to-dos, roles, audits and exports (POST /api/public/exports/team-data). The download link is mailed to the owner of the API key. Needs the export-team permission, usually team leaders only. Scope: exports:write.",
    method: "POST",
    path: "/api/public/exports/team-data",
    input: {},
  });

  registerApiTool(server, client, {
    name: "delete-export",
    description:
      "Delete an export and its file (DELETE /api/public/exports/{id}). Allowed for the person who started it and for people with the create-exports permission. Scope: exports:write.",
    method: "DELETE",
    path: "/api/public/exports/{id}",
    input: { id: idSchema.describe("Export id.") },
    destructive: true,
  });
}
