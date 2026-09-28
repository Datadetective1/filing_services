import type { DueRule, FirstDueRule } from "@/lib/compliance/types";
import { daysBetween, isISODate, lastDayOfMonth, parseISODate, toISODate } from "./dates";
import type { ISODate } from "./types";

/**
 * Deadline engine. Pure functions over calendar dates — no clocks, no I/O — so
 * every rule is unit-testable with fixed "today" values.
 */

export interface DeadlineRule {
  dueRule: DueRule;
  firstDueRule: FirstDueRule;
  firstRequiredYear?: number;
}

/** The due date for a given report year, or null if no report is due that year. */
export function dueDateForYear(rule: DueRule, year: number, formationDate?: ISODate | null): ISODate | null {
  switch (rule.kind) {
    case "fixed_annual": {
      const day = Math.min(rule.day, lastDayOfMonth(year, rule.month));
      return toISODate(year, rule.month, day);
    }
    case "anniversary_month_end":
    case "anniversary_date": {
      if (!formationDate || !isISODate(formationDate)) return null;
      const f = parseISODate(formationDate);
      const interval = rule.intervalYears ?? 1;
      if (year <= f.year) return null;
      if ((year - f.year) % interval !== 0) return null;
      if (rule.kind === "anniversary_month_end") {
        return toISODate(year, f.month, lastDayOfMonth(year, f.month));
      }
      return toISODate(year, f.month, Math.min(f.day, lastDayOfMonth(year, f.month)));
    }
  }
}

/** First report year for an entity, or null when unknown (no formation date). */
export function firstReportYear(rule: DeadlineRule, formationDate?: ISODate | null): number | null {
  const floor = rule.firstRequiredYear ?? null;
  if (!formationDate || !isISODate(formationDate)) return floor;
  const formedYear = parseISODate(formationDate).year;
  const first = rule.firstDueRule.kind === "year_after_formation" ? formedYear + 1 : formedYear;
  return floor ? Math.max(first, floor) : first;
}

export type DeadlinePhase =
  | "first_report_later" // entity too new: its first report is in a future year
  | "upcoming" // more than 30 days away
  | "due_soon" // 1–30 days away
  | "due_today"
  | "overdue";

export interface FilingPeriod {
  periodYear: number;
  dueDate: ISODate;
  daysRemaining: number;
  phase: DeadlinePhase;
  isFirstReport: boolean;
}

export interface PeriodInput {
  today: ISODate;
  formationDate?: ISODate | null;
  /** The last report year already filed (by us or elsewhere), if known. */
  lastFiledYear?: number | null;
}

/**
 * The report the business should be working on now: the earliest unfiled report
 * year that is due this year or later, starting from the entity's first report year.
 * An unfiled report for the current year stays current (and "overdue") after its
 * due date passes — it can still be filed.
 */
export function currentFilingPeriod(rule: DeadlineRule, input: PeriodInput): FilingPeriod {
  const todayYear = parseISODate(input.today).year;
  const first = firstReportYear(rule, input.formationDate);
  let year = Math.max(todayYear, first ?? todayYear, (input.lastFiledYear ?? -Infinity) + 1);

  // Skip years with no report due (biennial rules), bounded to avoid infinite loops.
  let due: ISODate | null = null;
  for (let i = 0; i < 4; i++) {
    due = dueDateForYear(rule.dueRule, year, input.formationDate);
    if (due) break;
    year += 1;
  }
  if (!due) {
    throw new Error("Unable to compute a due date: rule requires a formation date");
  }

  const daysRemaining = daysBetween(input.today, due);
  const isFirstReport = first !== null && year === first;
  let phase: DeadlinePhase;
  if (year > todayYear && isFirstReport && (first ?? 0) > todayYear) phase = "first_report_later";
  else if (daysRemaining < 0) phase = "overdue";
  else if (daysRemaining === 0) phase = "due_today";
  else if (daysRemaining <= 30) phase = "due_soon";
  else phase = "upcoming";

  return { periodYear: year, dueDate: due, daysRemaining, phase, isFirstReport };
}

/** The period after `periodYear` — used to roll a requirement forward once filed. */
export function nextFilingPeriod(rule: DeadlineRule, periodYear: number, formationDate?: ISODate | null) {
  for (let year = periodYear + 1; year < periodYear + 5; year++) {
    const due = dueDateForYear(rule.dueRule, year, formationDate);
    if (due) return { periodYear: year, dueDate: due };
  }
  return null;
}
