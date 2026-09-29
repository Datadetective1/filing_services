import "server-only";
import { createHash } from "node:crypto";
import { isProductionEnvironment } from "@/config/site";
import { trackServer } from "@/lib/analytics/server";
import { audit } from "@/lib/audit";
import type { StaffUser } from "@/lib/auth/session";
import { stableStringify } from "@/lib/compliance/hash";
import type { IntakeSchema } from "@/lib/compliance/types";
import { storeFilingDocument, type DocumentKind } from "@/lib/documents/storage";
import { canTransition, type FilingStatus } from "@/lib/domain/filing-status";
import { formatCents } from "@/lib/domain/money";
import { getEmailProvider } from "@/lib/email/provider";
import { validateAll } from "@/lib/intake/validate";
import { getPaymentProvider } from "@/lib/payments";
import { RefundRejectedError } from "@/lib/payments/types";
import { afterRefundSucceeded } from "@/lib/payments/process-event";
import { sendNotification, type SendNotificationInput, type SendResult } from "@/lib/notifications/send";
import { rollForwardRequirement } from "@/lib/reminders/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadFilingContext } from "./context";

/**
 * Operator actions. Every function takes an already-authorized StaffUser (the
 * caller must have run requireStaff / requireAdmin), changes status only through
 * transition_filing() — which writes status history + audit atomically — and
 * notifies the customer where appropriate.
 *
 * Once the status change has succeeded, later problems (an email that failed, a
 * receipt row that could not be written) are returned to the operator as the email
 * outcome and warnings instead of being thrown, so the screen never reports a
 * failure for a change that actually happened.
 */

export class OperationError extends Error {}

/**
 * What happened to a customer email, in operator terms:
 *  - delivered: handed to the email provider (Resend) for delivery
 *  - outbox: recorded in the Emails log but NOT delivered (outbox mode)
 *  - failed: the provider refused it, or it could not be recorded
 *  - suppressed: the customer has no email address
 *  - duplicate: the same email was already recorded earlier (not necessarily delivered)
 */
export type NotifyStatus = "delivered" | "outbox" | "failed" | "suppressed" | "duplicate";
export interface NotifyOutcome {
  status: NotifyStatus;
  notificationId: string | null;
}

/** Map sendNotification's result to what the operator is told. `provider` is the provider that was used. */
export function toNotifyOutcome(result: SendResult, provider: string): NotifyOutcome {
  if (result.status === "sent") return { status: provider === "resend" ? "delivered" : "outbox", notificationId: result.notificationId };
  return { status: result.status, notificationId: result.notificationId };
}

/** Result of an operator step after its main change succeeded. */
export interface OperationOutcome {
  /** The customer email this step sent, or null when the step sends none. */
  email: NotifyOutcome | null;
  /** Follow-up problems the operator must know about. */
  warnings: string[];
}

/** SHA-256 of the validated answers: the same value recorded on filing_authorizations.answers_sha256 at signing. */
export function answersSha256(schema: IntakeSchema, answers: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(validateAll(schema, answers).values)).digest("hex");
}

export interface ReadyToFileInput {
  schema: IntakeSchema | null | undefined;
  answers: Record<string, unknown>;
  /** filing_answers.is_complete (derived by the server on every save). */
  intakeComplete: boolean;
  /** answers_sha256 of the latest authorization, or null when none is recorded. */
  authorizationSha256: string | null;
  order: { status: string; payment_mode: string | null } | null;
  ruleVerificationStatus: string | null | undefined;
  /** True on the production deployment, where only live payments may be filed. */
  production: boolean;
}

/**
 * Why a filing must not be filed with the state yet. Empty means it may be.
 * Pure: shared by the server check and the order page, so both always agree.
 */
