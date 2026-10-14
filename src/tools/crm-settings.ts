import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { registerApiTool } from "./_shared.js";

const categoryKey = z
  .string()
  .min(1)
  .describe(
    "Category key from list-crm-lead-value-categories (letters, numbers, dashes and underscores). The default row other has no category to change.",
  );

const customerRange = z
  .enum(["today", "month", "previous_month", "7", "14", "30", "60", "90", "custom"])
  .optional()
  .describe("Period. Default month (start of this month until now). Use custom with from and to.");

/** Tools for lead value categories and settings, learning rules, CRM dashboard and report reads. */
export function registerCrmSettingsTools(server: McpServer, client: ZentriaClient): void {
  registerApiTool(server, client, {
    name: "get-crm-lead-value-category",
    description:
      "Get one lead value category of the team by key (GET /api/public/crm/lead-value-categories/{key}). Use the key other for the default amount row. AI hints are only returned to users who may manage lead values. Scope: crm:read.",
    path: "/api/public/crm/lead-value-categories/{key}",
    input: { key: categoryKey },
  });

  registerApiTool(server, client, {
    name: "create-crm-lead-value-category",
    description:
      "Create a lead value category with the amount in euro cents a new CRM lead in it is worth (POST /api/public/crm/lead-value-categories). The key defaults to the slug of the label. The keys other and unclassified are reserved, a label that already exists is refused. Needs the manage-lead-values permission. Scope: crm-values:write.",
    method: "POST",
    path: "/api/public/crm/lead-value-categories",
    input: {
      label: z.string().min(1).max(255).describe("Name of the category, unique within the team."),
      amountCents: z
        .number()
        .int()
        .min(0)
        .max(99999999)
        .describe("Value of a lead in this category in euro cents (5000 = EUR 50)."),
      key: z
        .string()
        .max(64)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional()
        .describe("Optional key (letters, numbers, dashes, underscores). Cannot be changed later."),
      aiHints: z
        .string()
        .max(5000)
        .optional()
        .describe("Optional hints for the AI that classifies leads into this category (a learning rule)."),
    },
  });

  registerApiTool(server, client, {
    name: "update-crm-lead-value-category",
    description:
      "Update the label, amount in euro cents or AI hints of a lead value category (PUT /api/public/crm/lead-value-categories/{key}). Fields you leave out keep their value, pass aiHints null to clear the hints. The key cannot change. Change the default amount with update-crm-lead-value-settings. Needs the manage-lead-values permission. Scope: crm-values:write.",
    method: "PUT",
    path: "/api/public/crm/lead-value-categories/{key}",
    input: {
      key: categoryKey,
      label: z.string().min(1).max(255).optional().describe("New name, unique within the team."),
      amountCents: z.number().int().min(0).max(99999999).optional().describe("New value in euro cents."),
      aiHints: z.string().max(5000).nullable().optional().describe("New AI hints, or null to clear."),
    },
  });

  registerApiTool(server, client, {
    name: "delete-crm-lead-value-category",
    description:
      "Delete a lead value category (DELETE /api/public/crm/lead-value-categories/{key}). Same as the delete button in the app: leads that already carry the key keep it. Needs the manage-lead-values permission. Scope: crm-values:write.",
    method: "DELETE",
    path: "/api/public/crm/lead-value-categories/{key}",
    input: { key: categoryKey },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "get-crm-lead-value-settings",
    description:
      "Get the lead value settings of the team (GET /api/public/crm/lead-value-settings): defaultAmountCents (value of a classified lead that fits no category), authenticityNotes (team wide notes for the AI that checks whether a lead is real) and the counts of leads without a value and leads of this month that a refresh would touch. Needs the manage-lead-values permission. Scope: crm:read.",
    path: "/api/public/crm/lead-value-settings",
    input: {},
  });

  registerApiTool(server, client, {
    name: "update-crm-lead-value-settings",
    description:
      "Save the default amount and/or the authenticity notes (PUT /api/public/crm/lead-value-settings). A field you leave out keeps its value, empty authenticityNotes clears the notes. Needs the manage-lead-values permission. Scope: crm-values:write.",
    method: "PUT",
    path: "/api/public/crm/lead-value-settings",
    input: {
      defaultAmountCents: z
        .number()
        .int()
        .min(0)
        .max(99999999)
        .optional()
        .describe("Default value in euro cents for classified leads that fit no category."),
      authenticityNotes: z
        .string()
        .max(5000)
        .nullable()
        .optional()
        .describe("Team wide notes the AI reads when it checks whether a lead is real. Empty or null clears them."),
    },
  });

  registerApiTool(server, client, {
    name: "backfill-crm-lead-values",
    description:
      "Queue a refresh of lead values in the background (POST /api/public/crm/lead-value-backfill), like the refresh buttons on the lead values screen. Mode missing classifies leads that have no value yet, current_month classifies and refreshes all leads of this month. Returns 202 and the counts. Needs the manage-lead-values permission. Scope: crm-values:write.",
    method: "POST",
    path: "/api/public/crm/lead-value-backfill",
    input: {
      mode: z
        .enum(["missing", "current_month"])
        .describe("missing: only leads without a value. current_month: all leads first seen this month."),
    },
  });

  registerApiTool(server, client, {
    name: "list-crm-learning-rules",
    description:
      "List the learning rules (leerregels) the AI follows for the team (GET /api/public/crm/learning-rules): campaign whitelists and blacklists, customer authenticity notes, category hints and the team authenticity notes. Each rule says where it applies (campaign, customer, team), its kind and text. Read only: change rules through the category, settings, campaign and customer tools or by confirming a proposal. Needs the workbench permission. Scope: crm:read.",
    path: "/api/public/crm/learning-rules",
    input: {
      applyScope: z
        .enum(["all", "campaign", "customer", "team"])
        .optional()
        .describe("Only rules that apply at this level. Default all."),
      q: z.string().optional().describe("Search in the rule text, customer, campaign and category."),
      page: z.number().int().min(1).optional().describe("Page number (default 1)."),
      itemsPerPage: z.number().int().min(1).max(100).optional().describe("Items per page (default 25, max 100)."),
    },
  });

  registerApiTool(server, client, {
    name: "get-crm-dashboard",
    description:
      "Get the numbers of the CRM dashboard (GET /api/public/crm/dashboard) with the same filters as the dashboard in the app: totals, goal attainment per customer (summary) and per campaign (campaignSummary), timeseries, source breakdown, dedupRate, lead value (leadValueTotalCents, leadValueByCategory), attainmentTrend and, when you pass customerId or campaignId, the drilldown. Money is in euro cents. Needs the view-CRM-dashboard permission. Scope: dashboard:read.",
    path: "/api/public/crm/dashboard",
    input: {
      range: customerRange,
      from: z.string().optional().describe("First day (YYYY-MM-DD), required for range custom."),
      to: z.string().optional().describe("Last day (YYYY-MM-DD), required for range custom."),
      customerId: z.number().int().positive().optional().describe("Drill down into one customer."),
      campaignId: z.number().int().positive().optional().describe("Drill down into one campaign."),
      view: z.enum(["customers", "campaigns"]).optional().describe("Which summary the sort and filters work on. Default customers."),
      proration: z.enum(["30d", "cal"]).optional().describe("Prorate the monthly target over 30 days (default) or the calendar month."),
      attainmentStatus: z
        .string()
        .optional()
        .describe("Comma separated goal statuses to keep: met, near, not_met, no_target."),
      leadValueCategoryKey: z
        .string()
        .optional()
        .describe("Comma separated lead value category keys: only customers that sell these."),
      sort: z
        .enum(["priority", "name", "attainment_asc", "attainment_desc", "gap_asc", "gap_desc"])
        .optional()
        .describe("Sort order of the summaries. Default priority."),
      search: z.string().optional().describe("Search by customer name."),
      label: z.string().optional().describe("Only customers with this label."),
    },
  });

  registerApiTool(server, client, {
    name: "get-crm-customer-report",
    description:
      "Get the customer report (klant-rapportage) of one customer or campaign (GET /api/public/crm/customer-report) with the same filters as the report in the app: goal attainment, lead value, leads per day and the latest submissions. Pass customerId or campaignId. Money is in euro cents. Needs the view-CRM-dashboard permission. Scope: dashboard:read.",
    path: "/api/public/crm/customer-report",
    input: {
      customerId: z.number().int().positive().optional().describe("Customer to report on. Required unless campaignId is given."),
      campaignId: z.number().int().positive().optional().describe("Report on one campaign of the customer."),
      range: z
        .enum(["today", "month", "previous_month", "7", "14", "30", "60", "90", "custom"])
        .optional()
        .describe("Period. Default month. Use custom with from and to."),
      from: z.string().optional().describe("First day (YYYY-MM-DD), required for range custom."),
      to: z.string().optional().describe("Last day (YYYY-MM-DD), required for range custom."),
      proration: z.enum(["30d", "cal"]).optional().describe("Prorate the monthly target over 30 days (default) or the calendar month."),
      includeSpam: z.boolean().optional().describe("true to list spam and rejected submissions too."),
    },
  });
}
