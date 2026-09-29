import { isProductionSupabaseUrl, PRODUCTION_SUPABASE_REF, STAGING_SUPABASE_REF, supabaseRefOf } from "@/config/environments";
import { resolveServicePrice, type ServicePrice } from "@/lib/domain/pricing";
import type { EntityType } from "@/lib/domain/types";
import type { NotifyOutcome } from "@/lib/filings/operations";

/**
 * Plain-language operator guidance, derived from data the console already loads.
 * Pure (no I/O): the Today page, the order page and the action messages use it,
 * and unit tests pin the wording.
 */

// ---------------------------------------------------------------------------
// Next step per paid filing
// ---------------------------------------------------------------------------

export type NextStepKind = "action" | "waiting";

export interface NextStep {
  /** One sentence telling the operator what to do. */
  instruction: string;
  /** "waiting": nothing to do until the customer acts. */
  kind: NextStepKind;
  /** Why this step was chosen (for the row icon). */
  reason: "status" | "customer_replied" | "refund_owed";
}

const WAITING_ON_CUSTOMER = "Waiting on the customer (no action unless they reply)";

const STEP_BY_STATUS: Record<string, string> = {
  ready_for_review: "Review the details, then click Mark ready to file",
  ready_to_file: "Click Start filing, then file on file.dos.pa.gov using the filing packet",
  in_progress: "Finish filing on file.dos.pa.gov, enter the confirmation number, then click Mark submitted",
  submitted: "Upload the state's approved report or receipt, then click Mark accepted",
  accepted: "Upload the filed report or Acknowledgement Letter (visible to the customer). The filing completes when it is uploaded",
  rejected: "Read the rejection reason, then fix it and click Retry filing, or contact the customer",
};

/** Order statuses where money was taken and has not been fully refunded. */
export const MONEY_HELD_ORDER_STATUSES = ["paid", "partially_refunded"] as const;

/**
 * The one thing the operator should do next for a paid filing, or null when
 * nothing is needed (finished, refunded, unpaid).
 *
 * A cancelled filing asks for a refund only while nothing has been refunded yet
 * (order still "paid"). A partial refund is the normal end for a filing cancelled
 * after submission (the state keeps its fee), so it is not an open task.
 */
export function operatorNextStep(input: {
  status: string;
  orderStatus: string | null | undefined;
  customerReplied?: boolean;
}): NextStep | null {
  const { status, orderStatus } = input;
  if (status === "draft" || status === "completed" || status === "refunded") return null;
  if (status === "cancelled" && orderStatus !== "paid") return null;
  if (input.customerReplied) return { instruction: "Read and reply to the customer's message", kind: "action", reason: "customer_replied" };
  if (status === "cancelled") return { instruction: "Issue the refund (admin: Refund, under Other actions)", kind: "action", reason: "refund_owed" };
  if (status === "needs_information" || status === "needs_customer_action") {
    return { instruction: WAITING_ON_CUSTOMER, kind: "waiting", reason: "status" };
  }
  const instruction = STEP_BY_STATUS[status];
  return instruction ? { instruction, kind: "action", reason: "status" } : null;
}

/**
 * True when the customer's newest message has not been handled yet: it is newer than
 * the newest staff message and newer than `staffActivityAt` (the latest status change
 * made by staff, which counts as handling the reply, e.g. Mark ready to file after the
 * customer answered a request). System messages are ignored.
 */
export function customerWroteLast(
  messages: { author_type: string; created_at: string }[],
  staffActivityAt?: string | null,
): boolean {
  let lastCustomer = -Infinity;
  let lastStaff = -Infinity;
  for (const m of messages) {
    const at = new Date(m.created_at).getTime();
    if (Number.isNaN(at)) continue;
    if (m.author_type === "customer") lastCustomer = Math.max(lastCustomer, at);
    if (m.author_type === "staff") lastStaff = Math.max(lastStaff, at);
  }
  if (staffActivityAt) {
    const at = new Date(staffActivityAt).getTime();
    if (!Number.isNaN(at)) lastStaff = Math.max(lastStaff, at);
  }
  return lastCustomer > lastStaff;
}

// ---------------------------------------------------------------------------
// Test (sandbox) money
// ---------------------------------------------------------------------------

export const TEST_ORDER_LABEL = "TEST: no money collected";

/** A paid order whose payment was not live: sandbox or processor test mode. No money moved. */
export function isTestPayment(mode: string | null | undefined): boolean {
  return typeof mode === "string" && mode !== "live";
}

// ---------------------------------------------------------------------------
// Email result, in operator words
// ---------------------------------------------------------------------------

/**
 * One sentence about a customer email. `what` finishes "The customer was emailed ...",
 * e.g. "the confirmation number". Empty when the step sent no email.
 */
export function emailOutcomeText(outcome: NotifyOutcome | null | undefined, what: string): string {
  if (!outcome) return "";
  switch (outcome.status) {
    case "delivered":
      return `The customer was emailed ${what}.`;
    case "outbox":
      return `The email to the customer (${what}) was recorded but NOT delivered, because email is in outbox mode. Contact the customer directly.`;
    case "failed":
      return `The email to the customer (${what}) FAILED. Contact the customer directly and check Emails.`;
    case "suppressed":
      return `The email to the customer (${what}) was not sent because they have no deliverable email address. Contact them another way.`;
    case "duplicate":
      return `An email for this (${what}) was already recorded earlier, so it was not sent again. Check Emails to see whether it was delivered.`;
  }
}

/** Join an operator message from parts, skipping empty ones. Warnings are prefixed so they stand out. */
export function operatorMessage(parts: (string | null | undefined)[], warnings: string[] = []): string {
  return [...parts.filter((p): p is string => Boolean(p && p.trim())), ...warnings.map((w) => `Warning: ${w}`)].join(" ");
}

// ---------------------------------------------------------------------------
// Which database this deployment uses
// ---------------------------------------------------------------------------

/** Production, staging or something else, from the public Supabase URL (refs are not secrets). */
export function supabaseEnvironment(url: string | null | undefined): { label: "Production" | "Staging" | "Local" | "Other" | "Not set"; ref: string | null } {
  if (!url) return { label: "Not set", ref: null };
  const ref = supabaseRefOf(url);
  if (isProductionSupabaseUrl(url)) return { label: "Production", ref: ref ?? PRODUCTION_SUPABASE_REF };
  if (ref === STAGING_SUPABASE_REF) return { label: "Staging", ref };
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)) return { label: "Local", ref: null };
  return { label: "Other", ref };
}

// ---------------------------------------------------------------------------
// Service price approval (live checkout refuses unapproved prices)
// ---------------------------------------------------------------------------

/** How many of a state's sold entity types resolve to an approved, active service price. */
export function servicePriceApproval(
  prices: ServicePrice[],
  stateCode: string,
  entityTypes: readonly EntityType[],
  filingTypeCode = "annual_report",
): { approved: number; unapproved: number; missing: number } {
  const result = { approved: 0, unapproved: 0, missing: 0 };
  for (const entityType of new Set(entityTypes)) {
    const price = resolveServicePrice(prices, { filingTypeCode, stateCode, entityType });
    if (!price) result.missing += 1;
    else if (price.approved) result.approved += 1;
    else result.unapproved += 1;
  }
  return result;
}
