import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { formatLongDate, formatMonthDay, parseISODate } from "./dates";
import type { ISODate } from "./types";

/**
 * Customer-facing deadline wording, kept in one place so every surface says the
 * same thing before, on and after a due date. Calm and factual: never a negative
 * count, never "late", "overdue" or "past due", and never a late-fee statement the
 * verified rule doesn't support.
 */

/** The rule facts the wording is allowed to rely on. */
export type LateFeeFacts = Pick<ComplianceRuleDef, "verificationStatus" | "lateFeeCents" | "sources">;

function monthDay(dueDate: ISODate): string {
  const { month, day } = parseISODate(dueDate);
  return formatMonthDay(month, day);
}

/** "12 days left", "Due tomorrow", "Due today", then "Deadline passed September 30". */
export function deadlineLabel(daysRemaining: number, dueDate: ISODate): string {
  if (daysRemaining > 1) return `${daysRemaining} days left`;
  if (daysRemaining === 1) return "Due tomorrow";
  if (daysRemaining === 0) return "Due today";
  return `Deadline passed ${monthDay(dueDate)}`;
}

/**
 * True only when verified rule data shows the state charges no late fee: an explicit
 * $0 late fee, or no published fee backed by a cited "no late fee" source. Anything
 * less (unverified rule, unknown fee) is not proof, so callers say nothing.
 */
export function hasVerifiedNoLateFee(rule: LateFeeFacts | null | undefined): boolean {
  if (!rule || rule.verificationStatus !== "verified") return false;
  if (rule.lateFeeCents === 0) return true;
  return rule.lateFeeCents === null && rule.sources.some((s) => s.factKey === "no_late_fee");
}

export interface DeadlineCopy {
  /** Short status, see `deadlineLabel`. */
  label: string;
  /** The due date is behind us (the report may still be fileable). */
  passed: boolean;
  /** Companion sentence after the deadline, only when verified data proves there is no state late fee. */
  note: string | null;
}

export function deadlineCopy(
  daysRemaining: number,
  dueDate: ISODate,
  facts?: { rule: LateFeeFacts | null | undefined; stateName: string },
): DeadlineCopy {
  const passed = daysRemaining < 0;
  const note =
    passed && facts && hasVerifiedNoLateFee(facts.rule)
      ? `${facts.stateName} charges no state late fee, and the report can still be filed.`
      : null;
  return { label: deadlineLabel(daysRemaining, dueDate), passed, note };
}

/** Accessible label for a countdown ring, e.g. "1 day until the September 30, 2026 deadline". */
export function deadlineAriaLabel(daysRemaining: number, dueDate: ISODate): string {
  const date = formatLongDate(dueDate);
  if (daysRemaining > 1) return `${daysRemaining} days until the ${date} deadline`;
  if (daysRemaining === 1) return `1 day until the ${date} deadline`;
  if (daysRemaining === 0) return `Due today, ${date}`;
  return `The ${date} deadline has passed`;
}
