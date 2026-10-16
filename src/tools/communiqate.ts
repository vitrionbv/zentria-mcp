import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { registerApiTool } from "./_shared.js";

/**
 * CommuniQate (WhatsApp inbox) through Zentria. Every tool name starts with `communiqate-` so it is clear the
 * call goes to CommuniQate. Fields follow the CommuniQate API (snake_case); Zentria adds the team's API key.
 * The tools only work when the team connected CommuniQate in Zentria.
 */

const id = (what: string) => z.string().min(1).describe(`${what} id (UUID) from CommuniQate.`);
const perPage = z.number().int().min(1).max(100).optional().describe("Rows per page, at most 100.");
const cursor = z.string().optional().describe("meta.next_cursor of the previous page.");
const page = z.number().int().min(1).optional().describe("Page number, from 1.");
const sends = "Sends a real WhatsApp message to the customer from the team's number: confirm the recipient and the text with the user first.";

const messageBody = z
  .record(z.string(), z.unknown())
  .describe(
    'The message, as CommuniQate expects it: {"type": "text", "text": "..."} inside the 24-hour service window; {"type": "whatsapp_template", "whatsapp_template": {"message_template": "<template name>", "components": [...]}} outside it; or media such as {"type": "image", "image": {"file_id": "<from communiqate-upload-file>", "caption": "..."}}.',
  );

