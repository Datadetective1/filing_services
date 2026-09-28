import "server-only";
import { trackServer } from "@/lib/analytics/server";
import { audit } from "@/lib/audit";
import type { StaffUser } from "@/lib/auth/session";
import { storeFilingDocument, type DocumentKind } from "@/lib/documents/storage";
import { canTransition, type FilingStatus } from "@/lib/domain/filing-status";
import { formatCents } from "@/lib/domain/money";
import { getPaymentProvider } from "@/lib/payments";
import { afterRefundSucceeded } from "@/lib/payments/process-event";
import { sendNotification } from "@/lib/notifications/send";
import { rollForwardRequirement } from "@/lib/reminders/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadFilingContext } from "./context";

/**
 * Operator actions. Every function takes an already-authorized StaffUser (the
 * caller must have run requireStaff / requireAdmin), changes status only through
 * transition_filing() — which writes status history + audit atomically — and
 * notifies the customer where appropriate.
 */

export class OperationError extends Error {}

async function transition(
  filingId: string,
  to: FilingStatus,
  staff: StaffUser | null,
  opts: { note?: string | null; customerVisible?: boolean; patch?: Record<string, unknown>; expectedFrom?: FilingStatus } = {},
) {
  const { error } = await createAdminClient().rpc("transition_filing", {
    p_filing_id: filingId,
    p_to_status: to,
    p_actor_user_id: staff?.id ?? null,
    p_actor_type: staff ? "staff" : "system",
    p_note: opts.note ?? null,
    p_customer_visible: opts.customerVisible ?? true,
    p_patch: opts.patch ?? {},
    p_expected_from: opts.expectedFrom ?? null,
  });
  if (error) throw new OperationError(error.message);
}

async function ctxOrThrow(filingId: string) {
  const ctx = await loadFilingContext(filingId);
  if (!ctx) throw new OperationError("Filing not found");
  return ctx;
}

async function notify(ctx: Awaited<ReturnType<typeof ctxOrThrow>>, templateKey: string, dedupeSuffix: string, extra: Record<string, string> = {}) {
  await sendNotification({
    userId: ctx.filing.userId,
    templateKey,
    dedupeKey: `${templateKey}:${ctx.filing.id}:${dedupeSuffix}`,
    vars: { ...ctx.vars, ...extra },
    ctaPath: `/dashboard/filings/${ctx.filing.id}`,
    filingId: ctx.filing.id,
    businessId: ctx.filing.businessId,
  });
}

export async function markReadyToFile(staff: StaffUser, filingId: string, note?: string) {
  await transition(filingId, "ready_to_file", staff, { note: note || "Reviewed and ready to file", expectedFrom: "ready_for_review" });
}

export async function markInProgress(staff: StaffUser, filingId: string) {
  await transition(filingId, "in_progress", staff, { note: "Filing with the state", expectedFrom: "ready_to_file" });
}

export async function markSubmitted(
  staff: StaffUser,
  filingId: string,
  input: { confirmationNumber: string; submittedAt: string | null; note?: string },
) {
  const confirmation = input.confirmationNumber.trim();
  if (!confirmation || confirmation.length > 100) throw new OperationError("Enter the state confirmation number");
  const ctx = await ctxOrThrow(filingId);
  if (!["ready_to_file", "in_progress"].includes(ctx.filing.status)) {
    throw new OperationError(`Can't mark submitted from status ${ctx.filing.status}`);
  }
  const submittedAt = input.submittedAt ? new Date(input.submittedAt).toISOString() : new Date().toISOString();
  await transition(filingId, "submitted", staff, {
    note: input.note || "Submitted to the state",
    patch: { state_confirmation_number: confirmation, submitted_at: submittedAt },
    expectedFrom: ctx.filing.status,
  });
  const { error: receiptError } = await createAdminClient().from("filing_receipts").insert({
    filing_id: filingId,
    user_id: ctx.filing.userId,
    confirmation_number: confirmation,
    submitted_at: submittedAt,
    state_fee_paid_cents: Number((ctx.filing.ruleSnapshot as { state_fee_cents?: number }).state_fee_cents ?? 0),
    recorded_by: staff.id,
    notes: input.note || null,
  });
  if (receiptError) throw new OperationError(`Submitted, but the receipt record failed: ${receiptError.message}`);
  const fresh = await ctxOrThrow(filingId);
  await notify(fresh, "filing_submitted", confirmation);
}

