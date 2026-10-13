import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { paginationSchema, registerApiTool } from "./_shared.js";

const BASE = "/api/public/business-profiles";
const ADMIN = "business-profiles-admin:write";

const pageSchema = {
  page: paginationSchema.page,
  itemsPerPage: paginationSchema.itemsPerPage,
};

const id = (what: string) => z.number().int().positive().describe(`${what} id.`);

const frequency = z
  .object({
    type: z.enum(["weekly", "monthly", "custom"]).describe("weekly (days), monthly (day) or custom (everyDays)."),
    time: z.string().describe("Time of day as HH:MM, Europe/Amsterdam."),
    days: z.array(z.number().int().min(1).max(7)).optional().describe("Weekdays 1 (Monday) to 7 (Sunday), for weekly."),
    day: z.number().int().min(1).max(31).optional().describe("Day of the month, for monthly."),
    everyDays: z.number().int().min(1).max(365).optional().describe("Every N days, for custom."),
    startDate: z.string().optional().describe("First day as YYYY-MM-DD, for custom. Default today."),
  })
  .describe("How often the schedule runs.");

const offer = z
  .object({
    couponCode: z.string().max(58).optional(),
    redeemUrl: z.string().url().optional(),
    terms: z.string().max(5000).optional(),
  })
  .describe("Offer details for OFFER posts.");

const category = z.object({
  id: z.string().describe("Google category id such as categories/gcid:plumber. Find it with search-business-profile-categories."),
  name: z.string().optional().describe("Display name (optional)."),
});

const hours = z.record(
  z.string(),
  z.array(z.object({ open: z.string().describe("HH:MM"), close: z.string().describe("HH:MM, or 24:00") })),
);

const settingsObject = z
  .record(z.string(), z.unknown())
  .describe(
    "Reply settings: mode (off, templates or ai), ratings (per star 1-5: skip, draft or auto), noText, tone, toneNotes, formality, language, length, useFirstName, signOff, dos, donts, bannedWords, examples, negativeInstruction, model, autoSendDelayMinutes, businessHoursOnly, templates. Start from the settings of an existing profile (get-business-profile-reply-profile).",
  );

const scheduleFields = {
  name: z.string().min(1).max(120),
  locationIds: z.array(z.number().int().positive()).min(1).describe("Locations the schedule posts to."),
  frequency,
  isActive: z.boolean().optional().describe("Default true."),
  requiresApproval: z.boolean().describe("true: every post waits for approval before it is published."),
};

