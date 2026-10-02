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
  /** Defaults keep the original Pennsylvania wording. */
  stateName?: string;
  filingName?: string;
  agencyName?: string;
  directFilingHost?: string;
  stateFeeCents: number;
  nonprofitFeeCents: number | null;
  /** Itemized state fees (e.g. Nevada's list + license fees); omit for a single fee. */
  feeComponents?: { label: string; cents: number }[];
  /** Null when Filewell isn't selling this filing (nothing about our service is said). */
  serviceFeeCents: number | null;
}

export interface SubscriberEmail {
  subject: string;
  body: string;
  ctaLabel: string;
}

const d = (v: SubscriberCopyVars) => ({
  state: v.stateName ?? "Pennsylvania",
  filing: (v.filingName ?? "Annual Report").toLowerCase(),
  agency: v.agencyName ?? "Pennsylvania Department of State",
  host: v.directFilingHost ?? "file.dos.pa.gov",
});

function feeLine(v: SubscriberCopyVars): string {
  const { host } = d(v);
  const multi = (v.feeComponents?.length ?? 0) > 1;
  const total = multi ? v.feeComponents!.reduce((n, c) => n + c.cents, 0) : v.stateFeeCents;
  const nonprofit = !multi && v.nonprofitFeeCents === 0 ? " ($0.00 for not-for-profit associations)" : "";
  const gov = multi
    ? `${formatCents(total)} in state fees (${v.feeComponents!.map((c) => `${formatCents(c.cents)} ${c.label}`).join(" + ")})`
    : `${formatCents(total)} state fee${nonprofit}`;
  const govShort = multi ? `${formatCents(total)} in state fees` : `${formatCents(total)} state fee`;
  const ours = v.serviceFeeCents !== null ? ` Or Filewell can prepare and file it for you: ${formatCents(v.serviceFeeCents)} service fee plus the ${govShort}.` : "";
  return `You can file it yourself at ${host} for the ${gov}.${ours}`;
}

export function confirmationEmail(v: SubscriberCopyVars): SubscriberEmail {
  const { state, filing, agency } = d(v);
  return {
    subject: `Confirm your ${state} ${filing} reminders for ${v.businessName}`,
    body: [
      `Someone (hopefully you) asked Filewell to send filing reminders for ${v.businessName}.`,
      `Confirm below and we'll email you about 60, 30 and 7 days before its next ${state} ${filing} due date (${formatLongDate(v.dueDate)}). That's all we'll send: no other marketing, and every reminder has a one-click unsubscribe.`,
      "If you didn't ask for this, ignore this email and you won't hear from us.",
      `Filewell is a private filing service. It is not the ${agency}.`,
    ].join("\n\n"),
    ctaLabel: "Confirm reminders",
  };
}

export function reminderEmail(v: SubscriberCopyVars, offsetDays: number): SubscriberEmail {
  const days = -offsetDays;
  const { state, filing, agency } = d(v);
  return {
    subject: `${v.businessName}: ${state} ${filing} may be due by ${formatLongDate(v.dueDate)}`,
    body: [
      `This is the reminder you asked for. ${v.businessName}'s ${state} ${filing} may be due by ${formatLongDate(v.dueDate)}, about ${days} days from now.`,
      "If it's already filed, you can ignore this email.",
      feeLine(v),
      `Filewell is a private filing service. It is not the ${agency} and is not affiliated with any government agency.`,
    ].join("\n\n"),
    ctaLabel: "Check this business",
  };
}
