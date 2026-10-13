import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { paginationSchema, registerApiTool } from "./_shared.js";

const campaignId = z.number().int().positive().describe("Campaign id from list-campaigns.");
const connectionId = (what: string) => z.number().int().positive().describe(`${what} id.`);

const page = { page: paginationSchema.page, itemsPerPage: paginationSchema.itemsPerPage };

const mapping = z
  .array(
    z.object({
      path: z.string().min(1).max(255).describe("Path of the field in the Elementor payload, for example fields.email.value."),
      name: z.string().min(1).max(255).describe("Name of the variable."),
      leadField: z.enum(["name", "email", "phone", "description"]).nullable().optional().describe("Lead field this value fills."),
    }),
  )
  .describe("Which payload fields become which lead fields. Replaces the whole mapping.");

const mailboxFields = {
  name: z.string().min(1).max(255),
  imapHost: z.string().min(1).max(255).describe("Mail server host, not an email address, for example imap.example.com."),
  imapPort: z.number().int().min(1).max(65535),
  imapEncryption: z.enum(["ssl", "tls", "none"]),
  username: z.string().min(1).max(255),
  folder: z.string().min(1).max(255).describe("IMAP folder to poll, for example INBOX."),
  lookbackDays: z.number().int().min(1).max(365).describe("How many days back new mail is looked at."),
  markAsRead: z.boolean().optional(),
  isLive: z.boolean().optional().describe("Whether the mailbox is polled. Default true for a new mailbox."),
};

const secretNote = "The password is write-only and never returned.";

