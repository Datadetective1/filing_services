import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { addDays, compareISODate, formatLongDate } from "@/lib/domain/dates";
import { currentFilingPeriod, nextFilingPeriod } from "@/lib/domain/deadlines";
import { formatCents } from "@/lib/domain/money";
import type { ISODate } from "@/lib/domain/types";

/**
 * Free filing reminders for people who are NOT customers: they typed their own email
 * and confirmed it. Pure planning and copy (no I/O) so the wording and schedule are
 * unit-testable.
 *
 * What a subscriber gets, and nothing else: one confirmation email, then up to three
 * reminders per year for the one business they chose (about 60, 30 and 7 days before
 * its next Pennsylvania annual report due date). No other marketing. Every reminder
 * has a one-click unsubscribe.
 */

export const SUBSCRIBER_OFFSETS = [-60, -30, -7] as const;

export { REMINDER_CONSENT_TEXT } from "./consent";

/**
 * The next due date we remind about: the current report's due date if it is today or
 * later, otherwise the following year's. We never know whether a report was filed, so
 * a passed deadline is not chased.
 */
export function nextReminderDueDate(
  rule: Pick<ComplianceRuleDef, "dueRule" | "firstDueRule" | "firstRequiredYear">,
  formationDate: ISODate | null,
  today: ISODate,
): { periodYear: number; dueDate: ISODate } | null {
  let period;
  try {
    period = currentFilingPeriod(rule, { today, formationDate });
  } catch {
    return null;
  }
  if (compareISODate(period.dueDate, today) >= 0) return { periodYear: period.periodYear, dueDate: period.dueDate };
  return nextFilingPeriod(rule, period.periodYear, formationDate);
}

/** The reminder dates for a due date that are still today or later. */
export function plannedSubscriberReminders(dueDate: ISODate, today: ISODate) {
  return SUBSCRIBER_OFFSETS.map((offsetDays) => ({ offsetDays, scheduledFor: addDays(dueDate, offsetDays) })).filter(
    (r) => compareISODate(r.scheduledFor, today) >= 0,
  );
}

export interface SubscriberCopyVars {
  businessName: string;
  dueDate: ISODate;
  stateFeeCents: number;
  nonprofitFeeCents: number | null;
  serviceFeeCents: number | null;
}

export interface SubscriberEmail {
  subject: string;
  body: string;
  ctaLabel: string;
}

function feeLine(v: SubscriberCopyVars): string {
  const state = formatCents(v.stateFeeCents);
  const nonprofit = v.nonprofitFeeCents === 0 ? " ($0.00 for not-for-profit associations)" : "";
  const ours = v.serviceFeeCents !== null ? ` Or Filewell can prepare and file it for you: ${formatCents(v.serviceFeeCents)} service fee plus the ${state} state fee.` : "";
  return `You can file it yourself at file.dos.pa.gov for the ${state} state fee${nonprofit}.${ours}`;
}

export function confirmationEmail(v: SubscriberCopyVars): SubscriberEmail {
  return {
    subject: `Confirm your Pennsylvania annual report reminders for ${v.businessName}`,
    body: [
      `Someone (hopefully you) asked Filewell to send filing reminders for ${v.businessName}.`,
      `Confirm below and we'll email you about 60, 30 and 7 days before its next Pennsylvania annual report due date (${formatLongDate(v.dueDate)}). That's all we'll send: no other marketing, and every reminder has a one-click unsubscribe.`,
      "If you didn't ask for this, ignore this email and you won't hear from us.",
      "Filewell is a private filing service. It is not the Pennsylvania Department of State.",
    ].join("\n\n"),
    ctaLabel: "Confirm reminders",
  };
}

export function reminderEmail(v: SubscriberCopyVars, offsetDays: number): SubscriberEmail {
  const days = -offsetDays;
  return {
    subject: `${v.businessName}: Pennsylvania annual report may be due by ${formatLongDate(v.dueDate)}`,
    body: [
      `This is the reminder you asked for. ${v.businessName}'s Pennsylvania annual report may be due by ${formatLongDate(v.dueDate)}, about ${days} days from now.`,
      "If it's already filed, you can ignore this email.",
      feeLine(v),
      "Filewell is a private filing service. It is not the Pennsylvania Department of State and is not affiliated with any government agency.",
    ].join("\n\n"),
    ctaLabel: "Check this business",
  };
}
