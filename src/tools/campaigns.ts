import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { paginationSchema, registerApiTool } from "./_shared.js";

const campaignId = z.number().int().positive().describe("Campaign id from list-campaigns.");

const categoryAssignment = z.object({
  key: z
    .string()
    .min(1)
    .describe("Lead value category key from list-crm-lead-value-categories, or other for leads without a category."),
  amountCentsOverride: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional()
    .describe("Value in euro cents that replaces the category amount for this campaign."),
  whitelistText: z
    .string()
    .nullable()
    .optional()
    .describe("Only leads that match this text count for the category. Cannot be combined with blacklistText."),
  blacklistText: z
    .string()
    .nullable()
    .optional()
    .describe("Leads that match this text do not count for the category. Cannot be combined with whitelistText."),
});

const splitGroup = z.object({
  name: z.string().min(1).max(255).describe("Name of the campaign. Must be unique within the customer."),
  keepsSource: z.boolean().describe("True for the one group that stays the original campaign."),
  itemKeys: z
    .array(z.string())
    .describe("Keys of the mailboxes, forms and Voys numbers for this campaign, from context.items of a split proposal. Every item must be in exactly one group."),
  categoryKeys: z.array(z.string()).describe("Lead value category keys this campaign accepts."),
  monthlyAmountCents: z.number().int().min(0).nullable().optional().describe("Monthly amount in euro cents for this campaign."),
});