/** Tools for the team's CommuniQate workspace. */
export function registerCommuniqateTools(server: McpServer, client: ZentriaClient): void {
  registerApiTool(server, client, {
    name: "communiqate-get-connection",
    description:
      "Status of the team's CommuniQate link: connected or not, workspace, channels, whether WhatsApp events arrive, last error (GET /api/public/communiqate/connection). Never returns the API key. Scope: integrations:read.",
    path: "/api/public/communiqate/connection",
    input: {},
  });

  registerApiTool(server, client, {
    name: "communiqate-list-channels",
    description:
      "List the CommuniQate channels (WhatsApp numbers, Instagram) the team can send on, with their ids (GET /api/public/communiqate/channels). Use the id as channel_id when starting a conversation. Scope: communiqate:read.",
    path: "/api/public/communiqate/channels",
    input: {
      type: z.enum(["whatsapp", "instagram"]).optional(),
      page,
      perPage,
    },
    rename: { type: "filter[type]", perPage: "per_page" },
  });

  registerApiTool(server, client, {
    name: "communiqate-list-whatsapp-accounts",
    description:
      "List the WhatsApp accounts (numbers) of the CommuniQate workspace, with quality and limits (GET /api/public/communiqate/whatsapp-accounts). The id is needed for the template tools. Scope: communiqate:read.",
    path: "/api/public/communiqate/whatsapp-accounts",
    input: { page, perPage },
    rename: { perPage: "per_page" },
  });

  registerApiTool(server, client, {
    name: "communiqate-list-templates",
    description:
      "List the WhatsApp message templates of a WhatsApp account with name, language, category, status (approved, pending, rejected) and components (GET /api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates). Only approved templates can be sent. Scope: communiqate:read.",
    path: "/api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates",
    input: { whatsappAccount: id("WhatsApp account"), page, perPage },
    rename: { perPage: "per_page" },
  });

  registerApiTool(server, client, {
    name: "communiqate-get-template",
    description:
      "Get one WhatsApp message template with its components and variables (GET /api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates/{messageTemplate}). Scope: communiqate:read.",
    path: "/api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates/{messageTemplate}",
    input: { whatsappAccount: id("WhatsApp account"), messageTemplate: id("Message template") },
  });

  registerApiTool(server, client, {
    name: "communiqate-create-template",
    description:
      "Create a WhatsApp message template on a WhatsApp account (POST /api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates). Pass the CommuniQate template fields in template (name, language, category, components, submit_to_whatsapp: true to send it to Meta for review at once). Scope: communiqate-admin:write.",
    method: "POST",
    path: "/api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates",
    input: {
      whatsappAccount: id("WhatsApp account"),
      name: z.string().min(1).describe("Template name: lowercase letters, digits and underscores."),
      language: z.string().min(2).describe("Language code, for example nl or en_US."),
      category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).describe("Meta template category."),
      components: z.array(z.record(z.string(), z.unknown())).describe("Meta-style components: HEADER, BODY, FOOTER, BUTTONS."),
      submit_to_whatsapp: z.boolean().optional().describe("Submit to Meta for review in the same call."),
    },
  });

  registerApiTool(server, client, {
    name: "communiqate-update-template",
    description:
      "Change a draft, rejected or paused WhatsApp template; components replaces them all (PATCH /api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates/{messageTemplate}). Scope: communiqate-admin:write.",
    method: "PATCH",
    path: "/api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates/{messageTemplate}",
    input: {
      whatsappAccount: id("WhatsApp account"),
      messageTemplate: id("Message template"),
      category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
      components: z.array(z.record(z.string(), z.unknown())).optional(),
    },
  });

  registerApiTool(server, client, {
    name: "communiqate-submit-template",
    description:
      "Submit a draft, rejected or paused WhatsApp template to Meta for review (POST /api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates/{messageTemplate}/submit). Scope: communiqate-admin:write.",
    method: "POST",
    path: "/api/public/communiqate/whatsapp-accounts/{whatsappAccount}/message-templates/{messageTemplate}/submit",
    input: { whatsappAccount: id("WhatsApp account"), messageTemplate: id("Message template") },
  });

  registerApiTool(server, client, {
    name: "communiqate-search-contacts",
    description:
      "Search CommuniQate contacts by text, phone or email (GET /api/public/communiqate/contacts). Phone numbers in international format, for example +31612345678. Scope: communiqate:read.",
    path: "/api/public/communiqate/contacts",
    input: {
      search: z.string().optional().describe("Free text: name, phone or email."),
      phone: z.string().optional(),
      email: z.string().optional(),
      inList: z.string().optional().describe("Contact list id."),
      page,
      perPage,
    },
    rename: {
      search: "filter[search]",
      phone: "filter[phone]",
      email: "filter[email]",
      inList: "filter[in_list]",
      perPage: "per_page",
    },
  });

  registerApiTool(server, client, {
    name: "communiqate-get-contact",
    description: "Get one CommuniQate contact with its fields (GET /api/public/communiqate/contacts/{contact}). Scope: communiqate:read.",
    path: "/api/public/communiqate/contacts/{contact}",
    input: { contact: id("Contact") },
  });

  registerApiTool(server, client, {
    name: "communiqate-create-contact",
    description: "Create a CommuniQate contact (POST /api/public/communiqate/contacts). Scope: communiqate:write.",
    method: "POST",
    path: "/api/public/communiqate/contacts",
    input: {
      phone: z.string().min(5).describe("International format, for example +31612345678."),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      language: z.string().optional(),
      marketing_consent: z.boolean().optional(),
      contact_list_ids: z.array(z.string()).optional(),
    },
  });

  registerApiTool(server, client, {
    name: "communiqate-update-contact",
    description: "Change a CommuniQate contact; fields you leave out stay as they are (PATCH /api/public/communiqate/contacts/{contact}). Scope: communiqate:write.",
    method: "PATCH",
    path: "/api/public/communiqate/contacts/{contact}",
    input: {
      contact: id("Contact"),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().nullable().optional(),
      language: z.string().optional(),
      marketing_consent: z.boolean().optional(),
      blocked: z.boolean().optional(),
    },
  });

  registerApiTool(server, client, {
    name: "communiqate-set-contact-field",
    description:
      "Set one custom field (meta field) of a CommuniQate contact; null removes the value (PUT /api/public/communiqate/contacts/{contact}/meta-fields/{metaField}). Scope: communiqate:write.",
    method: "PUT",
    path: "/api/public/communiqate/contacts/{contact}/meta-fields/{metaField}",
    input: { contact: id("Contact"), metaField: id("Meta field"), value: z.unknown().describe("The new value, or null.") },
  });

  registerApiTool(server, client, {
    name: "communiqate-add-contact-to-list",
    description: "Add a CommuniQate contact to a contact list (POST /api/public/communiqate/contacts/{contact}/lists/{contactList}). Scope: communiqate:write.",
    method: "POST",
    path: "/api/public/communiqate/contacts/{contact}/lists/{contactList}",
    input: { contact: id("Contact"), contactList: id("Contact list") },
  });

  registerApiTool(server, client, {
    name: "communiqate-remove-contact-from-list",
    description: "Remove a CommuniQate contact from a contact list (DELETE /api/public/communiqate/contacts/{contact}/lists/{contactList}). Scope: communiqate:write.",
    method: "DELETE",
    path: "/api/public/communiqate/contacts/{contact}/lists/{contactList}",
    input: { contact: id("Contact"), contactList: id("Contact list") },
  });

  registerApiTool(server, client, {
    name: "communiqate-list-fields",
    description: "List the custom contact fields (meta fields) of the CommuniQate workspace (GET /api/public/communiqate/meta-fields). Scope: communiqate:read.",
    path: "/api/public/communiqate/meta-fields",
    input: { page, perPage },
    rename: { perPage: "per_page" },
  });

  registerApiTool(server, client, {
    name: "communiqate-create-field",
    description: "Create a custom contact field in CommuniQate (POST /api/public/communiqate/meta-fields). Scope: communiqate-admin:write.",
    method: "POST",
    path: "/api/public/communiqate/meta-fields",
    input: {
      name: z.string().min(1),
      type: z.string().optional().describe("Field type as CommuniQate names it, for example text, number, date or datetime."),
    },
  });

  registerApiTool(server, client, {
    name: "communiqate-update-field",
    description: "Rename a custom contact field in CommuniQate (PATCH /api/public/communiqate/meta-fields/{metaField}). Scope: communiqate-admin:write.",
    method: "PATCH",
    path: "/api/public/communiqate/meta-fields/{metaField}",
    input: { metaField: id("Meta field"), name: z.string().min(1) },
  });

  registerApiTool(server, client, {
    name: "communiqate-delete-field",
    description:
      "Delete a custom contact field in CommuniQate: its value goes from every contact and automations that use it can break (DELETE /api/public/communiqate/meta-fields/{metaField}). Scope: communiqate-admin:write.",
    method: "DELETE",
    path: "/api/public/communiqate/meta-fields/{metaField}",
    input: { metaField: id("Meta field") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "communiqate-list-conversations",
    description:
      "List WhatsApp conversations in CommuniQate, newest first, paged by cursor (GET /api/public/communiqate/conversations). Filter on text, open or closed, open service window. Scope: communiqate:read.",
    path: "/api/public/communiqate/conversations",
    input: {
      search: z.string().optional().describe("Free text: contact name, phone or message text."),
      closed: z.boolean().optional(),
      serviceWindowOpen: z.boolean().optional().describe("Only conversations where free text may still be sent (24-hour window)."),
      include: z.string().optional().describe("Related data to embed, for example contact."),
      cursor,
      perPage,
    },
    rename: {
      search: "filter[search]",
      closed: "filter[closed]",
      serviceWindowOpen: "filter[service_window_open]",
      perPage: "per_page",
    },
  });

  registerApiTool(server, client, {
    name: "communiqate-get-conversation",
    description: "Get one CommuniQate conversation with its contact, labels, operators and service window state (GET /api/public/communiqate/conversations/{conversation}). Scope: communiqate:read.",
    path: "/api/public/communiqate/conversations/{conversation}",
    input: { conversation: id("Conversation"), include: z.string().optional() },
  });

  registerApiTool(server, client, {
    name: "communiqate-start-conversation",
    description: `Start (or reuse) the conversation with a phone number, email or contact id and send a first message on a channel (POST /api/public/communiqate/conversations). Outside the 24-hour service window only an approved template can be sent. ${sends} Scope: communiqate:write.`,
    method: "POST",
    path: "/api/public/communiqate/conversations",
    input: {
      channel_id: id("Channel").describe("Channel id from communiqate-list-channels."),
      identifier: z.string().min(1).describe("Phone number in international format, email address or contact id."),
      message: messageBody,
      contact: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Contact details for a new contact, for example {first_name, last_name}."),
    },
    readOnly: false,
  });

  registerApiTool(server, client, {
    name: "communiqate-update-conversation",
    description:
      "Close or reopen a CommuniQate conversation, replace its labels or operators, or switch automations on or off (PATCH /api/public/communiqate/conversations/{conversation}). Scope: communiqate:write.",
    method: "PATCH",
    path: "/api/public/communiqate/conversations/{conversation}",
    input: {
      conversation: id("Conversation"),
      closed: z.boolean().optional(),
      label_ids: z.array(z.string()).optional().describe("Replaces all labels."),
      operator_ids: z.array(z.string()).optional().describe("Replaces all assigned team members."),
      automations_enabled: z.boolean().optional(),
    },
  });

  registerApiTool(server, client, {
    name: "communiqate-list-messages",
    description:
      "List the messages of a CommuniQate conversation, paged by cursor, with type, text, status and sender (GET /api/public/communiqate/conversations/{conversation}/messages). Scope: communiqate:read.",
    path: "/api/public/communiqate/conversations/{conversation}/messages",
    input: {
      conversation: id("Conversation"),
      inbound: z.boolean().optional().describe("true: only messages from the contact; false: only messages sent to them."),
      cursor,
      perPage,
    },
    rename: { inbound: "filter[inbound]", perPage: "per_page" },
  });

  registerApiTool(server, client, {
    name: "communiqate-get-message",
    description: "Get one CommuniQate message with its current status (GET /api/public/communiqate/conversations/{conversation}/messages/{message}). Scope: communiqate:read.",
    path: "/api/public/communiqate/conversations/{conversation}/messages/{message}",
    input: { conversation: id("Conversation"), message: id("Message") },
  });

  registerApiTool(server, client, {
    name: "communiqate-send-message",
    description: `Send a message in an existing CommuniQate conversation: text inside the 24-hour service window, or media by file_id (POST /api/public/communiqate/conversations/{conversation}/messages). ${sends} Scope: communiqate:write.`,
    method: "POST",
    path: "/api/public/communiqate/conversations/{conversation}/messages",
    input: {
      conversation: id("Conversation"),
      type: z.enum(["text", "image", "video", "audio", "document", "location", "whatsapp_interactive"]),
      text: z.string().optional().describe("The text, for type text (at most 2024 characters on WhatsApp)."),
      image: z.record(z.string(), z.unknown()).optional().describe("{file_id, caption} for type image."),
      video: z.record(z.string(), z.unknown()).optional(),
      audio: z.record(z.string(), z.unknown()).optional(),
      document: z.record(z.string(), z.unknown()).optional().describe("{file_id, caption, filename} for type document."),
      location: z.record(z.string(), z.unknown()).optional(),
      whatsapp_interactive: z.record(z.string(), z.unknown()).optional(),
      channel_id: z.string().optional().describe("Defaults to the reply channel of the conversation."),
    },
    readOnly: false,
  });

  registerApiTool(server, client, {
    name: "communiqate-send-template",
    description: `Send an approved WhatsApp template in an existing CommuniQate conversation; works outside the 24-hour service window (POST /api/public/communiqate/conversations/{conversation}/messages). Look up the name and its variables with communiqate-list-templates. ${sends} Scope: communiqate:write.`,
    method: "POST",
    path: "/api/public/communiqate/conversations/{conversation}/messages",
    input: {
      conversation: id("Conversation"),
      type: z.literal("whatsapp_template").default("whatsapp_template"),
      whatsapp_template: z
        .object({
          message_template: z.string().min(1).describe("Template name."),
          components: z
            .array(z.record(z.string(), z.unknown()))
            .optional()
            .describe('Meta-style parameters, for example [{"type": "body", "parameters": [{"type": "text", "text": "Pieter"}]}].'),
        })
        .describe("The template and its parameters."),
      channel_id: z.string().optional(),
    },
    readOnly: false,
  });

  registerApiTool(server, client, {
    name: "communiqate-show-typing",
    description:
      "Show the contact that a reply is on its way (WhatsApp only), for an inbound message (POST /api/public/communiqate/conversations/{conversation}/typing-indicator). Scope: communiqate:write.",
    method: "POST",
    path: "/api/public/communiqate/conversations/{conversation}/typing-indicator",
    input: { conversation: id("Conversation"), message_id: id("Inbound message") },
    readOnly: false,
  });

  registerApiTool(server, client, {
    name: "communiqate-upload-file",
    description:
      "Upload media to CommuniQate and get its file_id for an image, video, audio or document message (POST /api/public/communiqate/files). Pass a public HTTPS url Zentria downloads, or content_base64 with filename. Up to 25 MB. Scope: communiqate:write.",
    method: "POST",
    path: "/api/public/communiqate/files",
    input: {
      url: z.string().url().optional().describe("Public HTTPS URL of the file."),
      content_base64: z.string().optional().describe("The file contents, base64 encoded."),
      filename: z.string().optional().describe("File name, required with content_base64."),
      mime_type: z.string().optional(),
    },
    readOnly: false,
  });
}
