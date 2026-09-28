import { addDays, compareISODate, daysBetween } from "./dates";
import { FILED_STATUSES, type FilingStatus } from "./filing-status";
import type { ISODate } from "./types";

/**
 * Reminder engine — pure planning and eligibility. The cron job persists the plan
 * and calls `reminderDecision` at send time, so a reminder is only ever sent if it is
 * still appropriate on the day it goes out.
 */

/** Negative = days before the due date, positive = days after. */
export const DEFAULT_REMINDER_OFFSETS = [-90, -60, -30, -14, -7, -3, -1, 0, 1, 7, 30] as const;

/** Reminders older than this many days (cron outage, backlog) are skipped, not blasted. */
export const STALE_AFTER_DAYS = 2;

export interface PlannedReminder {
  offsetDays: number;
  scheduledFor: ISODate;
  status: "scheduled" | "skipped";
  skipReason?: string;
}

export function planReminders(dueDate: ISODate, offsets: readonly number[], plannedOn: ISODate): PlannedReminder[] {
  const unique = [...new Set(offsets)].sort((a, b) => a - b);
  return unique.map((offsetDays) => {
    const scheduledFor = addDays(dueDate, offsetDays);
    if (compareISODate(scheduledFor, plannedOn) < 0) {
      return { offsetDays, scheduledFor, status: "skipped", skipReason: "planned_after_send_date" };
    }
    return { offsetDays, scheduledFor, status: "scheduled" };
  });
}

export type ReminderTemplateKey =
  | "reminder_upcoming"
  | "reminder_due_today"
  | "reminder_overdue"
  | "reminder_needs_information";

export type RequirementStatus = "open" | "filed_with_us" | "filed_elsewhere" | "not_required" | "cancelled";

export interface ReminderContext {
  today: ISODate;
  scheduledFor: ISODate;
  offsetDays: number;
  requirementStatus: RequirementStatus;
  /** Status of the filing we hold for this period, if the customer ordered one. */
  filingStatus: FilingStatus | null;
  remindersEnabled: boolean;
}

export type ReminderDecision =
  | { action: "send"; templateKey: ReminderTemplateKey }
  | { action: "skip"; reason: string }
  | { action: "cancel"; reason: string };

export function reminderDecision(ctx: ReminderContext): ReminderDecision {
  if (ctx.requirementStatus !== "open") {
    return { action: "cancel", reason: `requirement_${ctx.requirementStatus}` };
  }
  if (ctx.filingStatus && FILED_STATUSES.includes(ctx.filingStatus)) {
    return { action: "cancel", reason: "already_filed" };
  }
  if (ctx.filingStatus === "cancelled" || ctx.filingStatus === "refunded") {
    return { action: "cancel", reason: "order_cancelled" };
  }
  if (!ctx.remindersEnabled) {
    return { action: "skip", reason: "opted_out" };
  }
  if (compareISODate(ctx.scheduledFor, ctx.today) > 0) {
    return { action: "skip", reason: "not_yet_due" };
  }
  if (daysBetween(ctx.scheduledFor, ctx.today) > STALE_AFTER_DAYS) {
    return { action: "skip", reason: "stale" };
  }
  if (ctx.filingStatus === "needs_information" || ctx.filingStatus === "needs_customer_action") {
    return { action: "send", templateKey: "reminder_needs_information" };
  }
  if (
    ctx.filingStatus === "ready_for_review" ||
    ctx.filingStatus === "ready_to_file" ||
    ctx.filingStatus === "in_progress" ||
    ctx.filingStatus === "rejected"
  ) {
    // We have it. The customer hears from us through status updates instead.
    return { action: "skip", reason: "in_progress_with_us" };
  }
  // No order, or an unpaid draft: a plain deadline reminder.
  if (ctx.offsetDays < 0) return { action: "send", templateKey: "reminder_upcoming" };
  if (ctx.offsetDays === 0) return { action: "send", templateKey: "reminder_due_today" };
  return { action: "send", templateKey: "reminder_overdue" };
}

/** "in 30 days", "tomorrow", "today", "7 days ago". */
export function dueDatePhrase(daysUntilDue: number): string {
  if (daysUntilDue === 0) return "today";
  if (daysUntilDue === 1) return "tomorrow";
  if (daysUntilDue > 1) return `in ${daysUntilDue} days`;
  if (daysUntilDue === -1) return "yesterday";
  return `${Math.abs(daysUntilDue)} days ago`;
}
