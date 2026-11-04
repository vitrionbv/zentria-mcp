import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import { paginationSchema, registerApiTool } from "./_shared.js";

const invoiceId = z.number().int().positive().describe("Invoice id.");

const adjustmentId = z.number().int().positive().describe("Invoice correction id.");

const ADJUSTMENT_REASONS = ["reclamation", "duplicate_lead", "price_correction", "other"] as const;

const ADJUSTMENT_STATUSES = ["pending", "applied", "settled_externally", "withdrawn"] as const;

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
      "List invoices of customers with invoicing on, newest period first (GET /api/public/invoices). Amounts are integer cents. remindersPauseSource says who paused reminders: automatic (after the team's auto-pause number of reminders on that invoice) or manual (a person); read it instead of the free-text remindersPausedReason. Scope: invoices:read.",
    path: "/api/public/invoices",
    input: {
      ...paginationSchema,
      customerId: z.number().int().positive().optional().describe("Only invoices of this customer."),
      status: z.enum(INVOICE_STATUSES).optional(),
      period: z.string().regex(/^\d{4}-W\d{2}$/).optional().describe("ISO week of the invoice, for example 2026-W07."),
      outstanding: z.boolean().optional().describe("true: only invoices that still have to be paid: ready, sent, failed or overdue. Drafts and charged back invoices are left out."),
      withLines: z.boolean().optional().describe("true: include the invoice lines."),
    },
  });

  registerApiTool(server, client, {
    name: "get-invoice",
    description:
      "Fetch an invoice with its lines, payment attempts and reminder log (GET /api/public/invoices/{id}). remindersPauseSource says who paused reminders: automatic (after the team's auto-pause number of reminders on that invoice) or manual (a person); read it instead of the free-text remindersPausedReason. Scope: invoices:read.",
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
    name: "get-invoice-pdf-link",
    description:
      "Get a download link for the official Mollie PDF of an issued invoice (POST /api/public/invoices/{id}/pdf-link). Returns url, expiresAt (15 minutes), fileName (after the Mollie invoice number) and invoiceNumber. The link works without an API key, so share it only with people who may see the invoice. Refused (422) for a draft that is not issued in Mollie yet; 404 when Mollie has no PDF (hasPdf on the invoice is false). Scope: invoices:read.",
    method: "POST",
    path: "/api/public/invoices/{id}/pdf-link",
    input: { id: invoiceId },
    readOnly: true,
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
      "Cancel an issued (sent) or overdue invoice (POST /api/public/invoices/{id}/cancel). The Mollie sales invoice is cancelled, and Zentria then builds and issues a replacement invoice for the same week with the approved leads, so those leads are billed again. To drop an invoice without billing its leads again, use skip-invoice-collection instead. Refused (422) for a draft, a paid invoice or another status that cannot be cancelled. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/cancel",
    input: { id: invoiceId, reason: z.string().max(255).optional().describe("Reason for the cancellation.") },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "mark-invoice-paid",
    description:
      "Mark an issued (sent), overdue or failed invoice as paid by hand, for example after a bank transfer (POST /api/public/invoices/{id}/mark-paid). Zentria sets the Mollie sales invoice to paid with a manual payment, stops the reminders and sends the invoice.paid webhook. Refused (422) while a collection is running (collectingAt set or mollieStatus pending-payment) so the customer does not pay twice, and for a paid invoice or one without a Mollie sales invoice. When credits for leads on the invoice are still open, the reply has a warning. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/mark-paid",
    input: {
      id: invoiceId,
      paidAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Payment date (YYYY-MM-DD), not in the future. Default today. Stored in Zentria only."),
      note: z.string().max(255).optional().describe("Note, for example the bank transfer reference."),
    },
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
      "Keep an invoice out of the automatic collection: it is not issued or collected (POST /api/public/invoices/{id}/skip-collection). Its leads stay on this invoice, so they are not billed on a later invoice either. Use this to drop a draft invoice. Works on a draft, ready, failed or sent invoice. Scope: invoices:write.",
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
      "Pause payment reminders for an invoice (POST /api/public/invoices/{id}/pause-reminders). Sets remindersPauseSource to manual. Scope: invoices:write.",
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

  registerApiTool(server, client, {
    name: "list-invoice-adjustments",
    description:
      "List invoice corrections (discounts, extra charges and lead credits), newest first (GET /api/public/invoice-adjustments). Use status=pending for credits that still wait for the next invoice. Negative amounts are a credit, in integer cents. Scope: invoices:read.",
    path: "/api/public/invoice-adjustments",
    input: {
      ...paginationSchema,
      customerId: z.number().int().positive().optional().describe("Only corrections of this customer."),
      invoiceId: z.number().int().positive().optional().describe("Only corrections on this invoice."),
      crmLeadId: z.number().int().positive().optional().describe("Only corrections for this lead."),
      status: z.enum(ADJUSTMENT_STATUSES).optional(),
    },
  });

  registerApiTool(server, client, {
    name: "get-invoice-adjustment",
    description: "Fetch one invoice correction (GET /api/public/invoice-adjustments/{id}). Scope: invoices:read.",
    path: "/api/public/invoice-adjustments/{id}",
    input: { id: adjustmentId },
  });

  registerApiTool(server, client, {
    name: "add-invoice-adjustment",
    description:
      "Add a correction line to a draft invoice (POST /api/public/invoices/{id}/adjustments): a discount (negative amountCents) or an extra charge (positive). The description is shown to the customer. The invoice total cannot go below zero. Refused (422) when the invoice is not a draft; for a lead on a sent invoice use credit-crm-lead. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoices/{id}/adjustments",
    input: {
      id: invoiceId,
      amountCents: z.number().int().describe("Integer cents, ex VAT. Negative for a discount, positive for an extra charge. Not 0."),
      reason: z.enum(ADJUSTMENT_REASONS),
      description: z.string().min(1).max(255).describe("Text on the invoice, for example 'Korting dubbele aanvraag'."),
      crmLeadId: z.number().int().positive().optional().describe("The lead this correction is about, if any."),
    },
  });

  registerApiTool(server, client, {
    name: "remove-invoice-adjustment",
    description:
      "Take a correction off its draft invoice (DELETE /api/public/invoice-adjustments/{id}). A manual correction is deleted; a lead credit goes back to waiting for the next invoice. Refused (422) when the invoice is no longer a draft. Scope: invoices:write.",
    method: "DELETE",
    path: "/api/public/invoice-adjustments/{id}",
    input: { id: adjustmentId },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "credit-crm-lead",
    description:
      "Credit a lead that is on an invoice that already went out (POST /api/public/crm/leads/{id}/credit). Without amountCents the full billed amount is credited. The credit is deducted on the open draft of the customer, or waits for the next invoice. A lead on a draft invoice cannot be credited: reject it instead. Scope: invoices:write.",
    method: "POST",
    path: "/api/public/crm/leads/{id}/credit",
    input: {
      id: z.number().int().positive().describe("CRM lead id."),
      reason: z.enum(ADJUSTMENT_REASONS),
      amountCents: z.number().int().positive().optional().describe("Integer cents ex VAT to credit, at most what was billed for the lead."),
      description: z.string().max(255).optional().describe("Text on the invoice. Defaults to the reason and the lead."),
    },
  });

  registerApiTool(server, client, {
    name: "withdraw-invoice-adjustment",
    description:
      "Withdraw a waiting (pending) correction so it never lands on an invoice (POST /api/public/invoice-adjustments/{id}/withdraw). Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoice-adjustments/{id}/withdraw",
    input: { id: adjustmentId },
    destructive: true,
  });

  registerApiTool(server, client, {
    name: "settle-invoice-adjustment",
    description:
      "Mark a waiting (pending) credit as settled outside Zentria, for example with a credit note or refund in Mollie (POST /api/public/invoice-adjustments/{id}/settle). Scope: invoices:write.",
    method: "POST",
    path: "/api/public/invoice-adjustments/{id}/settle",
    input: { id: adjustmentId, reference: z.string().max(255).optional().describe("For example the credit note number.") },
  });
}
