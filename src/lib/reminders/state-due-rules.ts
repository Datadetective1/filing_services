import type { DueRule, FirstDueRule } from "@/lib/compliance/types";

/**
 * When the report is due in states whose annual report rule isn't verified in the compliance
 * registry, so free reminders can work there too. Each line restates the "due" fact already
 * in PROVIDER_REPORT_FACTS (researched November 3, 2026 from each state's own filing office
 * site) in a form we can compute. Only states whose due date is one clear rule are here;
 * anything vague, tax-based, quarter-based or set on an exact formation day is left out, and
 * those states get no reminder box. An entity type gets reminders only where those facts say
 * the state requires the report for it.
 *
 * Reminders say a report "may be due" and never claim anyone's filing status.
 */
export interface StateDueRule {
  dueRule: DueRule;
  firstDueRule: FirstDueRule;
  /** The fact this rule restates, as written in the research notes. */
  basis: string;
}

const fixed = (month: number, day: number, basis: string): StateDueRule => ({
  dueRule: { kind: "fixed_annual", month, day },
  firstDueRule: { kind: "year_after_formation" },
  basis,
});

const monthEnd = (basis: string, intervalYears?: 2): StateDueRule => ({
  dueRule: intervalYears ? { kind: "anniversary_month_end", intervalYears } : { kind: "anniversary_month_end" },
  firstDueRule: { kind: "year_after_formation" },
  basis,
});

export const STATE_DUE_RULES: Record<string, StateDueRule> = {
  CT: fixed(3, 31, "Filed online between January 1 and March 31 each year"),
  GA: fixed(4, 1, "Between January 1 and April 1 each year"),
  ID: monthEnd("By the end of the month in which the entity was formed (anniversary month)"),
  IN: monthEnd("Every other year, by the end of the anniversary month of formation", 2),
  KY: fixed(6, 30, "Between January 1 and June 30 each year"),
  MD: fixed(4, 15, "April 15 each year"),
  ME: fixed(6, 1, "June 1 each year"),
  MN: fixed(12, 31, "By December 31 each calendar year (starting the year after formation)"),
  MO: monthEnd("By the end of the anniversary month of incorporation"),
  MS: fixed(4, 15, "By April 15 each year"),
  NC: fixed(4, 15, "April 15 each year after the year of creation"),
  ND: fixed(11, 15, "November 15"),
  NH: fixed(4, 1, "On or before April 1 each year (after the year of formation)"),
  NJ: monthEnd("By the last day of the anniversary month of formation"),
  NY: monthEnd("Every two years, during the calendar month of the original filing", 2),
  RI: fixed(5, 1, "Filing window February 1 to May 1"),
  VA: monthEnd("Last day of the month the LLC was organized, each year"),
  WV: fixed(6, 30, "Between January 1 and June 30 each year after the registration year"),
  WY: {
    dueRule: { kind: "anniversary_month_start" },
    firstDueRule: { kind: "year_after_formation" },
    basis: "First day of the anniversary month of formation",
  },
};