/**
 * Mark accepted. If a state receipt / filed report is already on file, the filing is
 * completed in the same step (the customer gets one "accepted" email, reminders for the
 * period are closed, and next period's requirement is opened).
 */
export async function markAccepted(staff: StaffUser, filingId: string, input: { note?: string } = {}) {
  await transition(filingId, "accepted", staff, { note: input.note || "Accepted by the state", expectedFrom: "submitted" });
  await completeIfReceiptOnFile(staff, filingId);
  const fresh = await ctxOrThrow(filingId);
  await notify(fresh, "filing_accepted", "accepted");
}

async function completeIfReceiptOnFile(staff: StaffUser, filingId: string) {
  const db = createAdminClient();
  const { data: filing } = await db.from("filings").select("status, requirement_id, user_id, state_code").eq("id", filingId).single();
  if (filing?.status !== "accepted") return false;
  const { count } = await db
    .from("filing_documents")
    .select("id", { count: "exact", head: true })
    .eq("filing_id", filingId)
    .in("kind", ["state_receipt", "filed_report", "acknowledgement"])
    .eq("visible_to_customer", true);
  if (!count) return false;
  await transition(filingId, "completed", staff, { note: "Receipt delivered to customer", expectedFrom: "accepted" });
  if (filing.requirement_id) await rollForwardRequirement(filing.requirement_id);
  await trackServer("filing_completed", { userId: filing.user_id, stateCode: filing.state_code, filingTypeCode: "annual_report", dedupeKey: `filing_completed:${filingId}` });
  return true;
}

export async function markRejected(staff: StaffUser, filingId: string, reason: string) {
  const text = reason.trim();
  if (text.length < 3) throw new OperationError("Enter the rejection reason");
  await transition(filingId, "rejected", staff, { note: text, patch: { rejection_reason: text }, expectedFrom: "submitted" });
  const ctx = await ctxOrThrow(filingId);
  await notify(ctx, "filing_rejected", String(Date.now()), { message: text });
}

export async function requestCustomerInformation(staff: StaffUser, filingId: string, message: string) {
  const text = message.trim();
  if (text.length < 3 || text.length > 5000) throw new OperationError("Write a message for the customer (3 to 5000 characters)");
  const ctx = await ctxOrThrow(filingId);
  const waiting = ctx.filing.status === "needs_customer_action" || ctx.filing.status === "needs_information";
  if (!waiting && !canTransition(ctx.filing.status, "needs_customer_action")) {
    throw new OperationError(`Can't request information while the filing is ${ctx.filing.status}`);
  }
  const db = createAdminClient();
  const { error: msgError } = await db
    .from("messages")
    .insert({ filing_id: filingId, user_id: ctx.filing.userId, author_id: staff.id, author_type: "staff", body: text });
  if (msgError) throw new OperationError(msgError.message);
  if (!waiting) {
    await transition(filingId, "needs_customer_action", staff, { note: "Information requested from customer", expectedFrom: ctx.filing.status });
  } else {
    await audit({ actorUserId: staff.id, actorType: "staff", action: "filing.information_requested", entityType: "filing", entityId: filingId, filingId });
  }
  await notify(ctx, "information_requested", String(Date.now()), { message: text });
}

