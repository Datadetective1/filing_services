import { addDays, daysBetween } from "@/lib/domain/dates";
import type { FilingStatus, StatusTone } from "@/lib/domain/filing-status";

/**
 * Operator urgency, computed from the filing's due date (a calendar date) and the
 * operator's "today" (America/New_York).
 *   Overdue: past the due date
 *   Critical: due within 3 days
 *   Soon: due within 14 days
 *   Normal: later than that
 */
export const URGENCY_LEVELS = ["overdue", "critical", "soon", "normal"] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const URGENCY_LABELS: Record<Urgency, string> = {
  overdue: "Overdue",
  critical: "Critical",
  soon: "Soon",
  normal: "Normal",
};

export const URGENCY_DESCRIPTIONS: Record<Urgency, string> = {
  overdue: "Past the due date",
  critical: "Due within 3 days",
  soon: "Due within 14 days",
  normal: "Due in more than 14 days",
};

export const URGENCY_TONES: Record<Urgency, StatusTone> = {
  overdue: "danger",
  critical: "danger",
  soon: "warning",
  normal: "neutral",
};

export const CRITICAL_DAYS = 3;
export const SOON_DAYS = 14;

export function isUrgency(value: unknown): value is Urgency {
  return typeof value === "string" && (URGENCY_LEVELS as readonly string[]).includes(value);
}

export function urgencyFor(dueDate: string, today: string): Urgency {
  const days = daysBetween(today, dueDate);
  if (days < 0) return "overdue";
  if (days <= CRITICAL_DAYS) return "critical";
  if (days <= SOON_DAYS) return "soon";
  return "normal";
}

/** Due-date bounds that select one urgency level (for database filters). */
export function urgencyDateRange(level: Urgency, today: string): { gte?: string; lte?: string } {
  switch (level) {
    case "overdue":
      return { lte: addDays(today, -1) };
    case "critical":
      return { gte: today, lte: addDays(today, CRITICAL_DAYS) };
    case "soon":
      return { gte: addDays(today, CRITICAL_DAYS + 1), lte: addDays(today, SOON_DAYS) };
    case "normal":
      return { gte: addDays(today, SOON_DAYS + 1) };
  }
}

/**
 * Statuses where the deadline still matters to us: the filing is paid for and the
 * state does not have it yet (a rejected filing must be resubmitted).
 */
export const DEADLINE_SENSITIVE_STATUSES: readonly FilingStatus[] = [
  "needs_information",
  "ready_for_review",
  "ready_to_file",
  "in_progress",
  "rejected",
  "needs_customer_action",
];

/** Filing statuses where the state already has the filing. */
export const WITH_STATE_STATUSES: readonly FilingStatus[] = ["submitted", "accepted", "completed"];