export function readyToFileBlockers(input: ReadyToFileInput): string[] {
  const blockers: string[] = [];
  const schema = input.schema?.sections ? input.schema : null;
  if (!schema) {
    blockers.push("This filing has no intake form on record. Escalate before filing.");
  } else if (!input.intakeComplete || !validateAll(schema, input.answers).ok) {
    blockers.push("The customer's details are incomplete. Use Request customer information before filing.");
  }
  if (!input.authorizationSha256) {
    blockers.push("No customer authorization is recorded. Ask the customer to review and sign before filing.");
  } else if (schema && answersSha256(schema, input.answers) !== input.authorizationSha256) {
    blockers.push("The customer's details changed after they signed. Ask them to review and sign again (Request customer information).");
  }
  if (!input.order || !["paid", "partially_refunded"].includes(input.order.status)) {
    blockers.push("The order is not paid. Do not file.");
  } else if (input.production && input.order.payment_mode !== "live") {
    blockers.push("This order was paid in test mode. No money was collected. Do not file it with the state.");
  }
  if (input.ruleVerificationStatus !== "verified") {
    blockers.push("This filing's rule is not verified. Escalate before filing.");
  }
  return blockers;
}

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

/**
 * Send one customer email and report what actually happened. Never throws: the
 * operator's step already succeeded, so a failure is reported, not raised.
 */
async function deliver(input: SendNotificationInput): Promise<NotifyOutcome> {
  try {
    const result = await sendNotification(input);
    return toNotifyOutcome(result, getEmailProvider().name);
  } catch (e) {
    console.error("[notify]", input.templateKey, e instanceof Error ? e.message : e);
    return { status: "failed", notificationId: null };
  }
}

async function notify(
  ctx: Awaited<ReturnType<typeof ctxOrThrow>>,
  templateKey: string,
  dedupeSuffix: string,
  extra: Record<string, string> = {},
): Promise<NotifyOutcome> {
  return deliver({
    userId: ctx.filing.userId,
    templateKey,
    dedupeKey: `${templateKey}:${ctx.filing.id}:${dedupeSuffix}`,
    vars: { ...ctx.vars, ...extra },
    ctaPath: `/dashboard/filings/${ctx.filing.id}`,
    filingId: ctx.filing.id,
    businessId: ctx.filing.businessId,
  });
}