/** Tools for campaigns and campaign lead value category assignments. */
export function registerCampaignTools(server: McpServer, client: ZentriaClient): void {
  registerApiTool(server, client, {
    name: "list-campaigns",
    description:
      "List campaigns of the team with customer, monthly amount, lead count, archive state, lead value categories and connection counts (GET /api/public/campaigns). Archived campaigns are hidden unless status is archived or all. Scope: campaigns:read.",
    path: "/api/public/campaigns",
    input: {
      q: paginationSchema.q,
      page: paginationSchema.page,
      itemsPerPage: paginationSchema.itemsPerPage,
      customerId: z.number().int().positive().optional().describe("Only campaigns of this customer."),
      status: z.enum(["active", "archived", "all"]).optional().describe("Default active."),
      splitCandidates: z
        .boolean()
        .optional()
        .describe("True: only campaigns that look like several brands in one campaign; splitRoots then lists the brands."),
      sortBy: z.enum(["name", "created_at", "monthly_amount_cents"]).optional(),
      sortDirection: z.enum(["asc", "desc"]).optional(),
    },
  });

  registerApiTool(server, client, {
    name: "get-campaign",
    description:
      "Get a campaign with its lead value category assignments (amount override, whitelist, blacklist), connection counts and the latest split that can be undone (GET /api/public/campaigns/{id}). Scope: campaigns:read.",
    path: "/api/public/campaigns/{id}",
    input: { id: campaignId },
  });

  registerApiTool(server, client, {
    name: "create-campaign",
    description:
      "Add a campaign to a customer (POST /api/public/campaigns). Every customer already has one campaign. Scope: campaigns:write.",
    method: "POST",
    path: "/api/public/campaigns",
    input: {
      customerId: z.number().int().positive().describe("Customer id from list-customers."),
      name: z.string().min(1).max(255),
      monthlyAmountCents: z.number().int().min(0).optional().describe("Monthly amount in euro cents."),
      missingPhoneSharePct: z
        .number()
        .int()
        .min(1)
        .max(99)
        .optional()
        .describe("Share of calls we cannot measure because there is no Voys number, 1 to 99. Lowers the monthly target."),
    },
  });

  registerApiTool(server, client, {
    name: "update-campaign",
    description:
      "Update a campaign: name, monthly amount in euro cents (null clears it), missing phone share and optionally the lead value categories it accepts (PUT /api/public/campaigns/{id}). Fields you leave out stay as they are. allowedLeadValueCategories replaces the whole set. Scope: campaigns:write.",
    method: "PUT",
    path: "/api/public/campaigns/{id}",
    input: {
      id: campaignId,
      name: z.string().min(1).max(255).optional(),
      monthlyAmountCents: z.number().int().min(0).nullable().optional(),
      missingPhoneSharePct: z.number().int().min(1).max(99).nullable().optional(),
      allowedLeadValueCategories: z.array(categoryAssignment).optional(),
    },
  });

  registerApiTool(server, client, {
    name: "delete-campaign",
    description:
      "Delete a campaign (DELETE /api/public/campaigns/{id}). Refused for the last campaign of a customer and for a campaign with leads, submissions or connections; archive it instead. Scope: campaigns:write.",
    method: "DELETE",
    path: "/api/public/campaigns/{id}",
    input: { id: campaignId },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "archive-campaign",
    description:
      "Archive a campaign: its leads and reports stay, it leaves lists, pickers and the dashboard (PATCH /api/public/campaigns/{id}/archive). Refused when the customer is archived. Scope: campaigns:write.",
    method: "PATCH",
    path: "/api/public/campaigns/{id}/archive",
    input: { id: campaignId },
  });

  registerApiTool(server, client, {
    name: "restore-campaign",
    description: "Restore an archived campaign (PATCH /api/public/campaigns/{id}/restore). Scope: campaigns:write.",
    method: "PATCH",
    path: "/api/public/campaigns/{id}/restore",
    input: { id: campaignId },
  });

  registerApiTool(server, client, {
    name: "set-campaign-lead-value-categories",
    description:
      "Replace the lead value categories a campaign accepts, with an optional amount override, whitelist or blacklist per category (PUT /api/public/campaigns/{id}/lead-value-categories). An empty list clears them. Use the key other for leads without a category. Scope: campaigns:write.",
    method: "PUT",
    path: "/api/public/campaigns/{id}/lead-value-categories",
    input: {
      id: campaignId,
      allowedLeadValueCategories: z.array(categoryAssignment).describe("The complete new set."),
    },
  });

  registerApiTool(server, client, {
    name: "propose-campaign-split",
    description:
      "Ask for a proposal to split a campaign into several campaigns, one per brand or website (POST /api/public/campaigns/{id}/split-proposal). Returns groups plus context.items with the key of every mailbox, form and Voys number. It uses AI and falls back to rules; limited to 10 per minute. Changes nothing. Scope: campaigns:write.",
    method: "POST",
    path: "/api/public/campaigns/{id}/split-proposal",
    input: {
      id: campaignId,
      hint: z.string().max(500).optional().describe("Extra instruction for the proposal."),
    },
  });

  registerApiTool(server, client, {
    name: "split-campaign",
    description:
      "Split a campaign into several campaigns (POST /api/public/campaigns/{id}/split). Needs 2 to 20 groups, exactly one with keepsSource true, and every itemKey from propose-campaign-split in exactly one group. Mailboxes, forms and Voys numbers move to the new campaigns; undo with undo-campaign-split. Scope: campaigns:write.",
    method: "POST",
    path: "/api/public/campaigns/{id}/split",
    input: {
      id: campaignId,
      groups: z.array(splitGroup).min(2).max(20),
      proposalSource: z.enum(["ai", "heuristic", "manual"]).optional().describe("Default manual."),
      proposal: z.record(z.string(), z.unknown()).optional().describe("The proposal this plan came from, for the history."),
    },
  });

  registerApiTool(server, client, {
    name: "dismiss-campaign-split",
    description:
      "Stop proposing a campaign as a candidate to split (POST /api/public/campaigns/{id}/split-dismiss). Scope: campaigns:write.",
    method: "POST",
    path: "/api/public/campaigns/{id}/split-dismiss",
    input: { id: campaignId },
  });

  registerApiTool(server, client, {
    name: "get-campaign-split-run",
    description:
      "Get a campaign split and whether it can still be undone (undoBlockReason is null when it can) (GET /api/public/campaign-split-runs/{id}). The id is in latestSplitRun of get-campaign. Scope: campaigns:read.",
    path: "/api/public/campaign-split-runs/{id}",
    input: { id: z.number().int().positive().describe("Split run id.") },
  });

  registerApiTool(server, client, {
    name: "undo-campaign-split",
    description:
      "Undo a campaign split: the new campaigns are removed and their mailboxes, forms and Voys numbers move back (POST /api/public/campaign-split-runs/{id}/undo). Refused after a newer split or an issued invoice. Scope: campaigns:write.",
    method: "POST",
    path: "/api/public/campaign-split-runs/{id}/undo",
    input: { id: z.number().int().positive().describe("Split run id.") },
    destructive: true,
  });
}
