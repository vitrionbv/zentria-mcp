import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { paginationSchema, registerApiTool } from "./_shared.js";

const invoiceId = z.number().int().positive().describe("Invoice id.");

const INVOICE_STATUSES = [
  "draft",
  "ready",
  "sent",
  "paid",
  "failed",
  "charged_back",
  "cancelled",
  "overdue",
  "draft_failed",
] as const;

/** Tools for invoices and invoice actions. Amounts are integer cents. */
export function registerInvoiceTools(server: McpServer, client: ZentriaClient): void {
  registerApiTool(server, client, {
    name: "list-invoices",
    description:
      "List invoices of customers with invoicing on, newest period first (GET /api/public/invoices). Amounts are integer cents. Scope: invoices:read.",
    path: "/api/public/invoices",
    input: {
      ...paginationSchema,
      customerId: z.number().int().positive().optional().describe("Only invoices of this customer."),
      status: z.enum(INVOICE_STATUSES).optional(),
      period: z.string().regex(/^\d{4}-W\d{2}$/).optional().describe("ISO week of the invoice, for example 2026-W07."),
      outstanding: z.boolean().optional().describe("true: only invoices that still have to be paid."),
      withLines: z.boolean().optional().describe("true: include the invoice lines."),
    },
  });

  registerApiTool(server, client, {
    name: "get-invoice",
    description:
      "Fetch an invoice with its lines, payment attempts and reminder log (GET /api/public/invoices/{id}). Scope: invoices:read.",
    path: "/api/public/invoices/{id}",
    input: { id: invoiceId },
  });

  registerApiTool(server, client, {
    name: "get-customer-invoice-summary",
    description:
      "Invoice totals of one customer per status, the outstanding amount and a compact list of its invoices (GET /api/public/customers/{id}/invoice-summary). Scope: invoices:read.",
    path: "/api/public/customers/{id}/invoice-summary",
    input: { id: z.number().int().positive().describe("Customer id.") },
  });

  registerApiTool(server, client, {
    name: "mark-invoice-ready",
    description:
      "Mark a draft invoice as ready for collection (POST /api/public/invoices/{id}/ready). Refused (422) before the billing moment of its week or when it is no longer a draft. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/ready",
    input: { id: invoiceId },
  });

  registerApiTool(server, client, {
    name: "cancel-invoice",
    description:
      "Cancel an invoice: the Mollie sales invoice is cancelled and the leads are released (POST /api/public/invoices/{id}/cancel). Refused (422) when the invoice cannot be cancelled. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/cancel",
    input: { id: invoiceId, reason: z.string().max(255).optional().describe("Reason for the cancellation.") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "mark-invoice-charged-back",
    description:
      "Mark an invoice as charged back (POST /api/public/invoices/{id}/charged-back). Refused (422) for a draft, an invoice that is already charged back, or one that was never collected. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/charged-back",
    input: { id: invoiceId },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "collect-invoice",
    description:
      "Start or retry the collection of an invoice that is ready, failed or sent; the payment runs in the background (POST /api/public/invoices/{id}/collect). Refused (422) for other statuses. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/collect",
    input: { id: invoiceId },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "skip-invoice-collection",
    description:
      "Keep an invoice out of the automatic collection (POST /api/public/invoices/{id}/skip-collection). Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/skip-collection",
    input: { id: invoiceId },
  });

  registerApiTool(server, client, {
    name: "unskip-invoice-collection",
    description:
      "Put an invoice back in the automatic collection (POST /api/public/invoices/{id}/unskip-collection). Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/unskip-collection",
    input: { id: invoiceId },
  });

  registerApiTool(server, client, {
    name: "pause-invoice-reminders",
    description:
      "Pause payment reminders for an invoice (POST /api/public/invoices/{id}/pause-reminders). Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/pause-reminders",
    input: { id: invoiceId, reason: z.string().min(1).max(255).describe("Why reminders are paused.") },
  });

  registerApiTool(server, client, {
    name: "resume-invoice-reminders",
    description:
      "Resume payment reminders for an invoice (POST /api/public/invoices/{id}/resume-reminders). Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/resume-reminders",
    input: { id: invoiceId },
  });
}
