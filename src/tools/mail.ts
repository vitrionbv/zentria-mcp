import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { paginationSchema, registerApiTool } from "./_shared.js";

/**
 * Outgoing mail of the team. Every tool name starts with `mail-`. Mail goes out through the team's own SMTP
 * account (mail account) or, when the team has none, through Zentria (zentria@updates.vitrion.nl).
 */

const page = { page: paginationSchema.page, itemsPerPage: paginationSchema.itemsPerPage };

const recipient = z.union([
  z.string().email(),
  z.object({
    email: z.string().email(),
    name: z.string().min(1).optional().describe("Display name (not used yet: the mail goes to the address)."),
  }),
]);

const recipients = (what: string) =>
  z.array(recipient).describe(`${what}: email addresses, or {email, name}. At most 50 recipients in to, cc and bcc together.`);

/** Tools for the team's mail accounts and sent mail. */
export function registerMailTools(server: McpServer, client: ZentriaClient): void {
  registerApiTool(server, client, {
    name: "mail-list-accounts",
    description:
      "List the team's own mail accounts (SMTP) with from address, from name, reply-to, default and active flags, whether a password is set, verified and last used time and last error (GET /api/public/mail/accounts). Passwords are never returned. An empty list means the team has no own account and mail goes out via Zentria (zentria@updates.vitrion.nl). Scope: mail:read.",
    path: "/api/public/mail/accounts",
    input: { ...page },
  });

  registerApiTool(server, client, {
    name: "mail-get-account",
    description: "Get one mail account of the team (GET /api/public/mail/accounts/{id}). The password is never returned. Scope: mail:read.",
    path: "/api/public/mail/accounts/{id}",
    input: { id: z.number().int().positive().describe("Mail account id from mail-list-accounts.") },
  });

  registerApiTool(server, client, {
    name: "mail-send",
    description:
      "Send an email (POST /api/public/mail/messages). Sends a real email to the customer from the team's own address (the given account, else the team's default account, else via Zentria): confirm the recipients, subject and text with the user first. Pass an idempotencyKey (for example a UUID) and reuse it when you retry: the same key returns the same message and nothing is sent twice. Give html, text or both. No attachments. Returns the queued message; check its status later with mail-get-message (sent means accepted by the mail server, bounces are not tracked). Scope: mail:write.",
    method: "POST",
    path: "/api/public/mail/messages",
    input: {
      idempotencyKey: z
        .string()
        .min(1)
        .max(191)
        .optional()
        .describe("Sent as the Idempotency-Key header. Reuse the same key on a retry so the mail is not sent twice."),
      accountId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Mail account id from mail-list-accounts. Leave out for the team's default account, or Zentria when the team has none."),
      to: recipients("Recipients").min(1),
      cc: recipients("Cc").optional(),
      bcc: recipients("Bcc").optional(),
      replyTo: z.string().email().optional().describe("Reply-to address, overrides the account's reply-to."),
      fromName: z.string().min(1).max(120).optional().describe("Display name of the sender for this mail only."),
      subject: z.string().min(1).max(998),
      html: z.string().min(1).optional().describe("HTML body. Give html, text or both."),
      text: z.string().min(1).optional().describe("Plain text body. Give html, text or both."),
      metadata: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional()
        .describe("Your own key/value data stored with the message (at most 20 scalar values), for example {dealId: 12}."),
    },
    headers: { idempotencyKey: "Idempotency-Key" },
    readOnly: false,
  });

  registerApiTool(server, client, {
    name: "mail-get-message",
    description:
      "Get one sent mail with its status (queued, sent, failed), recipients, account or via Zentria, attempts, error and times (GET /api/public/mail/messages/{id}). Bodies (html, text) are only included for mails sent through the API. Sent means accepted by the mail server; bounces are not tracked. Scope: mail:read.",
    path: "/api/public/mail/messages/{id}",
    input: { id: z.number().int().positive().describe("Mail message id.") },
  });

  registerApiTool(server, client, {
    name: "mail-list-messages",
    description:
      "List the mails the team sent, without bodies (GET /api/public/mail/messages). Filter on status, account and source: api, invoice_reminder, weekly_lead_digest, portal_invitation, portal_welcome, portal_password_reset, template_test or account_test. Scope: mail:read.",
    path: "/api/public/mail/messages",
    input: {
      status: z.enum(["queued", "sent", "failed"]).optional(),
      accountId: z.number().int().positive().optional().describe("Only mails sent through this mail account."),
      source: z
        .enum([
          "api",
          "invoice_reminder",
          "weekly_lead_digest",
          "portal_invitation",
          "portal_welcome",
          "portal_password_reset",
          "template_test",
          "account_test",
        ])
        .optional()
        .describe("What sent the mail."),
      ...page,
    },
  });
}