/** Load everything readyToFileBlockers needs, from the database (never from the form). */
async function blockersFor(ctx: Awaited<ReturnType<typeof ctxOrThrow>>): Promise<string[]> {
  const db = createAdminClient();
  const [answersRes, authRes, orderRes] = await Promise.all([
    db.from("filing_answers").select("answers, is_complete").eq("filing_id", ctx.filing.id).maybeSingle(),
    db
      .from("filing_authorizations")
      .select("answers_sha256")
      .eq("filing_id", ctx.filing.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    ctx.filing.orderId
      ? db.from("orders").select("status, payment_mode").eq("id", ctx.filing.orderId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const loadError = answersRes.error ?? authRes.error ?? orderRes.error;
  if (loadError) throw new OperationError(`Could not check the filing before filing: ${loadError.message}`);
  const snapshot = ctx.filing.ruleSnapshot as { intake_schema?: IntakeSchema; verification_status?: string };
  return readyToFileBlockers({
    schema: snapshot.intake_schema,
    answers: (answersRes.data?.answers ?? {}) as Record<string, unknown>,
    intakeComplete: Boolean(answersRes.data?.is_complete),
    authorizationSha256: (authRes.data?.answers_sha256 as string | undefined) ?? null,
    order: (orderRes.data as { status: string; payment_mode: string | null } | null) ?? null,
    ruleVerificationStatus: snapshot.verification_status,
    production: isProductionEnvironment(),
  });
}

async function assertReadyToFile(ctx: Awaited<ReturnType<typeof ctxOrThrow>>) {
  const blockers = await blockersFor(ctx);
  if (blockers.length) throw new OperationError(`Don't file yet. ${blockers.join(" ")}`);
}

export async function markReadyToFile(staff: StaffUser, filingId: string, note?: string) {
  const ctx = await ctxOrThrow(filingId);
  await assertReadyToFile(ctx);
  await transition(filingId, "ready_to_file", staff, { note: note || "Reviewed and ready to file", expectedFrom: "ready_for_review" });
}

export async function markInProgress(staff: StaffUser, filingId: string) {
  // Re-checked here too: a filing can reach ready_to_file by retrying a rejection.
  const ctx = await ctxOrThrow(filingId);
  await assertReadyToFile(ctx);
  await transition(filingId, "in_progress", staff, { note: "Filing with the state", expectedFrom: "ready_to_file" });
}

export async function markSubmitted(
  staff: StaffUser,
  filingId: string,
  input: { confirmationNumber: string; submittedAt: string | null; note?: string },
): Promise<OperationOutcome> {
  const confirmation = input.confirmationNumber.trim();
  if (!confirmation || confirmation.length > 100) throw new OperationError("Enter the state confirmation number");
  const ctx = await ctxOrThrow(filingId);
  if (!["ready_to_file", "in_progress"].includes(ctx.filing.status)) {
    throw new OperationError(`Can't mark submitted from status ${ctx.filing.status}`);
  }
  // Same check as Mark ready to file and Start filing: a refunded, unpaid or re-edited
  // filing must never be recorded as submitted (Mark submitted is offered at ready_to_file too).
  await assertReadyToFile(ctx);
  const submittedAt = input.submittedAt ? new Date(input.submittedAt).toISOString() : new Date().toISOString();
  await transition(filingId, "submitted", staff, {
    note: input.note || "Submitted to the state",
    patch: { state_confirmation_number: confirmation, submitted_at: submittedAt },
    expectedFrom: ctx.filing.status,
  });
  // The confirmation number is already saved on the filing (and in its audit row).
  const warnings: string[] = [];
  const db = createAdminClient();
  // The state fee actually owed is the order's government fee ($0 for PA nonprofits), not the rule's base fee.
  const { data: order } = ctx.filing.orderId
    ? await db.from("orders").select("government_fee_cents").eq("id", ctx.filing.orderId).maybeSingle()
    : { data: null };
  const stateFeeCents = order
    ? Number(order.government_fee_cents)
    : Number((ctx.filing.ruleSnapshot as { state_fee_cents?: number }).state_fee_cents ?? 0);
  const { error: receiptError } = await db.from("filing_receipts").insert({
    filing_id: filingId,
    user_id: ctx.filing.userId,
    confirmation_number: confirmation,
    submitted_at: submittedAt,
    state_fee_paid_cents: stateFeeCents,
    recorded_by: staff.id,
    notes: input.note || null,
  });
  if (receiptError) warnings.push(`The receipt record could not be saved: ${receiptError.message}`);
  const fresh = await ctxOrThrow(filingId);
  const email = await notify(fresh, "filing_submitted", confirmation);
  return { email, warnings };
}

/**
 * Mark accepted. If a state receipt / filed report is already on file, the filing is
 * completed in the same step (the customer gets one "accepted" email, reminders for the
 * period are closed, and next period's requirement is opened). Without a receipt, the
 * "accepted" email waits until the receipt is uploaded, because it tells the customer
 * their documents are in the dashboard.
 */
export async function markAccepted(
  staff: StaffUser,
  filingId: string,
  input: { note?: string } = {},
): Promise<OperationOutcome & { completed: boolean }> {
  await transition(filingId, "accepted", staff, { note: input.note || "Accepted by the state", expectedFrom: "submitted" });
  const completion = await completeIfReceiptOnFile(staff, filingId);
  if (!completion) return { completed: false, email: null, warnings: [] };
  return { completed: true, ...completion };
}

/**
 * Complete an accepted filing whose receipt is on file, then send the single
 * "accepted" email. Returns null when the filing isn't accepted or has no receipt yet.
 */
async function completeIfReceiptOnFile(staff: StaffUser, filingId: string): Promise<OperationOutcome | null> {
  const db = createAdminClient();
  const { data: filing } = await db.from("filings").select("status, requirement_id, user_id, state_code").eq("id", filingId).single();
  if (filing?.status !== "accepted") return null;
  const { count } = await db
    .from("filing_documents")
    .select("id", { count: "exact", head: true })
    .eq("filing_id", filingId)
    .in("kind", ["state_receipt", "filed_report", "acknowledgement"])
    .eq("visible_to_customer", true);
  if (!count) return null;
  await transition(filingId, "completed", staff, { note: "Receipt delivered to customer", expectedFrom: "accepted" });
  const warnings: string[] = [];
  if (filing.requirement_id) {
    try {
      await rollForwardRequirement(filing.requirement_id);
    } catch (e) {
      warnings.push(`Next period's requirement could not be opened: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }
  await trackServer("filing_completed", { userId: filing.user_id, stateCode: filing.state_code, filingTypeCode: "annual_report", dedupeKey: `filing_completed:${filingId}` });
  const fresh = await ctxOrThrow(filingId);
  const email = await notify(fresh, "filing_accepted", "accepted");
  return { email, warnings };
}

export async function markRejected(staff: StaffUser, filingId: string, reason: string): Promise<OperationOutcome> {
  const text = reason.trim();
  if (text.length < 3) throw new OperationError("Enter the rejection reason");
  await transition(filingId, "rejected", staff, { note: text, patch: { rejection_reason: text }, expectedFrom: "submitted" });
  const ctx = await ctxOrThrow(filingId);
  const email = await notify(ctx, "filing_rejected", String(Date.now()), { message: text });
  return { email, warnings: [] };
}

export async function requestCustomerInformation(staff: StaffUser, filingId: string, message: string): Promise<OperationOutcome> {
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
  const email = await notify(ctx, "information_requested", String(Date.now()), { message: text });
  return { email, warnings: [] };
}

const DOCUMENT_LABELS: Record<string, string> = {
  state_receipt: "State receipt",
  filed_report: "Filed report",
  acknowledgement: "Acknowledgement letter",
};

export async function uploadFilingDocument(
  staff: StaffUser,
  filingId: string,
  input: { file: File; kind: DocumentKind; visibleToCustomer: boolean; confirmationNumber?: string | null },
): Promise<{
  id: string;
  sha256: string;
  /** True when this upload completed an accepted filing. */
  completed: boolean;
  /** The "document ready" email (customer-visible documents only). */
  documentEmail: NotifyOutcome | null;
  /** The "accepted" email, sent when this upload completed the filing. */
  acceptedEmail: NotifyOutcome | null;
  warnings: string[];
}> {
  const ctx = await ctxOrThrow(filingId);
  const doc = await storeFilingDocument({
    filingId,
    ownerUserId: ctx.filing.userId,
    file: input.file,
    kind: input.kind,
    uploadedBy: staff.id,
    visibleToCustomer: input.visibleToCustomer,
  });
  // Audit first: the document exists now, whatever happens next.
  await audit({
    actorUserId: staff.id,
    actorType: "staff",
    action: "document.uploaded",
    entityType: "filing_document",
    entityId: doc.id,
    filingId,
    after: { kind: input.kind, sha256: doc.sha256, visible_to_customer: input.visibleToCustomer },
  });
  const warnings: string[] = [];
  const db = createAdminClient();
  if (input.kind === "state_receipt" || input.kind === "filed_report" || input.kind === "acknowledgement") {
    const { data: receipt, error: findError } = await db
      .from("filing_receipts")
      .select("id")
      .eq("filing_id", filingId)
      .is("document_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error: linkError } = findError
      ? { error: findError }
      : receipt
        ? await db.from("filing_receipts").update({ document_id: doc.id }).eq("id", receipt.id)
        : await db.from("filing_receipts").insert({
            filing_id: filingId,
            user_id: ctx.filing.userId,
            document_id: doc.id,
            confirmation_number: input.confirmationNumber || ctx.filing.confirmationNumber,
            recorded_by: staff.id,
          });
    if (linkError) warnings.push(`The document is saved, but linking it to the receipt record failed: ${linkError.message}`);
  }
  // Receipt arriving after acceptance completes the filing (and sends the one "accepted" email).
  const completion = ctx.filing.status === "accepted" ? await completeIfReceiptOnFile(staff, filingId) : null;
  if (completion) warnings.push(...completion.warnings);
  const documentEmail = input.visibleToCustomer
    ? await deliver({
        userId: ctx.filing.userId,
        templateKey: "document_ready",
        dedupeKey: `document_ready:${doc.id}`,
        vars: {
          ...ctx.vars,
          businessName: ctx.businessName,
          filingName: ctx.filingTitle,
          documentLabel: DOCUMENT_LABELS[input.kind] ?? "Document",
        },
        ctaPath: `/dashboard/filings/${filingId}`,
        businessId: ctx.filing.businessId,
        filingId,
      })
    : null;
  return {
    id: doc.id,
    sha256: doc.sha256,
    completed: Boolean(completion),
    documentEmail,
    acceptedEmail: completion?.email ?? null,
    warnings,
  };
}

export async function completeFiling(staff: StaffUser, filingId: string): Promise<OperationOutcome> {
  const done = await completeIfReceiptOnFile(staff, filingId);
  if (!done) throw new OperationError("Upload the state receipt or filed report before completing");
  return done;
}

export async function cancelFiling(staff: StaffUser, filingId: string, reason: string): Promise<OperationOutcome> {
  const text = reason.trim();
  if (text.length < 3) throw new OperationError("Enter a cancellation reason");
  const ctx = await ctxOrThrow(filingId);
  await transition(filingId, "cancelled", staff, { note: text, expectedFrom: ctx.filing.status });
  const warnings: string[] = [];
  if (ctx.filing.orderId) {
    const { error } = await createAdminClient().from("orders").update({ cancelled_at: new Date().toISOString() }).eq("id", ctx.filing.orderId);
    if (error) warnings.push(`The order's cancellation time could not be saved: ${error.message}`);
  }
  const email = await notify(ctx, "filing_cancelled", "cancelled", { message: text });
  return { email, warnings };
}

export async function reopenFiling(staff: StaffUser, filingId: string, note: string) {
  const ctx = await ctxOrThrow(filingId);
  if (ctx.filing.status === "draft") throw new OperationError("Unpaid drafts can't be reopened");
  const { data: order } = ctx.filing.orderId
    ? await createAdminClient().from("orders").select("status").eq("id", ctx.filing.orderId).maybeSingle()
    : { data: null };
  if (!order || !["paid", "partially_refunded"].includes(order.status)) {
    throw new OperationError("Only paid filings can be reopened. This order is unpaid or fully refunded.");
  }
  const to: FilingStatus = ctx.filing.status === "rejected" ? "ready_to_file" : "ready_for_review";
  // Retrying a rejection skips review, so it gets the full ready-to-file check here.
  if (to === "ready_to_file") await assertReadyToFile(ctx);
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
    const message = e instanceof Error ? e.message.slice(0, 300) : "unknown";
    if (e instanceof RefundRejectedError) {
      // Definitive refusal: nothing was refunded, so release the amount for a corrected retry.
      await db.from("refunds").update({ status: "failed" }).eq("id", refund.id).eq("status", "pending");
      await audit({ actorUserId: admin.id, actorType: "staff", action: "refund.failed", entityType: "refund", entityId: refund.id, filingId, metadata: { error: message } });
      throw new OperationError("The payment processor rejected the refund. Nothing was refunded.");
    }
    // Ambiguous (timeout, processor error): the refund may have gone through. Keep it pending
    // (it still counts against the refundable balance, which prevents a double refund) until
    // the processor's webhook confirms or fails it.
    await audit({ actorUserId: admin.id, actorType: "staff", action: "refund.unconfirmed", entityType: "refund", entityId: refund.id, filingId, metadata: { error: message } });
    throw new OperationError("The processor didn't confirm the refund. It stays pending until the processor reports the result; don't issue it again.");
  }
  await db.from("refunds").update({ provider_refund_id: result.providerRefundId }).eq("id", refund.id);

  if (result.status !== "pending") {
    const { error: applyError } = await db.rpc("apply_refund_result", {
      p_refund_id: refund.id,
      p_status: result.status,
      p_provider_refund_id: result.providerRefundId,
    });
    if (applyError) throw new OperationError(applyError.message);
    // apply_refund_result audits as "webhook" without the filing; record who applied it, on the order's audit trail.
    await audit({ actorUserId: admin.id, actorType: "staff", action: "refund.applied", entityType: "refund", entityId: refund.id, filingId, after: { status: result.status } });
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
