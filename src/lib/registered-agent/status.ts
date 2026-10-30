/**
 * Manual provider fulfillment workflow. Mirrors public.provider_order_transition_allowed()
 * in supabase/migrations/20261029000015_business_services.sql; keep both in step (a
 * database test compares them).
 *
 * One provider order = one unit of work an operator places in Registered Agents Inc.'s
 * partner dashboard: a registered agent appointment, a change-of-agent filing or a
 * formation. Payment success moves an order to "payment_confirmed" and no further:
 * an appointment becomes "active" only when an operator records evidence that it is
 * established (provider confirmation, or the state record for a change of agent).
 */

export const PROVIDER_ORDER_STATUSES = [
  "new_order",
  "payment_confirmed",
  "information_needed",
  "ready_for_provider",
  "submitted_to_provider",
  "processing",
  "active",
  "completed",
  "cancellation_requested",
  "provider_termination_pending",
  "terminated",
  "refunded",
  "cancelled",
] as const;
export type ProviderOrderStatus = (typeof PROVIDER_ORDER_STATUSES)[number];

export const PROVIDER_ORDER_KINDS = ["registered_agent", "change_of_agent", "formation"] as const;
export type ProviderOrderKind = (typeof PROVIDER_ORDER_KINDS)[number];

export const PROVIDER_ORDER_STATUS_LABELS: Record<ProviderOrderStatus, string> = {
  new_order: "New order",
  payment_confirmed: "Payment confirmed",
  information_needed: "Information needed",
  ready_for_provider: "Ready for provider",
  submitted_to_provider: "Submitted to provider",
  processing: "Processing",
  active: "Active",
  completed: "Completed",
  cancellation_requested: "Cancellation requested",
  provider_termination_pending: "Provider termination pending",
  terminated: "Terminated",
  refunded: "Refunded",
  cancelled: "Cancelled (never paid)",
};

export const PROVIDER_ORDER_TRANSITIONS: Record<ProviderOrderStatus, ProviderOrderStatus[]> = {
  new_order: ["payment_confirmed", "cancelled"],
  payment_confirmed: ["information_needed", "ready_for_provider", "cancellation_requested", "refunded"],
  information_needed: ["ready_for_provider", "cancellation_requested", "refunded"],
  ready_for_provider: ["submitted_to_provider", "information_needed", "cancellation_requested", "refunded"],
  submitted_to_provider: ["processing", "active", "completed", "information_needed", "cancellation_requested"],
  processing: ["active", "completed", "information_needed", "cancellation_requested"],
  active: ["cancellation_requested"],
  completed: ["refunded"],
  cancellation_requested: ["provider_termination_pending", "active", "refunded"],
  provider_termination_pending: ["terminated"],
  terminated: ["refunded"],
  refunded: [],
  cancelled: [],
};