export async function uploadFilingDocument(
  staff: StaffUser,
  filingId: string,
  input: { file: File; kind: DocumentKind; visibleToCustomer: boolean; confirmationNumber?: string | null },
) {
  const ctx = await ctxOrThrow(filingId);
  const doc = await storeFilingDocument({
    filingId,
    ownerUserId: ctx.filing.userId,
    file: input.file,
    kind: input.kind,
    uploadedBy: staff.id,
    visibleToCustomer: input.visibleToCustomer,
  });
  const db = createAdminClient();
  if (input.kind === "state_receipt" || input.kind === "filed_report" || input.kind === "acknowledgement") {
    const { data: receipt } = await db
      .from("filing_receipts")
      .select("id")
      .eq("filing_id", filingId)
      .is("document_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (receipt) await db.from("filing_receipts").update({ document_id: doc.id }).eq("id", receipt.id);
    else
      await db.from("filing_receipts").insert({
        filing_id: filingId,
        user_id: ctx.filing.userId,
        document_id: doc.id,
        confirmation_number: input.confirmationNumber || ctx.filing.confirmationNumber,
        recorded_by: staff.id,
      });
  }
  await audit({
    actorUserId: staff.id,
    actorType: "staff",
    action: "document.uploaded",
    entityType: "filing_document",
    entityId: doc.id,
    filingId,
    after: { kind: input.kind, sha256: doc.sha256, visible_to_customer: input.visibleToCustomer },
  });
  // Receipt arriving after acceptance completes the filing.
  if (ctx.filing.status === "accepted") await completeIfReceiptOnFile(staff, filingId);
  return doc;
}

export async function completeFiling(staff: StaffUser, filingId: string) {
  const done = await completeIfReceiptOnFile(staff, filingId);
  if (!done) throw new OperationError("Upload the state receipt or filed report before completing");
}

export async function cancelFiling(staff: StaffUser, filingId: string, reason: string) {
  const text = reason.trim();
  if (text.length < 3) throw new OperationError("Enter a cancellation reason");
  const ctx = await ctxOrThrow(filingId);
  await transition(filingId, "cancelled", staff, { note: text, expectedFrom: ctx.filing.status });
  if (ctx.filing.orderId) {
    await createAdminClient().from("orders").update({ cancelled_at: new Date().toISOString() }).eq("id", ctx.filing.orderId);
  }
  await notify(ctx, "filing_cancelled", "cancelled", { message: text });
}

export async function reopenFiling(staff: StaffUser, filingId: string, note: string) {
  const ctx = await ctxOrThrow(filingId);
  if (ctx.filing.status === "draft") throw new OperationError("Unpaid drafts can't be reopened");
  const to: FilingStatus = ctx.filing.status === "rejected" ? "ready_to_file" : "ready_for_review";
  await transition(filingId, to, staff, { note: note.trim() || "Reopened", expectedFrom: ctx.filing.status });
}

export async function assignOperator(staff: StaffUser, filingId: string, assigneeId: string | null) {
  const { error } = await createAdminClient().rpc("assign_filing", {
    p_filing_id: filingId,
    p_assignee: assigneeId,
    p_actor_user_id: staff.id,
  });
  if (error) throw new OperationError(error.message);
}

export async function addInternalNote(staff: StaffUser, filingId: string, body: string) {
  const text = body.trim();
  if (!text || text.length > 5000) throw new OperationError("Notes must be 1 to 5000 characters");
  const { data, error } = await createAdminClient()
    .from("admin_notes")
    .insert({ filing_id: filingId, author_id: staff.id, body: text })
    .select("id")
    .single();
  if (error) throw new OperationError(error.message);
  await audit({ actorUserId: staff.id, actorType: "staff", action: "note.added", entityType: "admin_note", entityId: data.id, filingId });
}

/**
 * Refund (admin only). Government and service portions are recorded separately.
 * A full refund of a cancelled filing moves it to "refunded".
 */
export async function refundFiling(
  admin: StaffUser,
  filingId: string,
  input: { governmentFeeCents: number; serviceFeeCents: number; reason: string },
) {
  if (admin.role !== "admin") throw new OperationError("Only admins can issue refunds");
  const reason = input.reason.trim();
  if (reason.length < 3) throw new OperationError("Enter a refund reason");
  const gov = Math.round(input.governmentFeeCents);
  const svc = Math.round(input.serviceFeeCents);
  if (gov < 0 || svc < 0 || gov + svc <= 0) throw new OperationError("Enter a refund amount");

  const ctx = await ctxOrThrow(filingId);
  if (!ctx.filing.orderId) throw new OperationError("This filing has no order");
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*").eq("id", ctx.filing.orderId).single();
  const { data: payment } = await db
    .from("payments")
    .select("*")
    .eq("order_id", ctx.filing.orderId)
    .in("status", ["succeeded", "partially_refunded"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!order || !payment) throw new OperationError("No captured payment to refund");

  const { data: prior } = await db.from("refunds").select("government_fee_cents, service_fee_cents, status").eq("order_id", order.id).neq("status", "failed");
  const govRefunded = (prior ?? []).reduce((s, r) => s + r.government_fee_cents, 0);
  const svcRefunded = (prior ?? []).reduce((s, r) => s + r.service_fee_cents, 0);
  if (gov > order.government_fee_cents - govRefunded) throw new OperationError("Government fee refund exceeds what remains");
  if (svc > order.service_fee_cents - svcRefunded) throw new OperationError("Service fee refund exceeds what remains");
  if (!payment.provider_payment_id) throw new OperationError("Payment has no processor reference");

  const provider = getPaymentProvider();
  if (provider.name !== payment.provider) throw new OperationError("Payment was taken with a different provider");

  const { data: refund, error } = await db
    .from("refunds")
    .insert({
      payment_id: payment.id,
      order_id: order.id,
      user_id: order.user_id,
      amount_cents: gov + svc,
      government_fee_cents: gov,
      service_fee_cents: svc,
      reason,
      status: "pending",
      requested_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !refund) throw new OperationError(error?.message ?? "Could not create refund");
  await audit({ actorUserId: admin.id, actorType: "staff", action: "refund.requested", entityType: "refund", entityId: refund.id, filingId, after: { government_fee_cents: gov, service_fee_cents: svc, reason } });

  let result;
  try {
    result = await provider.refund({
      providerPaymentId: payment.provider_payment_id,
      amountCents: gov + svc,
      internalRefundId: refund.id,
      reason,
      idempotencyKey: `refund:${refund.id}`,
    });
  } catch (e) {
    // Never leave an orphaned pending refund: it would reduce the refundable balance forever.
    await db.from("refunds").update({ status: "failed" }).eq("id", refund.id).eq("status", "pending");
    await audit({ actorUserId: admin.id, actorType: "staff", action: "refund.failed", entityType: "refund", entityId: refund.id, filingId, metadata: { error: e instanceof Error ? e.message.slice(0, 300) : "unknown" } });
    throw new OperationError("The payment processor rejected the refund. Nothing was refunded.");
  }
  await db.from("refunds").update({ provider_refund_id: result.providerRefundId }).eq("id", refund.id);

  if (result.status !== "pending") {
    const { error: applyError } = await db.rpc("apply_refund_result", {
      p_refund_id: refund.id,
      p_status: result.status,
      p_provider_refund_id: result.providerRefundId,
    });
    if (applyError) throw new OperationError(applyError.message);
    if (result.status === "succeeded") await afterRefundSucceeded(refund.id);
  }

  // Fully refunded + cancelled => refunded.
  const { data: after } = await db.from("orders").select("status").eq("id", order.id).single();
  const { data: filing } = await db.from("filings").select("status").eq("id", filingId).single();
  if (after?.status === "refunded" && filing?.status === "cancelled") {
    await transition(filingId, "refunded", admin, { note: `Refunded ${formatCents(gov + svc)}`, expectedFrom: "cancelled" });
  }
  return { refundId: refund.id as string, status: result.status };
}
