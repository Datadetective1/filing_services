"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { dollarsToCents, formatDate, opsToday, UUID_RE, zonedStartOfDay } from "@/components/admin/format";
import { emailOutcomeText, operatorMessage } from "@/components/admin/operator-guidance";
import { ADMIN_STATUS_LABELS } from "@/components/admin/status";
import { audit } from "@/lib/audit";
import { requireAdmin, requireStaff } from "@/lib/auth/session";
import { MAX_DOCUMENT_BYTES } from "@/lib/documents/storage";
import { canTransition, isFilingStatus, type FilingStatus } from "@/lib/domain/filing-status";
import {
  addInternalNote,
  assignOperator,
  cancelFiling,
  completeFiling,
  markAccepted,
  markInProgress,
  markReadyToFile,
  markRejected,
  markSubmitted,
  refundFiling,
  reopenFiling,
  requestCustomerInformation,
  uploadFilingDocument, recordComparisonCheckpoint } from "@/lib/filings/operations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { actionError, fail, ok, parseForm } from "../../_lib/action-helpers";

/**
 * Operator actions on one filing. Every action re-authorizes (requireStaff, or
 * requireAdmin for refunds), validates its input with zod, re-reads the filing's
 * current status from the database (never from the form), and changes status only
 * through src/lib/filings/operations.ts, which writes status history + audit.
 */

const filingId = z.string().regex(UUID_RE, "Unknown filing.");
const optionalNote = z.string().trim().max(1000, "Keep the note under 1,000 characters.").optional().default("");
const reason = z
  .string({ error: "Enter a reason." })
  .trim()
  .min(3, "Enter a reason of at least 3 characters.")
  .max(1000, "Keep the reason under 1,000 characters.");
const customerMessage = z
  .string({ error: "Write a message for the customer." })
  .trim()
  .min(3, "Write a message of at least 3 characters.")
  .max(5000, "Keep the message under 5,000 characters.");
const confirmed = z.literal("yes", { error: "Tick the confirmation box to continue." });

interface FilingState {
  id: string;
  status: FilingStatus;
  user_id: string;
  order_id: string | null;
}

async function loadFiling(id: string): Promise<FilingState | null> {
  const db = await createClient();
  const { data } = await db.from("filings").select("id, status, user_id, order_id").eq("id", id).maybeSingle();
  if (!data || !isFilingStatus(data.status)) return null;
  return data as FilingState;
}

function statusLabel(status: FilingStatus) {
  return ADMIN_STATUS_LABELS[status];
}

function done(id: string, message: string, details?: { label: string; value: string }[]): ActionState {
  revalidatePath(`/admin/filings/${id}`);
  revalidatePath(`/admin/filings/${id}/packet`);
  return ok(message, details);
}

function canRequestInformation(status: FilingStatus) {
  return status === "needs_customer_action" || status === "needs_information" || canTransition(status, "needs_customer_action");
}

// ---------------------------------------------------------------------------
// Status actions
// ---------------------------------------------------------------------------

export async function requestInformationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ filingId, message: customerMessage }), formData);
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  if (!canRequestInformation(filing.status)) {
    return fail(`You can't request information while the filing is "${statusLabel(filing.status)}".`);
  }
  let result;
  try {
    result = await requestCustomerInformation(staff, filing.id, parsed.data.message);
  } catch (e) {
    return actionError(e);
  }
  return done(
    filing.id,
    operatorMessage(["Request sent. The filing is now waiting on the customer.", emailOutcomeText(result.email, "the request")], result.warnings),
  );
}

export async function markReadyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ filingId, note: optionalNote }), formData);
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  if (filing.status !== "ready_for_review") return fail(`Only filings in review can be marked ready. This one is "${statusLabel(filing.status)}".`);
  try {
    await markReadyToFile(staff, filing.id, parsed.data.note || undefined);
  } catch (e) {
    return actionError(e);
  }
  return done(filing.id, "Marked ready to file.");
}

export async function startFilingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ filingId }), formData);
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  if (filing.status !== "ready_to_file") return fail(`Only filings that are ready to file can be started. This one is "${statusLabel(filing.status)}".`);
  try {
    await markInProgress(staff, filing.id);
  } catch (e) {
    return actionError(e);
  }
  return done(filing.id, "Filing started. Open the packet and the official filing site.");
}

