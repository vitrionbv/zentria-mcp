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

const BASE = "/api/public/business-profiles";

const pageSchema = {
  page: paginationSchema.page,
  itemsPerPage: paginationSchema.itemsPerPage,
};

function query(
  input: { page?: number; itemsPerPage?: number },
  filters: Record<string, string | number | boolean | undefined>,
): Record<string, string | number> {
  const out: Record<string, string | number> = paginationQuery(input);

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      out[key] = typeof value === "boolean" ? String(value) : value;
    }
  }

  return out;
}

export function registerBusinessProfileTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-business-profile-locations",
    {
      description:
        "List Google Business Profile locations (GET /api/public/business-profiles/locations). Scope: business-profiles:read. Only available when Business Profiles is on for the team.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...paginationSchema,
        customerId: z.number().int().positive().optional().describe("Only locations linked to this customer."),
        campaignId: z.number().int().positive().optional().describe("Only locations linked to this campaign."),
        verified: z.boolean().optional().describe("Filter on verification."),
        syncEnabled: z.boolean().optional().describe("Filter on review sync being enabled."),
      }),
    },
    async (input) =>
      client.request({
        path: `${BASE}/locations`,
        query: {
          ...query(input, {
            customer_id: input.customerId,
            campaign_id: input.campaignId,
            verified: input.verified,
            sync_enabled: input.syncEnabled,
          }),
          ...(input.q ? { q: input.q } : {}),
        },
      }),
  );

  registerJsonTool(
    server,
    "get-business-profile-location",
    {
      description:
        "Fetch a Business Profile location (GET /api/public/business-profiles/locations/{id}). Scope: business-profiles:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Location id."),
      }),
    },
    async (input) => client.request({ path: `${BASE}/locations/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "list-business-profile-reviews",
    {
      description:
        "List Google reviews, newest first (GET /api/public/business-profiles/reviews). Scope: business-profiles:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...pageSchema,
        locationId: z.number().int().positive().optional().describe("Only reviews of this location."),
        stars: z.number().int().min(1).max(5).optional().describe("Only reviews with this star rating."),
        answered: z.boolean().optional().describe("true for reviews with a reply, false for unanswered ones."),
        since: z.string().optional().describe("ISO-8601 date or datetime: only reviews created at or after it."),
      }),
    },
    async (input) =>
      client.request({
        path: `${BASE}/reviews`,
        query: query(input, {
          location_id: input.locationId,
          stars: input.stars,
          answered: input.answered,
          since: input.since,
        }),
      }),
  );

  registerJsonTool(
    server,
    "list-business-profile-review-replies",
    {
      description:
        "List review reply drafts and sent replies (GET /api/public/business-profiles/review-replies). Use status pending_approval to find drafts waiting for approval. Scope: business-profiles:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...pageSchema,
        status: z
          .string()
          .optional()
          .describe("draft, pending_approval, approved, sending, sent, rejected, failed or superseded."),
        locationId: z.number().int().positive().optional().describe("Only replies for reviews of this location."),
      }),
    },
    async (input) =>
      client.request({
        path: `${BASE}/review-replies`,
        query: query(input, { status: input.status, location_id: input.locationId }),
      }),
  );

  registerJsonTool(
    server,
    "approve-business-profile-review-reply",
    {
      description:
        "Approve a reply draft and send it to Google (POST /api/public/business-profiles/review-replies/{id}/approve). Optionally replace the text first. Fails with 422 when the location is not verified or the review already has a reply. Scope: business-profiles:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Review reply id."),
        body: z.string().max(4096).optional().describe("Edited reply text. Omit to send the draft as is."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `${BASE}/review-replies/${encodePathSegment(input.id)}/approve`,
        body: compactBody({ body: input.body }) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "reject-business-profile-review-reply",
    {
      description:
        "Reject a reply draft (POST /api/public/business-profiles/review-replies/{id}/reject). Scope: business-profiles:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Review reply id."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `${BASE}/review-replies/${encodePathSegment(input.id)}/reject`,
        body: {},
      }),
  );

  registerJsonTool(
    server,
    "list-business-profile-changes",
    {
      description:
        "List changes Google made to locations (GET /api/public/business-profiles/changes). Use status open for changes waiting for a decision. Scope: business-profiles:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...pageSchema,
        status: z
          .string()
          .optional()
          .describe("open, accepted, rejected, dismissed, superseded or failed."),
        locationId: z.number().int().positive().optional().describe("Only changes of this location."),
      }),
    },
    async (input) =>
      client.request({
        path: `${BASE}/changes`,
        query: query(input, { status: input.status, location_id: input.locationId }),
      }),
  );

  registerJsonTool(
    server,
    "accept-business-profile-change",
    {
      description:
        "Accept the values Google set on a location (POST /api/public/business-profiles/changes/{id}/accept). Fails with 422 when the change was already handled. Scope: business-profiles:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Change id."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `${BASE}/changes/${encodePathSegment(input.id)}/accept`,
        body: {},
      }),
  );

  registerJsonTool(
    server,
    "reject-business-profile-change",
    {
      description:
        "Reject a change: the previous values are restored at Google in the background (POST /api/public/business-profiles/changes/{id}/reject). Fails with 422 when the change was already handled. Scope: business-profiles:write.",
      annotations: { destructiveHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Change id."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `${BASE}/changes/${encodePathSegment(input.id)}/reject`,
        body: {},
      }),
  );

  registerJsonTool(
    server,
    "list-business-profile-posts",
    {
      description:
        "List Business Profile posts, newest first (GET /api/public/business-profiles/posts). Scope: business-profiles:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...pageSchema,
        locationId: z.number().int().positive().optional().describe("Only posts of this location."),
        status: z
          .string()
          .optional()
          .describe("draft, pending_approval, scheduled, publishing, published, failed, deleted or expired."),
      }),
    },
    async (input) =>
      client.request({
        path: `${BASE}/posts`,
        query: query(input, { location_id: input.locationId, status: input.status }),
      }),
  );

  registerJsonTool(
    server,
    "create-business-profile-post",
    {
      description:
        "Create one post per location (POST /api/public/business-profiles/posts). mode draft saves a draft, schedule needs scheduled_for (Europe/Amsterdam time), publish_now publishes right away. Returns { posts: [...] }. Scope: business-profiles:write.",
      inputSchema: z.object({
        location_ids: z.array(z.number().int().positive()).min(1).max(50).describe("Location ids to post to."),
        topic_type: z.enum(["STANDARD", "EVENT", "OFFER"]).describe("Post type."),
        summary: z.string().min(1).max(1500).describe("Post text."),
        mode: z.enum(["draft", "schedule", "publish_now"]).optional().describe("Default draft."),
        scheduled_for: z.string().optional().describe("Date and time, required for mode schedule."),
        title: z.string().max(58).optional().describe("Required for EVENT and OFFER."),
        language: z.enum(["nl", "en"]).optional(),
        cta_type: z.enum(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"]).optional(),
        cta_url: z.string().url().optional().describe("Required for every cta_type except CALL."),
        event_start: z.string().optional().describe("Required for EVENT and OFFER."),
        event_end: z.string().optional().describe("Required for EVENT and OFFER."),
        offer: z
          .object({
            coupon_code: z.string().max(58).optional(),
            redeem_url: z.string().url().optional(),
            terms: z.string().max(5000).optional(),
          })
          .optional()
          .describe("Offer details for OFFER posts."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `${BASE}/posts`,
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "delete-business-profile-post",
    {
      description:
        "Delete a post (DELETE /api/public/business-profiles/posts/{id}). Published posts are removed at Google first. Scope: business-profiles:write.",
      annotations: { destructiveHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("Post id."),
      }),
    },
    async (input) =>
      client.request({
        method: "DELETE",
        path: `${BASE}/posts/${encodePathSegment(input.id)}`,
      }),
  );

  registerJsonTool(
    server,
    "get-location-performance",
    {
      description:
        "Results of a Business Profile location: views, calls, website clicks, direction requests, conversations and bookings with the previous period, the views split (search, maps, mobile, desktop) and a time series (GET /api/public/business-profiles/locations/{locationId}/performance). Google reports these numbers 2 to 3 days late, see latestDate in the response. Google does not link search terms to calls, so calls cannot be traced back to a keyword. Scope: business-profiles:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        locationId: z.number().int().positive().describe("Location id."),
        period: z
          .enum(["last_7", "last_28", "last_90", "this_month", "last_month", "custom"])
          .optional()
          .describe("Period preset. Default last_28. Use custom together with from and to."),
        from: z.string().optional().describe("Start date (YYYY-MM-DD), for period custom."),
        to: z.string().optional().describe("End date (YYYY-MM-DD), for period custom."),
        granularity: z
          .enum(["day", "week"])
          .optional()
          .describe("Series buckets. Default day, or week for periods over 62 days."),
      }),
    },
    async (input) =>
      client.request({
        path: `${BASE}/locations/${encodePathSegment(input.locationId)}/performance`,
        query: query(
          {},
          { period: input.period, from: input.from, to: input.to, granularity: input.granularity },
        ),
      }),
  );

  registerJsonTool(
    server,
    "list-location-search-keywords",
    {
      description:
        "List the search terms that showed a Business Profile location in one month, most used first (GET /api/public/business-profiles/locations/{locationId}/search-keywords). Rare terms have no count but a threshold: the term was used fewer than that many times. Data is 2 to 3 days late and Google does not link search terms to calls. Scope: business-profiles:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...paginationSchema,
        locationId: z.number().int().positive().describe("Location id."),
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe("Month as YYYY-MM. Default: the newest month with data."),
      }),
    },
    async (input) =>
      client.request({
        path: `${BASE}/locations/${encodePathSegment(input.locationId)}/search-keywords`,
        query: query(input, { month: input.month }),
      }),
  );
}
