import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { paginationSchema, registerApiTool } from "./_shared.js";

/**
 * "How is customer X doing?": the status of a customer or campaign in one call, the Google numbers of a campaign,
 * grid rank tracking of Business Profile listings, services sent to Google and the origin report of sales deals.
 */

const page = { page: paginationSchema.page, itemsPerPage: paginationSchema.itemsPerPage };

const period = {
  period: z
    .enum(["last_7", "last_28", "last_90", "this_month", "last_month", "custom"])
    .optional()
    .describe("Period of the Google and review numbers (default last_28). Compared with the period of the same length before it."),
  from: z.string().optional().describe("Start date YYYY-MM-DD, for period=custom."),
  to: z.string().optional().describe("End date YYYY-MM-DD, for period=custom."),
};

const sections =
  "Every section is {available: true, data} or {available: false, reason} with reason missing_scope, no_permission or module_off, so a token with only some scopes still gets the rest: leads needs dashboard:read, Google, grid and reviews need business-profiles:read, invoices needs invoices:read. Money is in whole euro cents.";

/** Tools for customer and campaign status, Google data, grid rank tracking and the sales origin report. */
export function registerStatusTools(server: McpServer, client: ZentriaClient): void {
  registerApiTool(server, client, {
    name: "get-campaign-status",
    description:
      `Start here for questions like "how is Dakdekker Specialist X doing?" about one campaign (GET /api/public/campaigns/{id}/status). One call returns: leads this calendar month (goal attainment against the prorated target, attainmentStatus, lead value, leads still needed per category, the 5 latest leads), Search Console (clicks, impressions, ctr, position) and GA4 (sessions, usersPerDay, keyEvents) of the campaign against the previous period (data null when not linked), Business Profile results of the linked listings (views, calls, websiteClicks, directionRequests), the latest grid score per listing and keyword with the previous score and trend, reviews (count and rating in the period, without reply) and the open invoices of the customer. Find the campaign id with list-campaigns (filter customerId or q). ${sections} Scope: campaigns:read, dashboard:read, business-profiles:read, invoices:read.`,
    path: "/api/public/campaigns/{id}/status",
    input: { id: z.number().int().positive().describe("Campaign id from list-campaigns."), ...period },
  });

  registerApiTool(server, client, {
    name: "get-customer-status",
    description:
      `Status of a customer over all its campaigns in one call (GET /api/public/customers/{id}/status): leads this calendar month over all campaigns with goal attainment and the latest leads, per active campaign its Search Console and GA4 numbers, Business Profile results of all linked listings, the latest grid scores with trend, reviews and open invoices. Use get-campaign-status when the question is about one campaign or location. Find the customer id with list-customers (q = name). ${sections} Scope: customers:read, dashboard:read, business-profiles:read, invoices:read.`,
    path: "/api/public/customers/{id}/status",
    input: { id: z.number().int().positive().describe("Customer id from list-customers."), ...period },
  });

  registerApiTool(server, client, {
    name: "get-campaign-google-data",
    description:
      "Google numbers of a campaign for a period against the period before (GET /api/public/campaigns/{id}/google-data): searchConsole (clicks, impressions, ctr in %, position weighted by impressions), analytics (GA4 sessions, usersPerDay, keyEvents = conversions) and businessProfiles (totals and per linked listing: views, calls, websiteClicks, directionRequests). Each metric has value, previous, delta and deltaPct. searchConsole or analytics is null when the campaign has no link; link.error scope_missing, no_access, needs_reauth or account_missing means Zentria cannot read it (reconnect the Google account in Zentria). Google reports 2 to 3 days late. Scope: business-profiles:read.",
    path: "/api/public/campaigns/{id}/google-data",
    input: { id: z.number().int().positive().describe("Campaign id."), ...period },
  });

  registerApiTool(server, client, {
    name: "get-business-profile-grid",
    description:
      "Grid rank tracking of a Business Profile location (GET /api/public/business-profiles/locations/{locationId}/grid): the grid (size, radius, keywords, frequency, source of its scheduled runs, next run; null when not set up), the cost estimate of one run (estimates[source][depth][live|standard] for every choice), the DataForSEO budget of the team (connected, monthly budget, spent this month), the latest finished run per keyword and source with gridScore (0-100), avgRank, top3Pct, top10Pct, foundPct, the score of the run before and the trend, and the latest 20 runs. Every run has a source: search (Google Search on mobile, 15 deep by default; top 3 = the local block above the regular results) or maps (Google Maps, 100 deep; all runs from before the source choice). Scores of the two sources do not compare, so never mix them in one trend. Grid score per point: position 1-3 = 100, 4-10 = 50, 11-20 = 20, lower or not found = 0. Scope: business-profiles:read.",
    path: "/api/public/business-profiles/locations/{locationId}/grid",
    input: { locationId: z.number().int().positive().describe("Location id from list-business-profile-locations.") },
  });

  registerApiTool(server, client, {
    name: "list-business-profile-grid-runs",
    description:
      "List grid measurements of the team, newest first, without points (GET /api/public/business-profiles/grid-runs). Each run is one keyword on one location with source (search or maps), depth, status (queued, running, done, partial, failed), gridScore, avgRank, top3Pct, top10Pct, foundPct, costUsd and times. Filter on location, campaign, customer, keyword, source or status. Scope: business-profiles:read.",
    path: "/api/public/business-profiles/grid-runs",
    input: {
      locationId: z.number().int().positive().optional(),
      campaignId: z.number().int().positive().optional().describe("Only runs of locations linked to this campaign."),
      customerId: z.number().int().positive().optional().describe("Only runs of locations linked to this customer."),
      keyword: z.string().min(1).optional().describe("Exact keyword, case insensitive."),
      source: z.enum(["search", "maps"]).optional().describe("search (Google Search) or maps (Google Maps)."),
      status: z.enum(["queued", "running", "done", "partial", "failed"]).optional(),
      ...page,
    },
  });

  registerApiTool(server, client, {
    name: "get-business-profile-grid-run",
    description:
      "One grid measurement with every point (GET /api/public/business-profiles/grid-runs/{id}): row, col, lat, lng, rank (null = not in the results: the depth of the run (15 by default) for source search, top 100 for maps; rank 1-3 on search is the local block), previousRank at the same point in the previous run of the same source, and the top 3 results there (competitors). Also the previous run's summary. Use it to say where on the map the listing ranks well or badly. Scope: business-profiles:read.",
    path: "/api/public/business-profiles/grid-runs/{id}",
    input: { id: z.number().int().positive().describe("Grid run id.") },
  });

  registerApiTool(server, client, {
    name: "start-business-profile-grid-run",
    description:
      "Start a grid measurement of a location now, one run per keyword of its grid (POST /api/public/business-profiles/locations/{locationId}/grid/run). Costs money: every point is a paid DataForSEO search within the team's monthly budget. source search (default, Google Search on mobile, top 15) costs twice as much as maps (Google Maps, top 100), because DataForSEO bills Search per 10 places rounded up; search with depth 10 costs the same as maps. The prices below are for maps or search depth 10. mode live (default, \"Snel\") is done in about 20 seconds at about $0.002 per point (7x7 with 3 keywords is about $0.29); mode standard (\"Goedkoop\") goes through the DataForSEO queue at about $0.0006 per point (about $0.09) and takes a few minutes. estimates of get-business-profile-grid give the exact cost of every choice. Confirm the cost, source and mode with the user first. Refused (422) when the location has no grid, the team has no DataForSEO login, a run is still open or the budget would be exceeded. Poll get-business-profile-grid-run for the result. Scope: business-profiles-admin:write.",
    method: "POST",
    path: "/api/public/business-profiles/locations/{locationId}/grid/run",
    input: {
      locationId: z.number().int().positive().describe("Location id with a grid (see get-business-profile-grid)."),
      mode: z
        .enum(["live", "standard"])
        .optional()
        .describe("live (default): fast, about 20 seconds. standard: about a third of the price, a few minutes."),
      source: z
        .enum(["search", "maps"])
        .optional()
        .describe("search (default): Google Search on mobile, where most people search; top 3 is the local block. maps: Google Maps, up to position 100, like runs from before the source choice."),
      depth: z
        .union([z.literal(15), z.literal(10), z.literal(20)])
        .optional()
        .describe("Search only: 15 (default), 10 (half the price) or 20 (same price as 15)."),
    },
    readOnly: false,
  });

  registerApiTool(server, client, {
    name: "list-business-profile-service-pushes",
    description:
      "Services of a location that were sent to Google from Zentria, newest first (GET /api/public/business-profiles/locations/{locationId}/service-pushes): mode (add or replace), status (queued, pending = Google is reviewing, published, differs = Google shows another list, failed, superseded), how many were added and removed, which ones Google left out, who sent it and when it was checked. Empty when sending services is not switched on for the team. The service list itself is standardProfile.services of get-business-profile-location. Sending is only possible in Zentria. Scope: business-profiles:read.",
    path: "/api/public/business-profiles/locations/{locationId}/service-pushes",
    input: { locationId: z.number().int().positive().describe("Location id.") },
  });

  registerApiTool(server, client, {
    name: "get-sales-attribution-report",
    description:
      "Origin report of sales deals (GET /api/public/sales/attribution-report), like Sales > Herkomst in Zentria: per platform (meta, google, direct, ...) and ad campaign, ad set or ad, the number of leads and how many reached booked, no_show, offer, won and lost, plus wonValue and the deal ids, and totals. Based on the ad parameters of the landing page when the form was sent. Default the last 90 days. The origin of one deal is in get-deal (origin). Scope: sales:read.",
    path: "/api/public/sales/attribution-report",
    input: {
      from: z.string().optional().describe("First day the deal was created, YYYY-MM-DD."),
      to: z.string().optional().describe("Last day, YYYY-MM-DD."),
      level: z.enum(["campaign", "adset", "ad"]).optional().describe("Group by ad campaign (default), ad set or ad."),
      pipelineId: z.number().int().positive().optional(),
      formId: z.number().int().positive().optional(),
      platform: z.string().max(32).optional().describe("Only this platform, for example meta or google."),
    },
  });
}