export async function recordCheckpointAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(
    z.object({
      filingId,
      compared: z.literal("on", { error: "Tick the box to confirm you compared the state filing against the packet." }),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  try {
    await recordComparisonCheckpoint(staff, filing.id);
  } catch (e) {
    return actionError(e);
  }
  return done(filing.id, "Checkpoint recorded. You can certify and pay on the state site, then Mark submitted.");
}

export async function markSubmittedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(
    z.object({
      filingId,
      confirmationNumber: z
        .string({ error: "Enter the state confirmation number." })
        .trim()
        .min(1, "Enter the state confirmation number.")
        .max(100, "Confirmation numbers are at most 100 characters."),
      submittedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date it was submitted."),
      note: optionalNote,
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const { confirmationNumber, submittedDate, note } = parsed.data;
  const today = opsToday();
  if (submittedDate > today) return fail("The submitted date can't be in the future.");
  if (submittedDate < "2020-01-01") return fail(`Check the submitted date (${formatDate(submittedDate)}).`);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  if (filing.status !== "ready_to_file" && filing.status !== "in_progress") {
    return fail(`Only filings that are ready to file or in progress can be marked submitted. This one is "${statusLabel(filing.status)}".`);
  }
  // Today: record the exact time. Earlier day: record noon Eastern on that day.
  const submittedAt = submittedDate === today ? null : new Date(zonedStartOfDay(submittedDate).getTime() + 12 * 3_600_000).toISOString();
  let result;
  try {
    result = await markSubmitted(staff, filing.id, { confirmationNumber, submittedAt, note: note || undefined });
  } catch (e) {
    return actionError(e);
  }
  return done(
    filing.id,
    operatorMessage(["Marked submitted and the confirmation number is saved.", emailOutcomeText(result.email, "the confirmation number")], result.warnings),
  );
}

export async function markAcceptedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ filingId, note: optionalNote }), formData);
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  if (filing.status !== "submitted") return fail(`Only submitted filings can be marked accepted. This one is "${statusLabel(filing.status)}".`);
  let result;
  try {
    result = await markAccepted(staff, filing.id, { note: parsed.data.note || undefined });
  } catch (e) {
    return actionError(e);
  }
  return done(
    filing.id,
    result.completed
      ? operatorMessage(
          ["Marked accepted. A receipt was already on file, so the filing is now completed.", emailOutcomeText(result.email, "that the filing was accepted")],
          result.warnings,
        )
      : operatorMessage(
          [
            "Marked accepted. Next: upload the filed report or Acknowledgement Letter (visible to the customer) under Documents.",
            "The customer is emailed once it is uploaded.",
          ],
          result.warnings,
        ),
  );
}

export async function markRejectedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ filingId, reason, confirm: confirmed }), formData);
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  if (filing.status !== "submitted") return fail(`Only submitted filings can be marked rejected. This one is "${statusLabel(filing.status)}".`);
  let result;
  try {
    result = await markRejected(staff, filing.id, parsed.data.reason);
  } catch (e) {
    return actionError(e);
  }
  return done(filing.id, operatorMessage(["Marked rejected.", emailOutcomeText(result.email, "the reason")], result.warnings));
}

export async function completeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ filingId }), formData);
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  if (filing.status !== "accepted") return fail(`Only accepted filings can be completed. This one is "${statusLabel(filing.status)}".`);
  let result;
  try {
    result = await completeFiling(staff, filing.id);
  } catch (e) {
    return actionError(e);
  }
  return done(
    filing.id,
    operatorMessage(
      [result.warnings.length ? "Completed." : "Completed. Next period's requirement has been opened.", emailOutcomeText(result.email, "that the filing was accepted")],
      result.warnings,
    ),
  );
}

export async function cancelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ filingId, reason, confirm: confirmed }), formData);
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  if (!canTransition(filing.status, "cancelled")) return fail(`A filing that is "${statusLabel(filing.status)}" can't be cancelled.`);
  let result;
  try {
    result = await cancelFiling(staff, filing.id, parsed.data.reason);
  } catch (e) {
    return actionError(e);
  }
  return done(
    filing.id,
    operatorMessage(["Cancelled. Issue a refund if one is owed.", emailOutcomeText(result.email, "the cancellation and reason")], result.warnings),
  );
}

export async function reopenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(z.object({ filingId, note: optionalNote }), formData);
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  const target: FilingStatus = filing.status === "rejected" ? "ready_to_file" : "ready_for_review";
  // A draft is unpaid: it reaches review only through checkout, never by an operator.
  if (filing.status === "draft" || !canTransition(filing.status, target)) {
    return fail(`A filing that is "${statusLabel(filing.status)}" can't be reopened.`);
  }
  try {
    await reopenFiling(staff, filing.id, parsed.data.note);
  } catch (e) {
    return actionError(e);
  }
  return done(filing.id, `Moved to "${statusLabel(target)}".`);
}

// ---------------------------------------------------------------------------
// Money (admin only)
// ---------------------------------------------------------------------------