/** Tools for Elementor, mailbox and Voys connections of a campaign. */
export function registerConnectionTools(server: McpServer, client: ZentriaClient): void {
  // Elementor
  registerApiTool(server, client, {
    name: "list-elementor-connections",
    description:
      "List the Elementor form connections of a campaign (GET /api/public/campaigns/{campaignId}/elementor-connections). The webhook URL carries the ingest token and is only shown to users who can see customers. Scope: connections:read.",
    path: "/api/public/campaigns/{campaignId}/elementor-connections",
    input: { campaignId, ...page },
  });

  registerApiTool(server, client, {
    name: "get-elementor-connection",
    description:
      "Get an Elementor connection with its mapping, test mode, webhook URL and last test payload (GET /api/public/elementor-connections/{id}). Scope: connections:read.",
    path: "/api/public/elementor-connections/{id}",
    input: { id: connectionId("Elementor connection") },
  });

  registerApiTool(server, client, {
    name: "create-elementor-connection",
    description:
      "Create an Elementor connection for a campaign (POST /api/public/campaigns/{campaignId}/elementor-connections). It starts in test mode for 10 minutes and not live: post the Elementor form to the returned webhookUrl, read lastTestPayload, then set the mapping with update-elementor-connection. Scope: connections:write.",
    method: "POST",
    path: "/api/public/campaigns/{campaignId}/elementor-connections",
    input: { campaignId, name: z.string().min(1).max(255), mapping: mapping.optional() },
  });

  registerApiTool(server, client, {
    name: "update-elementor-connection",
    description:
      "Update an Elementor connection: name, isLive and mapping (PUT /api/public/elementor-connections/{id}). Fields you leave out stay as they are. Scope: connections:write.",
    method: "PUT",
    path: "/api/public/elementor-connections/{id}",
    input: {
      id: connectionId("Elementor connection"),
      name: z.string().min(1).max(255).optional(),
      isLive: z.boolean().optional().describe("Whether submissions become leads."),
      mapping: mapping.optional(),
    },
  });

  registerApiTool(server, client, {
    name: "delete-elementor-connection",
    description: "Delete an Elementor connection (DELETE /api/public/elementor-connections/{id}). Scope: connections:write.",
    method: "DELETE",
    path: "/api/public/elementor-connections/{id}",
    input: { id: connectionId("Elementor connection") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "enable-elementor-test-mode",
    description:
      "Switch test mode on for 10 minutes and clear the last test payload, so the next form submission is captured for the mapping instead of becoming a lead (POST /api/public/elementor-connections/{id}/test-mode). Scope: connections:write.",
    method: "POST",
    path: "/api/public/elementor-connections/{id}/test-mode",
    input: { id: connectionId("Elementor connection") },
  });

  registerApiTool(server, client, {
    name: "disable-elementor-test-mode",
    description: "Switch test mode off (DELETE /api/public/elementor-connections/{id}/test-mode). Scope: connections:write.",
    method: "DELETE",
    path: "/api/public/elementor-connections/{id}/test-mode",
    input: { id: connectionId("Elementor connection") },
  });

  // Mailbox
  registerApiTool(server, client, {
    name: "list-mailbox-connections",
    description:
      "List the mailboxes of a campaign that are polled for lead mail, without passwords (GET /api/public/campaigns/{campaignId}/mailbox-connections). Needs the CRM leads module. Scope: connections:read.",
    path: "/api/public/campaigns/{campaignId}/mailbox-connections",
    input: { campaignId, ...page },
  });

  registerApiTool(server, client, {
    name: "get-mailbox-connection",
    description:
      "Get a mailbox with its last poll time and error (GET /api/public/mailbox-connections/{id}). hasPassword says whether a password is stored; the password itself is never returned. Scope: connections:read.",
    path: "/api/public/mailbox-connections/{id}",
    input: { id: connectionId("Mailbox") },
  });

  registerApiTool(server, client, {
    name: "create-mailbox-connection",
    description: `Add an IMAP mailbox to a campaign (POST /api/public/campaigns/{campaignId}/mailbox-connections). Use list-mailbox-folders-for-new-mailbox first to pick the folder. ${secretNote} Scope: connections:write.`,
    method: "POST",
    path: "/api/public/campaigns/{campaignId}/mailbox-connections",
    input: { campaignId, ...mailboxFields, password: z.string().min(1).max(255) },
  });

  registerApiTool(server, client, {
    name: "update-mailbox-connection",
    description: `Update a mailbox (PUT /api/public/mailbox-connections/{id}). Fields you leave out stay as they are; a blank or missing password keeps the stored one. ${secretNote} Scope: connections:write.`,
    method: "PUT",
    path: "/api/public/mailbox-connections/{id}",
    input: {
      id: connectionId("Mailbox"),
      name: mailboxFields.name.optional(),
      imapHost: mailboxFields.imapHost.optional(),
      imapPort: mailboxFields.imapPort.optional(),
      imapEncryption: mailboxFields.imapEncryption.optional(),
      username: mailboxFields.username.optional(),
      folder: mailboxFields.folder.optional(),
      lookbackDays: mailboxFields.lookbackDays.optional(),
      markAsRead: mailboxFields.markAsRead,
      isLive: mailboxFields.isLive,
      password: z.string().max(255).optional(),
    },
  });

  registerApiTool(server, client, {
    name: "delete-mailbox-connection",
    description: "Delete a mailbox (DELETE /api/public/mailbox-connections/{id}). Scope: connections:write.",
    method: "DELETE",
    path: "/api/public/mailbox-connections/{id}",
    input: { id: connectionId("Mailbox") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "test-mailbox-connection",
    description:
      "Test the connection of a saved mailbox (POST /api/public/mailbox-connections/{id}/test). Optional fields override the stored settings so changes can be tested before saving. A failure answers ok false with the reason. Scope: connections:write.",
    method: "POST",
    path: "/api/public/mailbox-connections/{id}/test",
    input: {
      id: connectionId("Mailbox"),
      imapHost: z.string().max(255).optional(),
      imapPort: z.number().int().min(1).max(65535).optional(),
      imapEncryption: z.enum(["ssl", "tls", "none"]).optional(),
      username: z.string().max(255).optional(),
      password: z.string().max(255).optional(),
      folder: z.string().max(255).optional(),
    },
  });

  registerApiTool(server, client, {
    name: "list-mailbox-folders",
    description:
      "List the IMAP folders of a saved mailbox (POST /api/public/mailbox-connections/{id}/folders). Answers 422 when the mailbox cannot be opened. Scope: connections:write.",
    method: "POST",
    path: "/api/public/mailbox-connections/{id}/folders",
    input: { id: connectionId("Mailbox") },
  });

  registerApiTool(server, client, {
    name: "list-mailbox-folders-for-new-mailbox",
    description:
      "List the IMAP folders of a mailbox that is not saved yet, to pick the folder before creating it (POST /api/public/campaigns/{campaignId}/mailbox-connections/folders). Answers 422 when the mailbox cannot be opened. Scope: connections:write.",
    method: "POST",
    path: "/api/public/campaigns/{campaignId}/mailbox-connections/folders",
    input: {
      campaignId,
      imapHost: z.string().min(1).max(255),
      imapPort: z.number().int().min(1).max(65535),
      imapEncryption: z.enum(["ssl", "tls", "none"]),
      username: z.string().min(1).max(255),
      password: z.string().max(255).optional(),
    },
  });

  // Voys numbers of a campaign
  registerApiTool(server, client, {
    name: "get-campaign-voys",
    description:
      "Get the Voys phone numbers of a campaign (GET /api/public/campaigns/{campaignId}/voys). Answers 404 when it has none. Scope: connections:read.",
    path: "/api/public/campaigns/{campaignId}/voys",
    input: { campaignId },
  });

  registerApiTool(server, client, {
    name: "set-campaign-voys",
    description:
      "Set the Voys phone numbers of a campaign, replacing the list (PUT /api/public/campaigns/{campaignId}/voys). Numbers in international format, for example +31851093749. Scope: connections:write.",
    method: "PUT",
    path: "/api/public/campaigns/{campaignId}/voys",
    input: { campaignId, phoneNumbers: z.array(z.string().regex(/^\+[1-9]\d{6,14}$/)).min(1) },
  });

  registerApiTool(server, client, {
    name: "delete-campaign-voys",
    description: "Remove the Voys phone numbers of a campaign (DELETE /api/public/campaigns/{campaignId}/voys). Scope: connections:write.",
    method: "DELETE",
    path: "/api/public/campaigns/{campaignId}/voys",
    input: { campaignId },
    destructive: true,
  });

  // Generic integrations
  const provider = z.enum(["wordpress", "google_search_console", "google_analytics"]);

  registerApiTool(server, client, {
    name: "list-campaign-integrations",
    description:
      "List the generic integrations of a campaign (WordPress, Google Search Console, Google Analytics) (GET /api/public/campaigns/{campaignId}/integrations). Only the keys of the settings are returned. Scope: connections:read.",
    path: "/api/public/campaigns/{campaignId}/integrations",
    input: { campaignId, ...page },
  });

  registerApiTool(server, client, {
    name: "get-campaign-integration",
    description:
      "Get a generic integration of a campaign (GET /api/public/campaign-integrations/{id}). Only the keys of the settings are returned. Scope: connections:read.",
    path: "/api/public/campaign-integrations/{id}",
    input: { id: connectionId("Integration") },
  });

  registerApiTool(server, client, {
    name: "create-campaign-integration",
    description:
      "Add a generic integration to a campaign, one per provider (POST /api/public/campaigns/{campaignId}/integrations). Scope: connections:write.",
    method: "POST",
    path: "/api/public/campaigns/{campaignId}/integrations",
    input: { campaignId, provider, config: z.record(z.string(), z.unknown()).optional().describe("Settings of the integration.") },
  });

  registerApiTool(server, client, {
    name: "update-campaign-integration",
    description:
      "Update a generic integration: provider and settings, which replace the old settings (PUT /api/public/campaign-integrations/{id}). Scope: connections:write.",
    method: "PUT",
    path: "/api/public/campaign-integrations/{id}",
    input: { id: connectionId("Integration"), provider, config: z.record(z.string(), z.unknown()).optional() },
  });

  registerApiTool(server, client, {
    name: "delete-campaign-integration",
    description: "Delete a generic integration (DELETE /api/public/campaign-integrations/{id}). Scope: connections:write.",
    method: "DELETE",
    path: "/api/public/campaign-integrations/{id}",
    input: { id: connectionId("Integration") },
    destructive: true,
  });

  // Voys accounts of the team
  registerApiTool(server, client, {
    name: "list-crm-voys-connections",
    description:
      "List the Voys accounts of the team (API key and client uuid) without API keys (GET /api/public/crm/voys-connections). Needs the CRM leads module and the permission to manage Voys. Scope: connections:read.",
    path: "/api/public/crm/voys-connections",
    input: page,
  });

  registerApiTool(server, client, {
    name: "get-crm-voys-connection",
    description:
      "Get a Voys account of the team with its last poll time and error (GET /api/public/crm/voys-connections/{id}). hasApiKey says whether a key is stored; the key is never returned. Scope: connections:read.",
    path: "/api/public/crm/voys-connections/{id}",
    input: { id: connectionId("Voys account") },
  });

  registerApiTool(server, client, {
    name: "create-crm-voys-connection",
    description: `Add a Voys account to the team (POST /api/public/crm/voys-connections). The API key is write-only and never returned. Scope: connections:write.`,
    method: "POST",
    path: "/api/public/crm/voys-connections",
    input: {
      name: z.string().min(1).max(255),
      apiKey: z.string().min(8).max(512),
      clientUuid: z.string().min(1).max(128),
      isActive: z.boolean().optional().describe("Default true."),
    },
  });

  registerApiTool(server, client, {
    name: "update-crm-voys-connection",
    description:
      "Update a Voys account: name, clientUuid, isActive and apiKey (PUT /api/public/crm/voys-connections/{id}). A blank or missing apiKey keeps the stored key; fields you leave out stay as they are. Scope: connections:write.",
    method: "PUT",
    path: "/api/public/crm/voys-connections/{id}",
    input: {
      id: connectionId("Voys account"),
      name: z.string().min(1).max(255).optional(),
      apiKey: z.string().min(8).max(512).optional(),
      clientUuid: z.string().min(1).max(128).optional(),
      isActive: z.boolean().optional(),
    },
  });

  registerApiTool(server, client, {
    name: "delete-crm-voys-connection",
    description: "Delete a Voys account of the team (DELETE /api/public/crm/voys-connections/{id}). Scope: connections:write.",
    method: "DELETE",
    path: "/api/public/crm/voys-connections/{id}",
    input: { id: connectionId("Voys account") },
    destructive: true,
  });
}
