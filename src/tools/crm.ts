import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import {
  encodePathSegment,
  paginationQuery,
  paginationSchema,
  registerApiTool,
  registerJsonTool,
} from "./_shared.js";

export function registerCrmTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-crm-leads",
    {
      description:
        "List CRM leads of the team, newest first (GET /api/public/crm/leads). Each lead has its contact details, customer and campaign, source (elementor, voys or mail), review status, lead value (leadValueCents in euro cents plus category key and label, null until classified), billing period and invoice (isInvoiced, invoiceId, invoiceNumber, invoiceStatus, invoicedAmountCents). Use list-crm-lead-value-categories for the category tariffs. The werkbak queues are filters here: needsExtraCheck, workbenchQueue, rejectedByType and rejectionConfirmed. Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...paginationSchema,
        reviewStatus: z
          .enum(["open", "approved", "rejected", "reclamation"])
          .optional()
          .describe("Only leads with this review status."),
        firstSeenAfter: z
          .string()
          .optional()
          .describe("ISO-8601 datetime. Only leads first seen at or after this instant."),
        firstSeenBefore: z
          .string()
          .optional()
          .describe("ISO-8601 datetime. Only leads first seen at or before this instant."),
        customerId: z.number().int().positive().optional().describe("Only leads of this customer."),
        campaignId: z.number().int().positive().optional().describe("Only leads of this campaign."),
        source: z
          .enum(["elementor", "voys", "mail"])
          .optional()
          .describe("Where the lead first came in: elementor (form), voys (phone) or mail."),
        leadValueCategory: z
          .string()
          .optional()
          .describe(
            "Lead value category key (see list-crm-lead-value-categories), or unclassified (no value yet) or other (classified without a category).",
          ),
        invoiced: z
          .boolean()
          .optional()
          .describe("true for leads that are on an invoice, false for leads that are not."),
        needsExtraCheck: z
          .boolean()
          .optional()
          .describe(
            "true for the extra-check queue: rejected by AI or the system, with a lead value category, not yet confirmed. false for all other leads.",
          ),
        workbenchQueue: z
          .enum(["ai_rejected", "reclamations"])
          .optional()
          .describe(
            "Only the leads of one werkbak queue. ai_rejected leaves out spam and out-of-category leads unless includeSpam or includeOutOfCategory is true.",
          ),
        includeSpam: z.boolean().optional().describe("With workbenchQueue ai_rejected: also spam-like leads."),
        includeOutOfCategory: z
          .boolean()
          .optional()
          .describe("With workbenchQueue ai_rejected: also leads outside the categories the customer takes."),
        rejectedByType: z
          .enum(["ai", "system", "agency", "customer"])
          .optional()
          .describe("Only leads rejected by this actor."),
        rejectionConfirmed: z
          .boolean()
          .optional()
          .describe("true for leads where a person confirmed the rejection, false for leads where nobody did."),
        lastSeenAfter: z
          .string()
          .optional()
          .describe("ISO-8601 datetime. Only leads last seen at or after this instant."),
        lastSeenBefore: z
          .string()
          .optional()
          .describe("ISO-8601 datetime. Only leads last seen at or before this instant."),
        sortBy: z
          .enum(["id", "firstSeenAt", "lastSeenAt", "name", "email", "phone"])
          .optional()
          .describe("Sort column. Default id (newest first)."),
        sortDirection: z.enum(["asc", "desc"]).optional().describe("Sort direction. Default desc."),
      }),
    },
    async (input) =>
      client.request({
        path: "/api/public/crm/leads",
        query: {
          ...paginationQuery(input),
          reviewStatus: input.reviewStatus,
          "firstSeenAt[after]": input.firstSeenAfter,
          "firstSeenAt[before]": input.firstSeenBefore,
          customerId: input.customerId,
          campaignId: input.campaignId,
          source: input.source,
          leadValueCategory: input.leadValueCategory,
          invoiced: input.invoiced,
          needsExtraCheck: input.needsExtraCheck,
          workbenchQueue: input.workbenchQueue,
          includeSpam: input.includeSpam,
          includeOutOfCategory: input.includeOutOfCategory,
          rejectedByType: input.rejectedByType,
          rejectionConfirmed: input.rejectionConfirmed,
          "lastSeenAt[after]": input.lastSeenAfter,
          "lastSeenAt[before]": input.lastSeenBefore,
          sortBy: input.sortBy,
          sortDirection: input.sortDirection,
        },
      }),
  );

  registerJsonTool(
    server,
    "get-crm-lead",
    {
      description:
        "Fetch one CRM lead with its lead value, category label, billing period, invoice, AI summary, rejection details and the category keys its customer takes (allowedLeadValueCategoryKeys) (GET /api/public/crm/leads/{id}). Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("CRM lead id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/crm/leads/${encodePathSegment(input.id)}` }),
  );

  registerApiTool(server, client, {
    name: "approve-crm-lead",
    description:
      "Approve a CRM lead (POST /api/public/crm/leads/{id}/approve). Optionally give a reason, a reasonPresetKey and an addCategoryKey: matches_services needs addCategoryKey, other needs a reason. Same checks as the werkbak. Scope: crm:write.",
    method: "POST",
    path: "/api/public/crm/leads/{id}/approve",
    input: {
      id: z.number().int().positive().describe("CRM lead id."),
      reason: z.string().max(5000).optional().describe("Why the lead is approved. Required when reasonPresetKey is other."),
      reasonPresetKey: z
        .enum([
          "ai_incorrect",
          "valid_inquiry",
          "contact_reached",
          "matches_services",
          "missing_category",
          "reclamation_upheld",
          "other",
        ])
        .optional()
        .describe("Reason preset."),
      addCategoryKey: z
        .string()
        .optional()
        .describe(
          "Lead value category key (see list-crm-lead-value-categories) to give the lead and add to the customer allowed categories. Required for matches_services.",
        ),
    },
  });

  registerApiTool(server, client, {
    name: "reject-crm-lead",
    description:
      "Reject a CRM lead (POST /api/public/crm/leads/{id}/reject). A reason is required. Scope: crm:write.",
    method: "POST",
    path: "/api/public/crm/leads/{id}/reject",
    input: {
      id: z.number().int().positive().describe("CRM lead id."),
      reason: z.string().min(1).max(5000).describe("Why the lead is rejected."),
      reasonPresetKey: z
        .enum(["duplicate", "invalid_contact", "spam", "wrong_category", "test", "other"])
        .optional()
        .describe("Reason preset. Default other."),
    },
  });

  registerApiTool(server, client, {
    name: "confirm-crm-lead-rejection",
    description:
      "Confirm that a rejection by AI or the system was right; the lead leaves the extra-check queue (POST /api/public/crm/leads/{id}/confirm-rejection). Scope: crm:write.",
    method: "POST",
    path: "/api/public/crm/leads/{id}/confirm-rejection",
    input: {
      id: z.number().int().positive().describe("CRM lead id."),
      reason: z.string().max(5000).optional().describe("Optional note. Defaults to the standard confirmation text."),
      reasonPresetKey: z
        .enum([
          "duplicate",
          "invalid_contact",
          "spam",
          "wrong_category",
          "test",
          "other",
          "ai_incorrect",
          "valid_inquiry",
          "contact_reached",
          "matches_services",
          "missing_category",
          "reclamation_upheld",
        ])
        .optional()
        .describe("Reason preset."),
    },
  });

  registerApiTool(server, client, {
    name: "dismiss-crm-lead-reclamation",
    description:
      "Dismiss a reclamation: the lead goes back to approved (POST /api/public/crm/leads/{id}/dismiss-reclamation). Scope: crm:write.",
    method: "POST",
    path: "/api/public/crm/leads/{id}/dismiss-reclamation",
    input: {
      id: z.number().int().positive().describe("CRM lead id."),
      reason: z.string().max(5000).optional().describe("Optional note. Defaults to the standard dismissal text."),
    },
  });

  registerApiTool(server, client, {
    name: "set-crm-lead-value",
    description:
      "Set the lead value category of a CRM lead; the amount follows from the category and customer prices (PUT /api/public/crm/leads/{id}/lead-value). Not possible for a lead that is on an invoice. Scope: crm-values:write.",
    method: "PUT",
    path: "/api/public/crm/leads/{id}/lead-value",
    input: {
      id: z.number().int().positive().describe("CRM lead id."),
      categoryKey: z
        .string()
        .nullable()
        .describe(
          "Category key from list-crm-lead-value-categories, or other (or null) for a classified lead without a category.",
        ),
    },
  });

  registerApiTool(server, client, {
    name: "delete-crm-lead",
    description: "Delete a CRM lead (DELETE /api/public/crm/leads/{id}). Scope: crm:delete.",
    method: "DELETE",
    path: "/api/public/crm/leads/{id}",
    input: { id: z.number().int().positive().describe("CRM lead id.") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "list-crm-lead-review-events",
    description:
      "List the review history of a CRM lead, newest first: status changes with actor, user, reason and preset (GET /api/public/crm/leads/{leadId}/review-events). Scope: crm:read.",
    path: "/api/public/crm/leads/{leadId}/review-events",
    input: {
      leadId: z.number().int().positive().describe("CRM lead id."),
      page: z.number().int().min(1).optional().describe("Page number (default 1)."),
      itemsPerPage: z.number().int().min(1).max(100).optional().describe("Items per page (default 25, max 100)."),
    },
  });

  registerJsonTool(
    server,
    "list-crm-lead-value-categories",
    {
      description:
        "List the lead value categories of the team with the amount in euro cents a new CRM lead in that category is worth (GET /api/public/crm/lead-value-categories). The row with key other and isDefault true is the default amount for classified leads that fit no category. Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({}),
    },
    async () => client.request({ path: "/api/public/crm/lead-value-categories" }),
  );

  registerApiTool(server, client, {
    name: "list-crm-submissions",
    description:
      "List CRM lead submissions (form posts, phone calls and mails), newest first (GET /api/public/crm/submissions). Filter on source, status, authenticity, customer, campaign, lead and received date. The list leaves out the raw payload; use get-crm-submission for that. Scope: crm:read.",
    path: "/api/public/crm/submissions",
    input: {
      ...paginationSchema,
      customerId: z.number().int().positive().optional().describe("Only submissions of this customer."),
      campaignId: z.number().int().positive().optional().describe("Only submissions of this campaign."),
      leadId: z.number().int().positive().optional().describe("Only submissions linked to this CRM lead."),
      source: z.enum(["elementor", "voys", "mail"]).optional().describe("Where the submission came in."),
      status: z
        .string()
        .optional()
        .describe("One or more statuses, comma separated: unhandled, new, duplicate, test, failed, spam, pending."),
      authenticity: z.string().optional().describe("One or more of real, spam, comma separated."),
      receivedAfter: z.string().optional().describe("ISO-8601 datetime. Only submissions received at or after it."),
      receivedBefore: z.string().optional().describe("ISO-8601 datetime. Only submissions received at or before it."),
      sortBy: z
        .enum(["id", "receivedAt", "name", "email", "phone", "status", "source"])
        .optional()
        .describe("Sort column. Default id (newest first)."),
      sortDirection: z.enum(["asc", "desc"]).optional().describe("Sort direction. Default desc."),
    },
    rename: { receivedAfter: "receivedAt[after]", receivedBefore: "receivedAt[before]" },
  });

  registerApiTool(server, client, {
    name: "get-crm-submission",
    description:
      "Fetch a CRM lead submission with its raw payload, transcript, AI extraction, duplicate match and the actions the web offers (actions.markAsReal, markAsSpam, retryProcessing with a blockReason when not allowed) (GET /api/public/crm/submissions/{id}). Scope: crm:read.",
    path: "/api/public/crm/submissions/{id}",
    input: { id: z.number().int().positive().describe("Submission id.") },
  });

  registerApiTool(server, client, {
    name: "mark-crm-submission-as-real",
    description:
      "Mark a submission that was flagged as spam as real and process it again (POST /api/public/crm/submissions/{id}/mark-as-real). Fails when the submission cannot be restored. Scope: crm:write.",
    method: "POST",
    path: "/api/public/crm/submissions/{id}/mark-as-real",
    input: { id: z.number().int().positive().describe("Submission id.") },
  });

  registerApiTool(server, client, {
    name: "mark-crm-submission-as-spam",
    description:
      "Mark a submission as spam: it is unlinked from its lead (the lead is removed when it was the only submission) and mail moves to the spam folder (POST /api/public/crm/submissions/{id}/mark-as-spam). Scope: crm:write.",
    method: "POST",
    path: "/api/public/crm/submissions/{id}/mark-as-spam",
    input: { id: z.number().int().positive().describe("Submission id.") },
  });

  registerApiTool(server, client, {
    name: "retry-crm-submission-processing",
    description:
      "Process a failed form submission again (POST /api/public/crm/submissions/{id}/retry-processing). Fails when the submission is not a failed form post. Scope: crm:write.",
    method: "POST",
    path: "/api/public/crm/submissions/{id}/retry-processing",
    input: { id: z.number().int().positive().describe("Submission id.") },
  });

  registerApiTool(server, client, {
    name: "delete-crm-submission",
    description: "Delete a CRM lead submission (DELETE /api/public/crm/submissions/{id}). Scope: crm:delete.",
    method: "DELETE",
    path: "/api/public/crm/submissions/{id}",
    input: { id: z.number().int().positive().describe("Submission id.") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "list-crm-callbacks",
    description:
      "List callbacks for missed calls (the terugbellen screen), newest missed call first (GET /api/public/crm/callbacks). Status is missed (open), called_back, never_called_back or called_not_reached. Callbacks are created and closed by the system from Voys calls, there is nothing to resolve by hand. Needs the view-workbench permission. Scope: crm:read.",
    path: "/api/public/crm/callbacks",
    input: {
      ...paginationSchema,
      status: z
        .enum(["all", "missed", "called_back", "never_called_back", "called_not_reached"])
        .optional()
        .describe("Callback status. Default all."),
      customerId: z.number().int().positive().optional().describe("Only callbacks of this customer."),
      campaignId: z.number().int().positive().optional().describe("Only callbacks of this campaign."),
      leadId: z.number().int().positive().optional().describe("Only callbacks of this CRM lead."),
      dateFrom: z.string().optional().describe("Date YYYY-MM-DD. Only calls missed on or after this day."),
      dateTo: z.string().optional().describe("Date YYYY-MM-DD. Only calls missed on or before this day."),
      sortBy: z.enum(["missedAt", "customer", "dueAt"]).optional().describe("Sort column. Default missedAt."),
      sortDirection: z.enum(["asc", "desc"]).optional().describe("Sort direction. Default desc."),
    },
  });

  registerApiTool(server, client, {
    name: "get-crm-callback",
    description:
      "Fetch one callback with its lead, customer, campaign, attempts and timing (GET /api/public/crm/callbacks/{id}). Needs the view-workbench permission. Scope: crm:read.",
    path: "/api/public/crm/callbacks/{id}",
    input: { id: z.number().int().positive().describe("Callback id.") },
  });

  registerApiTool(server, client, {
    name: "get-crm-callback-summary",
    description:
      "Callback counts per status and the average time to call back (GET /api/public/crm/callbacks/summary). Takes the same filters as list-crm-callbacks except status. Needs the view-workbench permission. Scope: crm:read.",
    path: "/api/public/crm/callbacks/summary",
    input: {
      q: z.string().optional().describe("Search text."),
      customerId: z.number().int().positive().optional().describe("Only callbacks of this customer."),
      campaignId: z.number().int().positive().optional().describe("Only callbacks of this campaign."),
      leadId: z.number().int().positive().optional().describe("Only callbacks of this CRM lead."),
      dateFrom: z.string().optional().describe("Date YYYY-MM-DD."),
      dateTo: z.string().optional().describe("Date YYYY-MM-DD."),
    },
  });

  registerApiTool(server, client, {
    name: "get-crm-workbench",
    description:
      "The werkbak of the team: three queues (leads rejected by AI or the system, reclamations, open callbacks; up to 100 each) with counts and the number of open AI rule proposals (GET /api/public/crm/workbench). Act on leads with approve-crm-lead, reject-crm-lead, confirm-crm-lead-rejection and dismiss-crm-lead-reclamation. Needs the view-workbench permission. Scope: crm:read.",
    path: "/api/public/crm/workbench",
    input: {
      includeSpam: z.boolean().optional().describe("Also show rejected leads that look like spam."),
      includeOutOfCategory: z
        .boolean()
        .optional()
        .describe("Also show rejected leads outside the categories the customer takes."),
    },
  });

  registerApiTool(server, client, {
    name: "list-crm-ai-rule-proposals",
    description:
      "List the AI rule proposals that wait for a decision on the werkbak: pending, or failed to generate (GET /api/public/crm/ai-rule-proposals). Needs the view-workbench permission. Scope: crm:read.",
    path: "/api/public/crm/ai-rule-proposals",
    input: {
      page: z.number().int().min(1).optional().describe("Page number (default 1)."),
      itemsPerPage: z.number().int().min(1).max(100).optional().describe("Items per page (default 50, max 100)."),
    },
  });

  registerApiTool(server, client, {
    name: "get-crm-ai-rule-proposal",
    description:
      "Fetch one AI rule proposal (GET /api/public/crm/ai-rule-proposals/{id}). Scope: crm:read.",
    path: "/api/public/crm/ai-rule-proposals/{id}",
    input: { id: z.number().int().positive().describe("Proposal id.") },
  });

  registerApiTool(server, client, {
    name: "confirm-crm-ai-rule-proposal",
    description:
      "Confirm a pending AI rule proposal: the text is added to the whitelist, blacklist, category hints or authenticity notes it targets (POST /api/public/crm/ai-rule-proposals/{id}/confirm). Scope: crm:write.",
    method: "POST",
    path: "/api/public/crm/ai-rule-proposals/{id}/confirm",
    input: {
      id: z.number().int().positive().describe("Proposal id."),
      text: z.string().min(1).max(5000).describe("The final wording of the rule."),
      categoryKey: z
        .string()
        .optional()
        .describe("Point the rule at another lead value category (whitelist, blacklist and category hints only)."),
    },
  });

  registerApiTool(server, client, {
    name: "discard-crm-ai-rule-proposal",
    description:
      "Discard a pending or failed AI rule proposal (POST /api/public/crm/ai-rule-proposals/{id}/discard). Scope: crm:write.",
    method: "POST",
    path: "/api/public/crm/ai-rule-proposals/{id}/discard",
    input: { id: z.number().int().positive().describe("Proposal id.") },
  });

  registerJsonTool(
    server,
    "list-crm-calls",
    {
      description:
        "List Voys phone calls of the team, newest first (GET /api/public/crm/calls). Each call has direction, answered, outcome, duration, numbers, AI summary and the linked lead id. Use get-crm-call for the transcript. Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...paginationSchema,
        q: z.string().optional().describe("Search by caller name or phone number."),
        receivedAfter: z
          .string()
          .optional()
          .describe("ISO-8601 datetime. Only calls that started at or after this instant."),
        receivedBefore: z
          .string()
          .optional()
          .describe("ISO-8601 datetime. Only calls that started at or before this instant."),
        customerId: z.number().int().positive().optional().describe("Only calls for this customer."),
        campaignId: z.number().int().positive().optional().describe("Only calls for this campaign."),
        leadId: z.number().int().positive().optional().describe("Only calls linked to this CRM lead."),
        outcome: z
          .enum(["live_conversation", "voicemail", "busy", "unavailable", "machine", "missed"])
          .optional()
          .describe("Call outcome. missed means nobody answered."),
        direction: z.enum(["incoming", "outgoing"]).optional().describe("Call direction."),
        answered: z.boolean().optional().describe("true for answered calls, false for unanswered calls."),
        phone: z.string().optional().describe("Partial phone number of the caller or the number called."),
      }),
    },
    async (input) =>
      client.request({
        path: "/api/public/crm/calls",
        query: {
          ...paginationQuery(input),
          "receivedAt[after]": input.receivedAfter,
          "receivedAt[before]": input.receivedBefore,
          customerId: input.customerId,
          campaignId: input.campaignId,
          leadId: input.leadId,
          outcome: input.outcome,
          direction: input.direction,
          answered: input.answered,
          phone: input.phone,
        },
      }),
  );

  registerJsonTool(
    server,
    "get-crm-call",
    {
      description:
        "Fetch one Voys phone call with its transcript, AI summary and linked CRM lead (GET /api/public/crm/calls/{id}). Scope: crm:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Call id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/crm/calls/${encodePathSegment(input.id)}` }),
  );
}
