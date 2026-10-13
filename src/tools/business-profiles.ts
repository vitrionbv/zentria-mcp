import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import {
  compactBody,
  encodePathSegment,
  paginationQuery,
  paginationSchema,
  registerApiTool,
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
        "List Google Business Profile locations (GET /api/public/business-profiles/locations). Each location includes categories (display names), standardProfile (how the Google profile should look according to Zentria: categories, description, services, service area, opening hours and date, address, social, chat and booking links; null until imported) and replyProfileId/replySettings. Use category to analyse locations per category. Scope: business-profiles:read. Only available when Business Profiles is on for the team.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...paginationSchema,
        customerId: z.number().int().positive().optional().describe("Only locations linked to this customer."),
        campaignId: z.number().int().positive().optional().describe("Only locations linked to this campaign."),
        verified: z.boolean().optional().describe("Filter on verification."),
        syncEnabled: z.boolean().optional().describe("Filter on review sync being enabled."),
        category: z
          .string()
          .optional()
          .describe("Only locations with this category (primary or additional), exact Dutch display name, e.g. Loodgieter."),
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
            category: input.category,
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
        "Fetch a Business Profile location (GET /api/public/business-profiles/locations/{id}), including its categories and standardProfile. Scope: business-profiles:read.",
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
        "List Google reviews, newest first (GET /api/public/business-profiles/reviews). Each review has dismissedAt (set when the team took it out of the unanswered queue without replying) and replyBlocked (Google refused a reply, usually because it hides the review on Maps). For the reviews still to answer use answered=false and dismissed=false. Scope: business-profiles:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        ...pageSchema,
        locationId: z.number().int().positive().optional().describe("Only reviews of this location."),
        stars: z.number().int().min(1).max(5).optional().describe("Only reviews with this star rating."),
        answered: z.boolean().optional().describe("true for reviews with a reply, false for unanswered ones."),
        dismissed: z
          .boolean()
          .optional()
          .describe("true for reviews dismissed without a reply, false for reviews that are not dismissed."),
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
          dismissed: input.dismissed,
          since: input.since,
        }),
      }),
  );

  registerJsonTool(
    server,
    "dismiss-business-profile-review",
    {
      description:
        "Dismiss an unanswered review: it leaves the unanswered queue without a reply and nothing is sent to Google (POST /api/public/business-profiles/reviews/{id}/dismiss). Use it for reviews with replyBlocked true, or when the team decides not to answer. Open reply drafts are closed. Fails with 422 when the review already has a reply. Scope: business-profiles:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Review id."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `${BASE}/reviews/${encodePathSegment(input.id)}/dismiss`,
        body: {},
      }),
  );

  registerJsonTool(
    server,
    "restore-business-profile-review",
    {
      description:
        "Put a dismissed review back in the unanswered queue (POST /api/public/business-profiles/reviews/{id}/restore). Scope: business-profiles:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Review id."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `${BASE}/reviews/${encodePathSegment(input.id)}/restore`,
        body: {},
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
        "List differences between the standard profile in Zentria and what Google shows (GET /api/public/business-profiles/changes). Use status open for differences waiting for someone. fields holds per field the standard value (ours) and Google's value (google); attribute fields are named attributes.url_facebook, attributes.url_whatsapp and so on. Each change includes customerName and locationUrl (link to the location in Zentria). Scope: business-profiles:read.",
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
        "Google is right: Google's values become the new standard profile values (POST /api/public/business-profiles/changes/{id}/accept). Nothing is sent to Google. Fails with 422 when the change was already handled. Scope: business-profiles:write.",
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
    "dismiss-business-profile-change",
    {
      description:
        "Mark a change as handled without changing the standard or Google, for example after fixing it at Google yourself (POST /api/public/business-profiles/changes/{id}/dismiss). The same difference is not reported again. Fails with 422 when the change was already handled. Scope: business-profiles:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Change id."),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: `${BASE}/changes/${encodePathSegment(input.id)}/dismiss`,
        body: {},
      }),
  );

  registerJsonTool(
    server,
    "reject-business-profile-change",
    {
      description:
        "Reject a change: the standard profile values are written back to Google in the background (POST /api/public/business-profiles/changes/{id}/reject). Only when explicitly asked; the usual actions are accept (Google is right) and dismiss. Fails with 422 when the change was already handled. Scope: business-profiles:write.",
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

  // ---- Single items ----
  registerApiTool(server, client, {
    name: "get-business-profile-review",
    description: `Get a Google review (GET ${BASE}/reviews/{id}). Scope: business-profiles:read.`,
    path: `${BASE}/reviews/{id}`,
    input: { id: z.number().int().positive().describe("Review id.") },
  });

  registerApiTool(server, client, {
    name: "get-business-profile-review-reply",
    description: `Get a reply draft or sent reply (GET ${BASE}/review-replies/{id}). Scope: business-profiles:read.`,
    path: `${BASE}/review-replies/{id}`,
    input: { id: z.number().int().positive().describe("Reply id.") },
  });

  registerApiTool(server, client, {
    name: "get-business-profile-change",
    description: `Get a detected location change with the values of the standard profile and of Google per field (GET ${BASE}/changes/{id}). Scope: business-profiles:read.`,
    path: `${BASE}/changes/{id}`,
    input: { id: z.number().int().positive().describe("Change id.") },
  });

  registerApiTool(server, client, {
    name: "get-business-profile-post",
    description: `Get a post (GET ${BASE}/posts/{id}). Scope: business-profiles:read.`,
    path: `${BASE}/posts/{id}`,
    input: { id: z.number().int().positive().describe("Post id.") },
  });

  // ---- Reviews and replies ----
  registerApiTool(server, client, {
    name: "generate-business-profile-review-reply-draft",
    description: `Let AI write a new reply draft for a review (POST ${BASE}/reviews/{id}/draft). Older open drafts are superseded; the draft waits for approval. Answers 422 when the review already has a reply. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/reviews/{id}/draft`,
    input: {
      id: z.number().int().positive().describe("Review id."),
      instruction: z.string().max(500).optional().describe("Optional instruction, for example: make it shorter."),
    },
  });

  registerApiTool(server, client, {
    name: "create-business-profile-review-reply",
    description: `Write a reply to a review yourself (POST ${BASE}/reviews/{id}/replies). send true posts it to Google right away, false saves a draft that waits for approval. Answers 422 when the review already has a reply or the location is not verified. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/reviews/{id}/replies`,
    input: {
      id: z.number().int().positive().describe("Review id."),
      body: z.string().min(1).max(4096).describe("Reply text."),
      send: z.boolean().optional().describe("true sends it to Google now. Default false (draft)."),
    },
  });

  registerApiTool(server, client, {
    name: "update-business-profile-review-reply",
    description: `Change the text of a reply draft; it goes back to waiting for approval (PATCH ${BASE}/review-replies/{id}). Scope: business-profiles:write.`,
    method: "PATCH",
    path: `${BASE}/review-replies/{id}`,
    input: {
      id: z.number().int().positive().describe("Reply id."),
      body: z.string().min(1).max(4096).describe("New reply text."),
    },
  });

  registerApiTool(server, client, {
    name: "delete-business-profile-review-reply",
    description: `Delete the reply that Zentria posted on Google (DELETE ${BASE}/reviews/{id}/reply); a reply written on Google itself cannot be deleted. Answers the review. Scope: business-profiles:write.`,
    method: "DELETE",
    path: `${BASE}/reviews/{id}/reply`,
    input: { id: z.number().int().positive().describe("Review id.") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "bulk-approve-business-profile-review-replies",
    description: `Approve many reply drafts and queue them for sending (POST ${BASE}/review-replies/bulk-approve). Give ids (up to 100), or approveAll true with locationId for all pending drafts of that location (at most 200). Drafts of unverified locations and of reviews that already have a reply are skipped. Answers {"queued": n}. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/review-replies/bulk-approve`,
    input: {
      ids: z.array(z.number().int().positive()).max(100).optional().describe("Reply ids."),
      approveAll: z.boolean().optional().describe("Approve all pending drafts of locationId."),
      locationId: z.number().int().positive().optional(),
    },
  });

  registerApiTool(server, client, {
    name: "generate-business-profile-review-reply-drafts",
    description: `Queue AI reply drafts for all unanswered reviews without an open draft, at most 200, optionally of one location (POST ${BASE}/reviews/generate-drafts). confirmCount has to equal the number of affected reviews; otherwise the call answers 422 with the real number so you can confirm it. The drafts wait for approval. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/reviews/generate-drafts`,
    input: {
      confirmCount: z.number().int().min(0).describe("Number of unanswered reviews without a draft that you expect."),
      locationId: z.number().int().positive().optional(),
    },
  });

  // ---- Changes ----
  registerApiTool(server, client, {
    name: "decide-business-profile-changes",
    description: `Decide up to 200 location changes at once (POST ${BASE}/changes/bulk): accept (Google is right), reject (our values are restored at Google) or dismiss (handled elsewhere). Changes that were already handled are skipped. Answers {"processed": n, "skipped": n}. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/changes/bulk`,
    input: {
      ids: z.array(z.number().int().positive()).min(1).max(200).describe("Change ids."),
      decision: z.enum(["accept", "reject", "dismiss"]),
    },
  });

  registerApiTool(server, client, {
    name: "reject-all-business-profile-changes",
    description: `Reject every open change of one Google login: our values are restored at Google (POST ${BASE}/changes/reject-all). Answers {"processed": n, "skipped": n}. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/changes/reject-all`,
    input: { googleAccountId: z.number().int().positive().describe("Id from list-business-profile-accounts.") },
    destructive: true,
  });

  // ---- Posts ----
  const postFields = {
    topicType: z.enum(["STANDARD", "EVENT", "OFFER"]),
    summary: z.string().min(1).max(1500),
    mode: z
      .enum(["draft", "schedule", "publish_now"])
      .optional()
      .describe("draft (default), schedule (needs scheduledFor) or publish_now."),
    scheduledFor: z.string().optional().describe("Required for schedule: future time, Europe/Amsterdam."),
    title: z.string().max(58).optional().describe("Required for EVENT and OFFER."),
    language: z.enum(["nl", "en"]).optional(),
    ctaType: z.enum(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"]).optional(),
    ctaUrl: z.string().url().optional().describe("Required for every ctaType except CALL."),
    eventStart: z.string().optional().describe("Required for EVENT and OFFER."),
    eventEnd: z.string().optional().describe("Required for EVENT and OFFER."),
    offer: z
      .object({
        couponCode: z.string().max(58).optional(),
        redeemUrl: z.string().url().optional(),
        terms: z.string().max(5000).optional(),
      })
      .optional()
      .describe("Offer details for OFFER posts."),
    mediaPath: z.string().optional().describe("Path from upload-business-profile-post-picture."),
    source: z.enum(["manual", "ai"]).optional().describe("ai records the model and cost of the last generated draft with the same text."),
  };

  registerApiTool(server, client, {
    name: "update-business-profile-post",
    description: `Replace the content of a post that can still be edited: draft, waiting for approval, scheduled, failed or expired (PUT ${BASE}/posts/{id}). Send the full post like in create-business-profile-post (without locationIds). mode decides what happens next. Scope: business-profiles:write.`,
    method: "PUT",
    path: `${BASE}/posts/{id}`,
    input: { id: z.number().int().positive().describe("Post id."), ...postFields },
  });

  registerApiTool(server, client, {
    name: "approve-business-profile-post",
    description: `Approve a draft or a post that waits for approval so it is published at its planned time (POST ${BASE}/posts/{id}/approve). Answers 422 when it has no text or no future time. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/posts/{id}/approve`,
    input: { id: z.number().int().positive().describe("Post id.") },
  });

  registerApiTool(server, client, {
    name: "publish-business-profile-post",
    description: `Publish a post now (POST ${BASE}/posts/{id}/publish). Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/posts/{id}/publish`,
    input: { id: z.number().int().positive().describe("Post id.") },
  });

  registerApiTool(server, client, {
    name: "generate-business-profile-post-text",
    description: `Let AI write a post text for a location without saving anything (POST ${BASE}/posts/generate). Use the summary in create-business-profile-post or update-business-profile-post with source ai. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/posts/generate`,
    input: {
      locationId: z.number().int().positive().describe("Location id."),
      prompt: z.string().max(2000).optional().describe("What the post is about."),
      tone: z.enum(["vriendelijk", "zakelijk", "informeel", "enthousiast"]).optional(),
      language: z.enum(["nl", "en"]).optional(),
      length: z.number().int().min(50).max(1500).optional().describe("Target length in characters."),
      topicType: z.enum(["STANDARD", "EVENT", "OFFER"]).optional(),
      ctaType: z.enum(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"]).optional(),
      currentSummary: z.string().max(1500).optional().describe("An existing text to improve."),
      instruction: z.string().max(1000).optional().describe("What to change in the current text."),
    },
  });

  registerApiTool(server, client, {
    name: "upload-business-profile-post-picture",
    description: `Upload a picture for a post from base64 content (POST ${BASE}/posts/media). JPG or PNG, up to 10 MB, at least 250 pixels on the short edge. Answers {path, url}: use path as mediaPath when creating or updating a post. Uploading a file with multipart is only possible in the app. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/posts/media`,
    input: { contentBase64: z.string().describe("Picture content, base64 encoded.") },
  });
}