const postScheduleFields = {
  ...scheduleFields,
  source: z.enum(["fixed", "pool", "ai"]).describe("Where the text comes from: fixed text, a pool of texts or AI."),
  fixedText: z.string().max(1500).optional().describe("Required for source fixed."),
  pool: z.array(z.string().max(1500)).optional().describe("Required for source pool: texts that are used in turn."),
  aiPrompt: z.string().max(2000).optional().describe("Required for source ai."),
  aiAngles: z.array(z.string()).optional().describe("Optional angles the AI rotates through (source ai)."),
  tone: z.enum(["vriendelijk", "zakelijk", "informeel", "enthousiast"]).optional(),
  language: z.enum(["nl", "en"]).optional(),
  topicType: z.enum(["STANDARD", "EVENT", "OFFER"]),
  title: z.string().max(58).optional().describe("Required for EVENT and OFFER (unless source ai)."),
  event: z
    .object({
      startOffsetDays: z.number().int().min(0).max(365),
      startTime: z.string().describe("HH:MM"),
      durationDays: z.number().int().min(0).max(365),
      endTime: z.string().describe("HH:MM"),
    })
    .optional()
    .describe("Required for EVENT and OFFER: when the event starts relative to the run."),
  offer: offer.optional(),
  ctaType: z.enum(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"]).optional(),
  ctaUrl: z.string().url().optional().describe("Required for every ctaType except CALL."),
  media: z
    .object({
      mode: z.enum(["none", "fixed", "random"]),
      paths: z.array(z.string()).optional().describe("Paths from upload-business-profile-post-picture."),
    })
    .optional(),
};

/** Tools for Business Profile accounts, locations, photos, schedules and settings. */
export function registerBusinessProfileAdminTools(server: McpServer, client: ZentriaClient): void {
  // ---- Accounts ----
  registerApiTool(server, client, {
    name: "list-business-profile-accounts",
    description: `List the connected Google logins of the team with their connection status (active or needs_reauth), last error and listing counts (GET ${BASE}/accounts). Connecting or reconnecting a login (Google sign-in) is only possible in the app. Needs the manage-business-profile-accounts permission. Scope: business-profiles:read.`,
    path: `${BASE}/accounts`,
    input: pageSchema,
  });

  registerApiTool(server, client, {
    name: "get-business-profile-account",
    description: `Get a connected Google login and its connection status (GET ${BASE}/accounts/{id}). Never returns tokens. Scope: business-profiles:read.`,
    path: `${BASE}/accounts/{id}`,
    input: { id: id("Account") },
  });

  registerApiTool(server, client, {
    name: "update-business-profile-account",
    description: `Change the nickname of a Google login (PATCH ${BASE}/accounts/{id}). Scope: ${ADMIN}.`,
    method: "PATCH",
    path: `${BASE}/accounts/{id}`,
    input: {
      id: id("Account"),
      nickname: z.string().max(120).nullable().describe("New nickname, or null to clear it."),
    },
  });

  registerApiTool(server, client, {
    name: "sync-business-profile-account",
    description: `Queue a refresh of the listings of a Google login (POST ${BASE}/accounts/{id}/sync). Answers 422 when the login needs to be reconnected in the app first. Scope: ${ADMIN}.`,
    method: "POST",
    path: `${BASE}/accounts/{id}/sync`,
    input: { id: id("Account") },
  });

  registerApiTool(server, client, {
    name: "disconnect-business-profile-account",
    description: `Disconnect a Google login (DELETE ${BASE}/accounts/{id}): the grant is revoked at Google unless another team uses the same login, and listings that no other login can reach are archived with sync off. Reconnecting is only possible in the app. Scope: ${ADMIN}.`,
    method: "DELETE",
    path: `${BASE}/accounts/{id}`,
    input: { id: id("Account") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "set-business-profile-account-change-preference",
    description: `Set what happens with detected changes of the listings of a Google login: review (a person decides), always_reject or notify_only (PUT ${BASE}/accounts/{id}/change-preference). Needs the manage-business-profile-changes permission. Scope: business-profiles:write.`,
    method: "PUT",
    path: `${BASE}/accounts/{id}/change-preference`,
    input: {
      id: id("Account"),
      changePreference: z.enum(["review", "always_reject", "notify_only"]),
    },
  });

  // ---- Locations ----
  registerApiTool(server, client, {
    name: "update-business-profile-location",
    description: `Update the link of a location to a customer and campaign, its reply profile, business context and review sync switch (PATCH ${BASE}/locations/{id}). Only the fields you send change; customerId null also unlinks the campaign. Changing the reply profile needs the manage-business-profile-reply-settings permission. Scope: ${ADMIN}.`,
    method: "PATCH",
    path: `${BASE}/locations/{id}`,
    input: {
      id: id("Location"),
      customerId: z.number().int().positive().nullable().optional().describe("Customer to link, or null."),
      campaignId: z.number().int().positive().nullable().optional().describe("Campaign of that customer, or null."),
      replyProfileId: z.number().int().positive().nullable().optional().describe("Reply profile, or null for the team default."),
      context: z.string().max(4000).nullable().optional().describe("Business context the AI uses for replies and posts."),
      syncEnabled: z.boolean().optional().describe("Turn review sync on or off. Turning it on starts the first import."),
    },
  });

  registerApiTool(server, client, {
    name: "sync-business-profile-location",
    description: `Queue a refresh of the reviews, posts and profile changes of a location (POST ${BASE}/locations/{id}/sync). Answers 422 when the location is archived or its Google login needs to be reconnected. Scope: ${ADMIN}.`,
    method: "POST",
    path: `${BASE}/locations/{id}/sync`,
    input: { id: id("Location") },
  });

  registerApiTool(server, client, {
    name: "bulk-update-business-profile-locations",
    description: `Change many locations at once (POST ${BASE}/locations/bulk): enable_sync, disable_sync, link_customer (customerId), assign_profile (replyProfileId; needs the manage-business-profile-reply-settings permission) or accept_suggestions (link the suggested customers). Answers {"updated": n}. Scope: ${ADMIN}.`,
    method: "POST",
    path: `${BASE}/locations/bulk`,
    input: {
      ids: z.array(z.number().int().positive()).min(1).max(500).describe("Location ids."),
      action: z.enum(["enable_sync", "disable_sync", "link_customer", "assign_profile", "accept_suggestions"]),
      customerId: z.number().int().positive().optional().describe("Required for link_customer."),
      replyProfileId: z.number().int().positive().nullable().optional().describe("For assign_profile; null removes the profile."),
    },
  });

  registerApiTool(server, client, {
    name: "update-business-profile-standard-profile",
    description: `Change the standard profile of a location, how the Google profile should look (PATCH ${BASE}/locations/{id}/standard-profile). Nothing is written to Google: differences show up as changes you can reject. Send the same shape as the standardProfile field of get-business-profile-location. Only the keys you send change; a key you send replaces its whole value (regularHours, links, services and the category lists are replaced as a whole, address and openingDate are merged). Needs the manage-business-profile-changes permission. Scope: business-profiles:write.`,
    method: "PATCH",
    path: `${BASE}/locations/{id}/standard-profile`,
    input: {
      id: id("Location"),
      title: z.string().max(200).optional(),
      primaryPhone: z.string().max(40).nullable().optional(),
      additionalPhones: z.array(z.string().max(40)).max(2).optional(),
      websiteUri: z.string().nullable().optional(),
      description: z.string().max(750).nullable().optional(),
      openStatus: z.enum(["OPEN", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]).nullable().optional(),
      openingDate: z
        .object({
          year: z.number().int().nullable().optional(),
          month: z.number().int().min(1).max(12).nullable().optional(),
          day: z.number().int().min(1).max(31).nullable().optional(),
        })
        .optional(),
      address: z
        .object({
          addressLines: z.array(z.string().max(80)).max(5).optional(),
          postalCode: z.string().max(20).nullable().optional(),
          locality: z.string().max(80).nullable().optional(),
          administrativeArea: z.string().max(80).nullable().optional(),
          regionCode: z.string().length(2).nullable().optional(),
        })
        .optional(),
      primaryCategory: category.nullable().optional(),
      additionalCategories: z.array(category).max(9).optional(),
      serviceArea: z
        .object({
          businessType: z.enum(["CUSTOMER_LOCATION_ONLY", "CUSTOMER_AND_BUSINESS_LOCATION"]).nullable().optional(),
          places: z
            .array(z.object({ placeId: z.string(), placeName: z.string() }))
            .max(20)
            .optional()
            .describe("From search-business-profile-places."),
          regionCode: z.string().length(2).nullable().optional(),
        })
        .optional(),
      services: z
        .array(
          z.object({
            type: z.enum(["structured", "free"]),
            serviceTypeId: z.string().nullable().optional().describe("For structured services (list-business-profile-service-types)."),
            categoryId: z.string().nullable().optional().describe("For free services: the category the service belongs to."),
            name: z.string().max(140).nullable().optional().describe("Required for free services."),
            description: z.string().max(300).nullable().optional(),
            price: z
              .object({ currencyCode: z.string().length(3), units: z.union([z.number(), z.string()]), nanos: z.number().int().optional() })
              .nullable()
              .optional(),
          }),
        )
        .max(500)
        .optional(),
      regularHours: hours.optional().describe("Per day (MONDAY ... SUNDAY) a list of {open, close} periods; an empty list means closed."),
      links: z
        .record(z.string(), z.array(z.string()))
        .optional()
        .describe("Social, chat and booking links keyed by Google attribute id (for example url_appointment), each a list of URLs."),
    },
  });

  registerApiTool(server, client, {
    name: "import-business-profile-standard-profile",
    description: `Replace the standard profile of a location with what Google shows now (POST ${BASE}/locations/{id}/standard-profile/import). Open differences are closed. Answers 422 when Google cannot be reached. Needs the manage-business-profile-changes permission. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/locations/{id}/standard-profile/import`,
    input: { id: id("Location") },
  });

  registerApiTool(server, client, {
    name: "search-business-profile-categories",
    description: `Search the Google business categories (Dutch names) to use in the standard profile (GET ${BASE}/locations/{locationId}/categories). Returns {id, name}; use the id. An empty list can mean the catalog is still being loaded: try again shortly. Scope: business-profiles:read.`,
    path: `${BASE}/locations/{locationId}/categories`,
    input: { locationId: id("Location"), q: z.string().optional().describe("Part of the category name.") },
  });

  registerApiTool(server, client, {
    name: "list-business-profile-service-types",
    description: `List the structured service types Google offers for up to 10 categories (GET ${BASE}/locations/{locationId}/service-types). Use a type id as serviceTypeId in the standard profile services. Scope: business-profiles:read.`,
    path: `${BASE}/locations/{locationId}/service-types`,
    input: {
      locationId: id("Location"),
      categories: z.array(z.string()).max(10).optional().describe("Category ids such as categories/gcid:plumber."),
    },
  });

  registerApiTool(server, client, {
    name: "search-business-profile-places",
    description: `Search regions for the service area of a location (GET ${BASE}/locations/{locationId}/places). Returns {placeId, placeName}; empty when Google Places is not configured. Needs the manage-business-profile-changes permission. Scope: business-profiles:read.`,
    path: `${BASE}/locations/{locationId}/places`,
    input: { locationId: id("Location"), q: z.string().optional().describe("Part of the place name.") },
  });

  registerApiTool(server, client, {
    name: "set-business-profile-location-reply-settings",
    description: `Set the reply profile, business context and own reply settings of a location (PUT ${BASE}/locations/{id}/reply-settings). Only the keys you send change; replySettings null removes the own settings so the location follows its profile. Needs the manage-business-profile-reply-settings permission. Scope: ${ADMIN}.`,
    method: "PUT",
    path: `${BASE}/locations/{id}/reply-settings`,
    input: {
      id: id("Location"),
      replyProfileId: z.number().int().positive().nullable().optional(),
      context: z.string().max(5000).nullable().optional(),
      replySettings: settingsObject.nullable().optional(),
    },
  });

  registerApiTool(server, client, {
    name: "give-business-profile-auto-reply-consent",
    description: `Record the consent of the business owner for automatic replies (POST ${BASE}/locations/{id}/auto-reply-consent). Without consent nothing is ever sent automatically. Needs the manage-business-profile-reply-settings permission. Scope: ${ADMIN}.`,
    method: "POST",
    path: `${BASE}/locations/{id}/auto-reply-consent`,
    input: {
      id: id("Location"),
      consent: z.literal(true).describe("Must be true: the owner agreed."),
      name: z.string().min(1).max(160).describe("Name of the person who agreed."),
      givenAt: z.string().optional().describe("Date of the consent (not in the future). Default today."),
      note: z.string().max(1000).optional(),
    },
  });

  registerApiTool(server, client, {
    name: "revoke-business-profile-auto-reply-consent",
    description: `Withdraw the consent for automatic replies (DELETE ${BASE}/locations/{id}/auto-reply-consent). Scheduled automatic replies of the location go back to draft. Needs the manage-business-profile-reply-settings permission. Scope: ${ADMIN}.`,
    method: "DELETE",
    path: `${BASE}/locations/{id}/auto-reply-consent`,
    input: { id: id("Location") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "sync-business-profile-location-performance",
    description: `Queue a fresh import of the results and search terms of a location, once per five minutes per location (POST ${BASE}/locations/{id}/performance/sync). Answers 422 when unavailable or too soon. Needs the manage-business-profile-accounts and view-business-profile-performance permissions. Scope: ${ADMIN}.`,
    method: "POST",
    path: `${BASE}/locations/{id}/performance/sync`,
    input: { id: id("Location") },
  });

  registerApiTool(server, client, {
    name: "refresh-business-profile-location-posts",
    description: `Queue a refresh of the posts of a location from Google (POST ${BASE}/locations/{id}/posts/refresh). Needs the manage-business-profile-posts permission. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/locations/{id}/posts/refresh`,
    input: { id: id("Location") },
  });

  registerApiTool(server, client, {
    name: "set-business-profile-location-change-preference",
    description: `Set what happens with detected changes of one location: review, always_reject or notify_only; null follows the Google login (PUT ${BASE}/locations/{id}/change-preference). Needs the manage-business-profile-changes permission. Scope: business-profiles:write.`,
    method: "PUT",
    path: `${BASE}/locations/{id}/change-preference`,
    input: {
      id: id("Location"),
      changePreference: z.enum(["review", "always_reject", "notify_only"]).nullable(),
    },
  });

  // ---- Reply profiles ----
  registerApiTool(server, client, {
    name: "list-business-profile-reply-profiles",
    description: `List the reply profiles of the team (GET ${BASE}/reply-profiles). Needs the manage-business-profile-reply-settings permission. Scope: business-profiles:read.`,
    path: `${BASE}/reply-profiles`,
    input: pageSchema,
  });

  registerApiTool(server, client, {
    name: "get-business-profile-reply-profile",
    description: `Get a reply profile with its full settings (GET ${BASE}/reply-profiles/{id}). Scope: business-profiles:read.`,
    path: `${BASE}/reply-profiles/{id}`,
    input: { id: id("Reply profile") },
  });

  registerApiTool(server, client, {
    name: "create-business-profile-reply-profile",
    description: `Create a reply profile (POST ${BASE}/reply-profiles). The first profile of a team becomes the default. Needs the manage-business-profile-reply-settings permission. Scope: ${ADMIN}.`,
    method: "POST",
    path: `${BASE}/reply-profiles`,
    input: {
      name: z.string().min(1).max(120),
      isDefault: z.boolean().optional().describe("Make it the default of the team."),
      settings: settingsObject,
    },
  });

  registerApiTool(server, client, {
    name: "update-business-profile-reply-profile",
    description: `Replace the name and settings of a reply profile (PUT ${BASE}/reply-profiles/{id}); send the full settings. isDefault true makes it the team default. Scope: ${ADMIN}.`,
    method: "PUT",
    path: `${BASE}/reply-profiles/{id}`,
    input: {
      id: id("Reply profile"),
      name: z.string().min(1).max(120),
      isDefault: z.boolean().optional(),
      settings: settingsObject,
    },
  });

  registerApiTool(server, client, {
    name: "delete-business-profile-reply-profile",
    description: `Delete a reply profile (DELETE ${BASE}/reply-profiles/{id}). Locations that used it follow the team default again. Scope: ${ADMIN}.`,
    method: "DELETE",
    path: `${BASE}/reply-profiles/{id}`,
    input: { id: id("Reply profile") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "assign-business-profile-reply-profile",
    description: `Assign a reply profile (or none) to many locations at once (POST ${BASE}/reply-profiles/assign). Answers {"updated": n}. Scope: ${ADMIN}.`,
    method: "POST",
    path: `${BASE}/reply-profiles/assign`,
    input: {
      locationIds: z.array(z.number().int().positive()).min(1).max(1000),
      replyProfileId: z.number().int().positive().nullable().describe("Profile id, or null to remove the profile."),
    },
  });

  registerApiTool(server, client, {
    name: "test-business-profile-reply-settings",
    description: `Try reply settings on a sample or stored review without saving or sending anything (POST ${BASE}/reply-profiles/sandbox). Give a reviewId, or stars with optional reviewText and reviewerName; and either unsaved settings or a profileId. Uses AI budget. Scope: ${ADMIN}.`,
    method: "POST",
    path: `${BASE}/reply-profiles/sandbox`,
    input: {
      locationId: id("Location"),
      reviewId: z.number().int().positive().optional().describe("A stored review to answer."),
      stars: z.number().int().min(1).max(5).optional().describe("Star rating of a sample review."),
      reviewText: z.string().max(4000).optional(),
      reviewerName: z.string().max(120).optional(),
      settings: settingsObject.optional(),
      profileId: z.number().int().positive().optional(),
      instruction: z.string().max(500).optional(),
    },
  });

  // ---- Post schedules ----
  registerApiTool(server, client, {
    name: "list-business-profile-post-schedules",
    description: `List the recurring post schedules (GET ${BASE}/post-schedules). Scope: business-profiles:read.`,
    path: `${BASE}/post-schedules`,
    input: pageSchema,
  });

  registerApiTool(server, client, {
    name: "get-business-profile-post-schedule",
    description: `Get a post schedule (GET ${BASE}/post-schedules/{id}). Scope: business-profiles:read.`,
    path: `${BASE}/post-schedules/{id}`,
    input: { id: id("Post schedule") },
  });

  registerApiTool(server, client, {
    name: "create-business-profile-post-schedule",
    description: `Create a recurring post schedule that creates one post per location on every run (POST ${BASE}/post-schedules). Needs the manage-business-profile-posts permission. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/post-schedules`,
    input: postScheduleFields,
  });

  registerApiTool(server, client, {
    name: "update-business-profile-post-schedule",
    description: `Replace a post schedule (PUT ${BASE}/post-schedules/{id}); send the full schedule like in create. Pausing it or switching on approval sends its still-future posts back to draft. Scope: business-profiles:write.`,
    method: "PUT",
    path: `${BASE}/post-schedules/{id}`,
    input: { id: id("Post schedule"), ...postScheduleFields },
  });

  registerApiTool(server, client, {
    name: "delete-business-profile-post-schedule",
    description: `Delete a post schedule and its still-future scheduled posts (DELETE ${BASE}/post-schedules/{id}). Scope: business-profiles:write.`,
    method: "DELETE",
    path: `${BASE}/post-schedules/{id}`,
    input: { id: id("Post schedule") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "toggle-business-profile-post-schedule",
    description: `Pause an active post schedule or resume a paused one (POST ${BASE}/post-schedules/{id}/toggle). Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/post-schedules/{id}/toggle`,
    input: { id: id("Post schedule") },
  });

  registerApiTool(server, client, {
    name: "test-run-business-profile-post-schedule",
    description: `Create draft posts from a schedule without publishing and without moving the schedule forward (POST ${BASE}/post-schedules/{id}/test-run). Answers {"created": n}. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/post-schedules/{id}/test-run`,
    input: { id: id("Post schedule") },
  });

  registerApiTool(server, client, {
    name: "preview-business-profile-schedule-occurrences",
    description: `Show the next occurrences of an unsaved frequency (POST ${BASE}/post-schedules/preview). Answers {"occurrences": [ISO-8601 times]}. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/post-schedules/preview`,
    input: { frequency, count: z.number().int().min(1).max(12).optional().describe("Number of occurrences, default 6.") },
  });

  // ---- Photos ----
  registerApiTool(server, client, {
    name: "list-business-profile-photos",
    description: `List photos on Business Profile listings, newest first (GET ${BASE}/photos). Scope: business-profiles:read.`,
    path: `${BASE}/photos`,
    input: {
      ...pageSchema,
      locationId: z.number().int().positive().optional().describe("Only photos of this location."),
      status: z
        .enum(["pending_approval", "scheduled", "publishing", "published", "failed", "removed"])
        .optional(),
    },
    rename: { locationId: "location_id" },
  });

  registerApiTool(server, client, {
    name: "get-business-profile-photo",
    description: `Get a photo (GET ${BASE}/photos/{id}). Scope: business-profiles:read.`,
    path: `${BASE}/photos/{id}`,
    input: { id: id("Photo") },
  });

  registerApiTool(server, client, {
    name: "place-business-profile-photos",
    description: `Place library photos on listings, now or at a planned moment (POST ${BASE}/photos/place). Photos already planned for a listing are skipped. Answers {"created": n}. Needs the manage-business-profile-posts permission. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/photos/place`,
    input: {
      libraryItemIds: z.array(z.number().int().positive()).min(1).max(100),
      locationIds: z.array(z.number().int().positive()).min(1).max(200),
      mode: z.enum(["now", "schedule"]),
      scheduledFor: z.string().optional().describe("Required for schedule: future time, Europe/Amsterdam."),
      category: z.string().optional().describe("Photo category, default the category of the library photo."),
    },
  });

  registerApiTool(server, client, {
    name: "approve-business-profile-photo",
    description: `Approve a photo that waits for approval so it is published at its planned time (POST ${BASE}/photos/{id}/approve). Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/photos/{id}/approve`,
    input: { id: id("Photo") },
  });

  registerApiTool(server, client, {
    name: "publish-business-profile-photo",
    description: `Publish a photo now (POST ${BASE}/photos/{id}/publish). Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/photos/{id}/publish`,
    input: { id: id("Photo") },
  });

  registerApiTool(server, client, {
    name: "repost-business-profile-photo",
    description: `Place a photo again that Google removed (POST ${BASE}/photos/{id}/repost). Answers the new photo. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/photos/{id}/repost`,
    input: { id: id("Photo") },
  });

  registerApiTool(server, client, {
    name: "delete-business-profile-photo",
    description: `Remove a photo; a photo that is live is removed at Google first (DELETE ${BASE}/photos/{id}). Scope: business-profiles:write.`,
    method: "DELETE",
    path: `${BASE}/photos/{id}`,
    input: { id: id("Photo") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "acknowledge-removed-business-profile-photos",
    description: `Mark the photos that Google removed as seen (POST ${BASE}/photos/acknowledge-removed). Answers {"acknowledged": n}. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/photos/acknowledge-removed`,
    input: {},
  });

  // ---- Photo library ----
  registerApiTool(server, client, {
    name: "list-business-profile-photo-library",
    description: `List the photos of the photo library, newest first (GET ${BASE}/photo-library). Scope: business-profiles:read.`,
    path: `${BASE}/photo-library`,
    input: { ...pageSchema, collection: z.string().optional().describe("Only photos of this collection.") },
  });

  registerApiTool(server, client, {
    name: "upload-business-profile-photos",
    description: `Add photos to the photo library from base64 content (POST ${BASE}/photo-library). JPG or PNG, 10 KB to 5 MB, at least 250 pixels on the short edge, at most 20 files. Answers {created, skipped}. Uploading files with multipart is only possible in the app. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/photo-library`,
    input: {
      category: z
        .enum(["ADDITIONAL", "COVER", "PROFILE", "EXTERIOR", "INTERIOR", "PRODUCT", "AT_WORK", "FOOD_AND_DRINK", "MENU", "COMMON_AREA", "ROOMS", "TEAMS"])
        .describe("Google photo category."),
      collection: z.string().max(120).optional().describe("Optional collection name."),
      files: z
        .array(z.object({ filename: z.string().max(250), contentBase64: z.string().describe("File content, base64 encoded.") }))
        .min(1)
        .max(20),
    },
  });

  registerApiTool(server, client, {
    name: "delete-business-profile-photo-library-item",
    description: `Delete a photo from the library (DELETE ${BASE}/photo-library/{id}). Not possible while it is planned or being published. Scope: business-profiles:write.`,
    method: "DELETE",
    path: `${BASE}/photo-library/{id}`,
    input: { id: id("Library photo") },
    destructive: true,
  });

  // ---- Photo schedules ----
  const photoScheduleFields = {
    ...scheduleFields,
    collection: z.string().max(120).nullable().optional().describe("Only use library photos of this collection."),
  };

  registerApiTool(server, client, {
    name: "list-business-profile-photo-schedules",
    description: `List the recurring photo schedules (GET ${BASE}/photo-schedules). Scope: business-profiles:read.`,
    path: `${BASE}/photo-schedules`,
    input: pageSchema,
  });

  registerApiTool(server, client, {
    name: "get-business-profile-photo-schedule",
    description: `Get a photo schedule (GET ${BASE}/photo-schedules/{id}). Scope: business-profiles:read.`,
    path: `${BASE}/photo-schedules/{id}`,
    input: { id: id("Photo schedule") },
  });

  registerApiTool(server, client, {
    name: "create-business-profile-photo-schedule",
    description: `Create a recurring photo schedule: every run one library photo per location (POST ${BASE}/photo-schedules). Needs the manage-business-profile-posts permission. Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/photo-schedules`,
    input: photoScheduleFields,
  });

  registerApiTool(server, client, {
    name: "update-business-profile-photo-schedule",
    description: `Replace a photo schedule (PUT ${BASE}/photo-schedules/{id}); send the full schedule like in create. Scope: business-profiles:write.`,
    method: "PUT",
    path: `${BASE}/photo-schedules/{id}`,
    input: { id: id("Photo schedule"), ...photoScheduleFields },
  });

  registerApiTool(server, client, {
    name: "delete-business-profile-photo-schedule",
    description: `Delete a photo schedule and its still-future photos that wait for approval or time (DELETE ${BASE}/photo-schedules/{id}). Scope: business-profiles:write.`,
    method: "DELETE",
    path: `${BASE}/photo-schedules/{id}`,
    input: { id: id("Photo schedule") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "toggle-business-profile-photo-schedule",
    description: `Pause an active photo schedule or resume a paused one (POST ${BASE}/photo-schedules/{id}/toggle). Scope: business-profiles:write.`,
    method: "POST",
    path: `${BASE}/photo-schedules/{id}/toggle`,
    input: { id: id("Photo schedule") },
  });
}