export function providerTransitionAllowed(from: ProviderOrderStatus, to: ProviderOrderStatus): boolean {
  return PROVIDER_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Which "done" status each kind ends in: an appointment is active, a filing is completed. */
export function doneStatusFor(kind: ProviderOrderKind): "active" | "completed" {
  return kind === "registered_agent" ? "active" : "completed";
}

export interface TransitionEvidence {
  providerReference?: string | null;
  /** Date the provider or the state confirmed the appointment / change. */
  confirmedOn?: string | null;
  /** What the operator saw (e.g. "State record shows Registered Agents Inc. as agent, checked 2026-11-04"). */
  evidence?: string | null;
}

/**
 * Extra rules on top of the transition map. Returns a reason when the move is refused.
 * The database enforces the same rules (check constraints and the transition function).
 */
export function transitionProblem(
  kind: ProviderOrderKind,
  from: ProviderOrderStatus,
  to: ProviderOrderStatus,
  ev: TransitionEvidence,
): string | null {
  if (!providerTransitionAllowed(from, to)) return `Can't move from ${PROVIDER_ORDER_STATUS_LABELS[from]} to ${PROVIDER_ORDER_STATUS_LABELS[to]}.`;
  if (to === "active" && kind !== "registered_agent") return "Only a registered agent appointment can become active. Mark filings completed.";
  if (to === "completed" && kind === "registered_agent") return "A registered agent appointment becomes active, not completed.";
  if (to === "submitted_to_provider" && !ev.providerReference?.trim()) return "Record the provider's order number first.";
  if ((to === "active" || to === "completed") && (!ev.confirmedOn || !ev.evidence?.trim())) {
    return kind === "registered_agent"
      ? "Record when and how the appointment was confirmed (provider confirmation or state record). Payment alone never activates service."
      : "Record when the state accepted the filing and what you saw.";
  }
  if (to === "terminated" && (!ev.confirmedOn || !ev.evidence?.trim())) {
    return "Record when the provider confirmed the termination (and the state filing, where one was made).";
  }
  return null;
}

/** The next thing an operator must do, shown in the queue. */
export function nextOperatorAction(kind: ProviderOrderKind, status: ProviderOrderStatus): string | null {
  switch (status) {
    case "new_order":
      return null; // Waiting for payment; nothing to do.
    case "payment_confirmed":
      return "Check the customer's details. Request anything missing, or mark ready for provider.";
    case "information_needed":
      return "Waiting on the customer. Follow up if no reply in 2 business days.";
    case "ready_for_provider":
      return kind === "registered_agent"
        ? "Place the registered agent order in the Registered Agents Inc. partner dashboard and record its order number."
        : kind === "change_of_agent"
          ? "Order the change of agent filing in the partner dashboard and record its order number."
          : "Order the formation in the partner dashboard and record its order number.";
    case "submitted_to_provider":
    case "processing":
      return kind === "registered_agent"
        ? "Confirm the appointment with the provider (and the state record where a change was filed), then mark active with evidence."
        : "Check for the state's acceptance, then mark completed with the confirmation.";
    case "cancellation_requested":
      return "Confirm the customer's replacement agent (where they have one), then ask the provider to end service.";
    case "provider_termination_pending":
      return "Wait for the provider to confirm the termination and any state resignation filing, then record it.";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Billing vs. legal appointment: two separate states
// ---------------------------------------------------------------------------

/** Stripe subscription status, mirrored. Unknown values are stored as "incomplete". */
export const BILLING_STATUSES = ["pending", "incomplete", "active", "past_due", "unpaid", "canceled"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export function billingStatusFromStripe(s: string): BillingStatus {
  if (s === "trialing") return "active";
  if (s === "incomplete_expired") return "canceled";
  return (BILLING_STATUSES as readonly string[]).includes(s) ? (s as BillingStatus) : "incomplete";
}

export const SERVICE_STATUSES = ["pending_appointment", "active", "cancellation_requested", "termination_pending", "ended"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export type BillingAction =
  | { kind: "none" }
  | { kind: "notify_payment_failed"; operatorReview: boolean }
  | { kind: "billing_ended_operator_review" };

/**
 * What to do when billing changes. A failed payment NEVER ends the appointment: the
 * customer is told, Stripe retries, and after repeated failures an operator reviews.
 * Even a fully cancelled subscription only queues operator review; nothing tells the
 * provider or the state until a person has confirmed the customer's next agent.
 */
export function billingAction(input: { previous: BillingStatus; next: BillingStatus; failedAttempts: number }): BillingAction {
  if (input.next === "past_due" || input.next === "unpaid") {
    return { kind: "notify_payment_failed", operatorReview: input.next === "unpaid" || input.failedAttempts >= 3 };
  }
  if (input.next === "canceled" && input.previous !== "canceled") return { kind: "billing_ended_operator_review" };
  return { kind: "none" };
}

/** Days before the renewal date that a reminder goes out. */
export const RENEWAL_REMINDER_DAYS = [30, 7] as const;

/**
 * Renewal reminder due today, if any. `sent` holds keys already sent for this period
 * ("<periodEnd>:<days>"), so each reminder goes once.
 */
export function renewalReminderDue(input: {
  periodEnd: string;
  today: string;
  cancelAtPeriodEnd: boolean;
  billingStatus: BillingStatus;
  sent: string[];
}): { days: number; key: string } | null {
  if (input.cancelAtPeriodEnd || input.billingStatus !== "active") return null;
  const end = Date.parse(`${input.periodEnd.slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${input.today}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(now)) return null;
  const daysLeft = Math.round((end - now) / 86_400_000);
  for (const d of RENEWAL_REMINDER_DAYS) {
    const key = `${input.periodEnd.slice(0, 10)}:${d}`;
    if (daysLeft <= d && daysLeft >= 0 && !input.sent.includes(key)) {
      // Send only the closest reminder that is due (a late start doesn't send both).
      const closer = RENEWAL_REMINDER_DAYS.filter((x) => x < d && daysLeft <= x);
      if (closer.length) continue;
      return { days: d, key };
    }
  }
  return null;
}

/**
 * The provider renews every entity on its own yearly date and must be told at least 30
 * days before that date to cancel (wholesale agreement, not yet signed). An entity whose
 * customer has stopped paying is flagged for cancellation with the provider from this many
 * days before the provider's renewal, leaving a few days for an operator to act.
 */
export const PROVIDER_CANCEL_NOTICE_DAYS = 30;
export const PROVIDER_CANCEL_FLAG_DAYS = 40;

/**
 * Whether an operator must cancel this entity with the provider now, so Filewell is not
 * invoiced for a year the customer won't pay for. Only when billing has failed or ended;
 * never for a customer who is paid up, and never automatically.
 */
export function providerCancellationDue(input: {
  billingStatus: BillingStatus;
  providerRenewalDate: string | null;
  providerCancelledAt: string | null;
  today: string;
}): { due: boolean; daysLeft: number | null; late: boolean } {
  if (input.providerCancelledAt || !input.providerRenewalDate) return { due: false, daysLeft: null, late: false };
  if (!(input.billingStatus === "unpaid" || input.billingStatus === "canceled" || input.billingStatus === "past_due")) {
    return { due: false, daysLeft: null, late: false };
  }
  const days = Math.round(
    (Date.parse(`${input.providerRenewalDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${input.today}T00:00:00Z`)) / 86_400_000,
  );
  if (Number.isNaN(days)) return { due: false, daysLeft: null, late: false };
  return { due: days <= PROVIDER_CANCEL_FLAG_DAYS, daysLeft: days, late: days < PROVIDER_CANCEL_NOTICE_DAYS };
}
