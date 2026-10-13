import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { registerApiTool } from "./_shared.js";

const customerId = z.number().int().positive().describe("Customer id.");
const portalUserId = z.number().int().positive().describe("Portal user id.");

/** Tools for customer delete, labels, KvK merges, portal users, Mollie mandate and reminders. */
export function registerCustomerAdminTools(server: McpServer, client: ZentriaClient): void {
  registerApiTool(server, client, {
    name: "delete-customer",
    description:
      "Delete a customer, the same as the Delete button in the app (DELETE /api/public/customers/{id}). The default customer cannot be deleted. Prefer archive-customer when the data should be kept. Scope: customers:write.",
    method: "DELETE",
    path: "/api/public/customers/{id}",
    input: { id: customerId },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "pause-customer-reminders",
    description:
      "Pause payment reminders for all invoices of a customer (PATCH /api/public/customers/{id}/pause-reminders). Scope: customers:write.",
    method: "PATCH",
    path: "/api/public/customers/{id}/pause-reminders",
    input: { id: customerId, reason: z.string().min(1).max(255).describe("Why reminders are paused.") },
  });

  registerApiTool(server, client, {
    name: "resume-customer-reminders",
    description:
      "Resume payment reminders for a customer (PATCH /api/public/customers/{id}/resume-reminders). Scope: customers:write.",
    method: "PATCH",
    path: "/api/public/customers/{id}/resume-reminders",
    input: { id: customerId },
  });

  registerApiTool(server, client, {
    name: "list-customer-labels",
    description:
      "List the built-in customer labels and every label in use (GET /api/public/customers/labels). Custom labels are deletable. Scope: customers:read.",
    path: "/api/public/customers/labels",
    input: {},
  });

  registerApiTool(server, client, {
    name: "delete-customer-label",
    description:
      "Remove a custom label from every customer of the team, archived ones included (DELETE /api/public/customers/labels?label=). Built-in labels cannot be deleted. Scope: customers:write.",
    method: "DELETE",
    path: "/api/public/customers/labels",
    input: { label: z.string().min(1).max(40).describe("Label value to remove.") },
    query: ["label"],
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "list-customer-kvk-merges",
    description:
      "List groups of active customers with the same KvK number that may be merged (GET /api/public/customers/kvk-merges). Needs the edit-customers permission. Scope: customers:read.",
    path: "/api/public/customers/kvk-merges",
    input: {},
  });

  registerApiTool(server, client, {
    name: "merge-customers",
    description:
      "Merge a customer into another customer with the same KvK number (POST /api/public/customers/kvk-merges): campaigns, invoices, portal users and leads move to the survivor and the source customer is deleted. Scope: customers:write.",
    method: "POST",
    path: "/api/public/customers/kvk-merges",
    input: {
      survivorId: z.number().int().positive().describe("Customer that stays."),
      sourceId: z.number().int().positive().describe("Customer that is merged into the survivor and deleted."),
    },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "dismiss-customer-kvk-merge",
    description:
      "Dismiss a KvK merge proposal so it is not suggested again (POST /api/public/customers/kvk-merges/skip). Scope: customers:write.",
    method: "POST",
    path: "/api/public/customers/kvk-merges/skip",
    input: { kvk: z.string().min(1).max(20).describe("The KvK number of the proposal.") },
  });

  registerApiTool(server, client, {
    name: "list-customer-portal-users",
    description:
      "List the portal users of a customer, without any password data (GET /api/public/customers/{customerId}/portal-users). Scope: customers:read.",
    path: "/api/public/customers/{customerId}/portal-users",
    input: { customerId },
  });

  registerApiTool(server, client, {
    name: "invite-customer-portal-user",
    description:
      "Add a portal user and email them an invitation to choose a password (POST /api/public/customers/{customerId}/portal-users). Scope: portal-users:write.",
    method: "POST",
    path: "/api/public/customers/{customerId}/portal-users",
    input: { customerId, name: z.string().min(1).max(255), email: z.string().email() },
  });

  registerApiTool(server, client, {
    name: "resend-customer-portal-user-invitation",
    description:
      "Email a portal user a new invitation link (POST /api/public/customers/{customerId}/portal-users/{portalUserId}/resend-invitation). The current password is cleared, so this also resets a forgotten password. Passwords cannot be set through the API. Scope: portal-users:write.",
    method: "POST",
    path: "/api/public/customers/{customerId}/portal-users/{portalUserId}/resend-invitation",
    input: { customerId, portalUserId },
  });

  registerApiTool(server, client, {
    name: "set-customer-portal-user-active",
    description:
      "Activate or deactivate a portal user (PATCH /api/public/customers/{customerId}/portal-users/{portalUserId}). Scope: portal-users:write.",
    method: "PATCH",
    path: "/api/public/customers/{customerId}/portal-users/{portalUserId}",
    input: { customerId, portalUserId, isActive: z.boolean() },
  });

  registerApiTool(server, client, {
    name: "delete-customer-portal-user",
    description:
      "Delete a portal user (DELETE /api/public/customers/{customerId}/portal-users/{portalUserId}). Scope: portal-users:write.",
    method: "DELETE",
    path: "/api/public/customers/{customerId}/portal-users/{portalUserId}",
    input: { customerId, portalUserId },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "get-customer-mollie",
    description:
      "Direct debit mandate status (none, pending, active, inactive), last 4 digits of the IBAN and collection settings of a customer (GET /api/public/customers/{id}/mollie). Scope: invoices:read.",
    path: "/api/public/customers/{id}/mollie",
    input: { id: customerId },
  });

  registerApiTool(server, client, {
    name: "update-customer-collection",
    description:
      "Change how invoices of a customer are collected (PATCH /api/public/customers/{id}/mollie/collection). invoiceCollectionMethod sepa needs an active mandate. Scope: invoices:write.",
    method: "PATCH",
    path: "/api/public/customers/{id}/mollie/collection",
    input: {
      id: customerId,
      invoiceCollectionMethod: z.enum(["payment_link", "sepa"]).optional(),
      collectionEnabled: z.boolean().optional(),
      resumeCollection: z.boolean().optional().describe("true clears a collection pause."),
    },
  });

  registerApiTool(server, client, {
    name: "create-customer-mandate-checkout",
    description:
      "Create a Mollie checkout link the customer opens to give a direct debit mandate (POST /api/public/customers/{id}/mollie/mandate/checkout). Returns checkoutUrl. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/customers/{id}/mollie/mandate/checkout",
    input: { id: customerId },
  });

  registerApiTool(server, client, {
    name: "create-customer-offline-mandate",
    description:
      "Register a direct debit mandate the customer signed on paper (POST /api/public/customers/{id}/mollie/mandate/offline). The IBAN is write only and never returned. customerAccepted must be true. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/customers/{id}/mollie/mandate/offline",
    input: {
      id: customerId,
      accountHolderName: z.string().min(1).max(255),
      iban: z.string().min(1),
      customerAccepted: z.boolean().describe("Confirms the customer agreed to the mandate."),
    },
  });

  registerApiTool(server, client, {
    name: "resync-customer-mandate",
    description:
      "Fetch the mandate of a customer from Mollie again (POST /api/public/customers/{id}/mollie/mandate/resync). Fails (422) when Mollie has no usable mandate. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/customers/{id}/mollie/mandate/resync",
    input: { id: customerId },
  });

  registerApiTool(server, client, {
    name: "revoke-customer-mandate",
    description:
      "Revoke the direct debit mandate of a customer (DELETE /api/public/customers/{id}/mollie/mandate). Scope: invoices:write.",
    method: "DELETE",
    path: "/api/public/customers/{id}/mollie/mandate",
    input: { id: customerId },
    destructive: true,
  });
}
