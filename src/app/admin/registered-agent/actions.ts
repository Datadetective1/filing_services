"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { UUID_RE } from "@/components/admin/format";
import { requireAdmin, requireStaff } from "@/lib/auth/session";
import { closeProviderDocumentAlert, recordProviderCompanyId } from "@/lib/registered-agent/document-events";
import {
  isServiceDocumentKind,
  notifyCustomerOfDocument,
  recordNotificationAttempt,
  recordProviderCancelled,
  recordProviderRenewalDate,
  recordReplacementAgent,
  transitionProviderOrder,
  uploadServiceDocument,
} from "@/lib/registered-agent/operations";
import { PROVIDER_ORDER_STATUSES } from "@/lib/registered-agent/status";
import { actionError, fail, ok, parseForm } from "../_lib/action-helpers";

/**
 * Registered agent operator actions. Each re-authorizes staff, validates input, and calls a
 * service function that checks the rule again (and the database a third time).
 */

const id = z.string().regex(UUID_RE, "Unknown record.");
const status = z.enum(PROVIDER_ORDER_STATUSES);
const optionalText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional().default("");

function done(subId: string, message: string): ActionState {
  revalidatePath(`/admin/registered-agent/${subId}`);
  revalidatePath("/admin/registered-agent");
  return ok(message);
}

export async function transitionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(
    z.object({
      // Absent for a formation order with no registered agent service.
      subscriptionId: id.optional(),
      providerOrderId: id,
      expectedFrom: status,
      to: status,
      providerReference: optionalText(100),
      confirmedOn: optionalText(10),
      evidence: optionalText(2000),
      note: optionalText(2000),
      customerVisible: z.string().optional(),
      governmentFeeRemitted: optionalText(12),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const d = parsed.data;
  let remitted: number | null = null;
  if (d.governmentFeeRemitted) {
    const n = Number(d.governmentFeeRemitted.replace(/[$,]/g, ""));
    if (!Number.isFinite(n) || n < 0) return fail("Enter the state fee paid in dollars, like 25.00.");
    remitted = Math.round(n * 100);
  }
  try {
    await transitionProviderOrder(staff, {
      providerOrderId: d.providerOrderId,
      to: d.to,
      expectedFrom: d.expectedFrom,
      providerReference: d.providerReference || null,
      confirmedOn: d.confirmedOn || null,
      evidence: d.evidence || null,
      note: d.note || null,
      customerVisible: d.customerVisible === "on",
      governmentFeeRemittedCents: remitted,
    });
  } catch (e) {
    return actionError(e);
  }
  return done(d.subscriptionId ?? `formation/${d.providerOrderId}`, "Saved.");
}

export async function uploadDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const subscriptionId = formData.get("subscriptionId");
  const kind = formData.get("kind");
  const file = formData.get("file");
  const summary = String(formData.get("summary") ?? "").trim();
  const received = String(formData.get("providerReceivedAt") ?? "").trim();
  if (typeof subscriptionId !== "string" || !UUID_RE.test(subscriptionId)) return fail("Unknown subscription.");
  if (!isServiceDocumentKind(kind)) return fail("Choose what kind of document this is.");
  if (!(file instanceof File)) return fail("Choose a file to upload.");
  if (received && Number.isNaN(Date.parse(received))) return fail("Enter when the provider received it, or leave it blank.");
  try {
    const res = await uploadServiceDocument(staff, {
      subscriptionId,
      kind,
      file,
      summary: summary || null,
      providerReceivedAt: received ? new Date(received).toISOString() : null,
    });
    revalidatePath(`/admin/registered-agent/${subscriptionId}`);
    return ok(
      res.notified
        ? "Uploaded and the customer was emailed."
        : "Uploaded, but the email did not go out. Use Retry email, and for a legal document call the customer.",
    );
  } catch (e) {
    return actionError(e);
  }
}

export async function retryDocumentEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ subscriptionId: id, documentId: id }), formData);
  if (!parsed.ok) return fail(parsed.error);
  try {
    const sent = await notifyCustomerOfDocument(parsed.data.documentId, staff.id);
    revalidatePath(`/admin/registered-agent/${parsed.data.subscriptionId}`);
    return sent ? ok("Email sent.") : fail("The email did not go out (or was already sent). Check Emails, and call the customer for legal documents.");
  } catch (e) {
    return actionError(e);
  }
}

export async function notificationAttemptAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(
    z.object({
      subscriptionId: id,
      documentId: id,
      channel: z.enum(["phone", "sms", "email"]),
      status: z.enum(["sent", "delivered", "failed", "acknowledged"]),
      note: optionalText(1000),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  try {
    await recordNotificationAttempt(staff, { ...parsed.data, note: parsed.data.note || null });
  } catch (e) {
    return actionError(e);
  }
  return done(parsed.data.subscriptionId, "Recorded.");
}

export async function replacementAgentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ subscriptionId: id, name: z.string().trim().min(2, "Enter the new agent's name.").max(200) }), formData);
  if (!parsed.ok) return fail(parsed.error);
  try {
    await recordReplacementAgent(staff, parsed.data.subscriptionId, parsed.data.name);
  } catch (e) {
    return actionError(e);
  }
  return done(parsed.data.subscriptionId, "Recorded.");
}

export async function providerRenewalDateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ subscriptionId: id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date as YYYY-MM-DD.") }), formData);
  if (!parsed.ok) return fail(parsed.error);
  try {
    await recordProviderRenewalDate(staff, parsed.data.subscriptionId, parsed.data.date);
  } catch (e) {
    return actionError(e);
  }
  return done(parsed.data.subscriptionId, "Saved.");
}

export async function providerCancelledAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Provider cancellations bind the account owner personally: admins only.
  const staff = await requireAdmin();
  const parsed = parseForm(z.object({ subscriptionId: id, note: z.string().trim().min(3, "Note what you did.").max(500) }), formData);
  if (!parsed.ok) return fail(parsed.error);
  try {
    await recordProviderCancelled(staff, parsed.data.subscriptionId, parsed.data.note);
  } catch (e) {
    return actionError(e);
  }
  return done(parsed.data.subscriptionId, "Recorded.");
}

export async function providerCompanyIdAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(
    z.object({ subscriptionId: id, companyId: z.string().trim().regex(/^[A-Za-z0-9_.:-]{1,100}$/, "Enter the company ID exactly as the partner portal shows it.") }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  let linked: number;
  try {
    linked = await recordProviderCompanyId(staff, parsed.data.subscriptionId, parsed.data.companyId);
  } catch (e) {
    return actionError(e);
  }
  return done(parsed.data.subscriptionId, linked > 0 ? `Saved. Linked ${linked} earlier partner alert${linked === 1 ? "" : "s"}.` : "Saved.");
}

export async function closePartnerAlertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ subscriptionId: id, alertId: id, note: z.string().trim().min(3, "Note why no upload is needed.").max(500) }), formData);
  if (!parsed.ok) return fail(parsed.error);
  try {
    await closeProviderDocumentAlert(staff, parsed.data.alertId, parsed.data.note);
  } catch (e) {
    return actionError(e);
  }
  return done(parsed.data.subscriptionId, "Closed.");
}