export async function refundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      filingId,
      governmentFee: z.string().trim().default("0"),
      serviceFee: z.string().trim().default("0"),
      reason,
      confirm: confirmed,
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const gov = dollarsToCents(parsed.data.governmentFee || "0");
  const svc = dollarsToCents(parsed.data.serviceFee || "0");
  if (gov === null || svc === null) return fail("Enter refund amounts in dollars, for example 7.00.");
  if (gov + svc <= 0) return fail("Enter an amount to refund.");
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  let result: { refundId: string; status: string };
  try {
    result = await refundFiling(admin, filing.id, { governmentFeeCents: gov, serviceFeeCents: svc, reason: parsed.data.reason });
  } catch (e) {
    return actionError(e);
  }
  const label = result.status === "succeeded" ? "Refund issued." : result.status === "pending" ? "Refund requested. The processor is still confirming it." : `Refund ${result.status}.`;
  return done(filing.id, label, [
    { label: "Government fee", value: `$${(gov / 100).toFixed(2)}` },
    { label: "Service fee", value: `$${(svc / 100).toFixed(2)}` },
  ]);
}

// ---------------------------------------------------------------------------
// Assignment, notes, messages, documents
// ---------------------------------------------------------------------------

export async function assignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(
    z.object({
      filingId,
      assignee: z.union([z.literal(""), z.string().regex(UUID_RE, "Choose a staff member.")]).default(""),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  try {
    await assignOperator(staff, filing.id, parsed.data.assignee || null);
  } catch (e) {
    return actionError(e);
  }
  return done(filing.id, parsed.data.assignee ? "Assigned." : "Unassigned.");
}

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(
    z.object({
      filingId,
      body: z.string({ error: "Write a note." }).trim().min(1, "Write a note.").max(5000, "Keep notes under 5,000 characters."),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  try {
    await addInternalNote(staff, filing.id, parsed.data.body);
  } catch (e) {
    return actionError(e);
  }
  return done(filing.id, "Note added. Notes are internal and never shown to the customer.");
}

export async function sendMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = parseForm(
    z.object({
      filingId,
      body: z.string({ error: "Write a message." }).trim().min(1, "Write a message.").max(5000, "Keep the message under 5,000 characters."),
      requiresAction: z.literal("on").optional(),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");

  if (parsed.data.requiresAction) {
    if (parsed.data.body.length < 3) return fail("Write a message of at least 3 characters.");
    if (!canRequestInformation(filing.status)) {
      return fail(`You can't ask the customer to act while the filing is "${statusLabel(filing.status)}". Untick "Requires customer action" to send a plain message.`);
    }
    let result;
    try {
      result = await requestCustomerInformation(staff, filing.id, parsed.data.body);
    } catch (e) {
      return actionError(e);
    }
    return done(
      filing.id,
      operatorMessage(["Message sent. The filing is waiting on the customer.", emailOutcomeText(result.email, "the message")], result.warnings),
    );
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("messages")
      .insert({ filing_id: filing.id, user_id: filing.user_id, author_id: staff.id, author_type: "staff", body: parsed.data.body })
      .select("id")
      .single();
    if (error || !data) return fail(`Could not send the message: ${error?.message ?? "unknown error"}`);
    await audit({
      actorUserId: staff.id,
      actorType: "staff",
      action: "message.sent",
      entityType: "message",
      entityId: data.id,
      filingId: filing.id,
      metadata: { requires_customer_action: false, length: parsed.data.body.length },
    });
  } catch (e) {
    return actionError(e);
  }
  return done(filing.id, "Message posted to the customer's dashboard. No email was sent and the status did not change.");
}

const DOCUMENT_KINDS = ["state_receipt", "filed_report", "acknowledgement", "registered_agent_consent", "other"] as const;

export async function uploadDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const file = formData.get("file");
  formData.delete("file");
  const parsed = parseForm(
    z.object({
      filingId,
      kind: z.enum(DOCUMENT_KINDS, { error: "Choose the document type." }),
      visibleToCustomer: z.literal("on").optional(),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  if (!(file instanceof File) || file.size === 0) return fail("Choose a file to upload.");
  if (file.size > MAX_DOCUMENT_BYTES) return fail("Files must be 4 MB or smaller.");
  const filing = await loadFiling(parsed.data.filingId);
  if (!filing) return fail("Filing not found.");
  let result;
  try {
    result = await uploadFilingDocument(staff, filing.id, {
      file,
      kind: parsed.data.kind,
      visibleToCustomer: parsed.data.visibleToCustomer === "on",
    });
  } catch (e) {
    return actionError(e);
  }
  return done(
    filing.id,
    operatorMessage(
      [
        result.completed ? "Uploaded. With the receipt on file, the filing is now completed." : "Uploaded.",
        result.documentEmail ? emailOutcomeText(result.documentEmail, "that the document is ready") : "Internal only: the customer can't see it and was not emailed.",
        emailOutcomeText(result.acceptedEmail, "that the filing was accepted"),
      ],
      result.warnings,
    ),
  );
}
