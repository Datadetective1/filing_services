import { isStateVerified, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import type { DueRule } from "@/lib/compliance/types";
import { formatMonthDay } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import { providerReportFacts, providerReportFeeCents } from "@/lib/registered-agent/provider-report";
import { STATE_DUE_RULES } from "@/lib/reminders/state-due-rules";
import { dueGroups, feeSummary, plainDashes } from "./content";

/**
 * One page with every state's annual report due date we can state as a rule, the state's fee and,
 * where we file it, our full price. Two kinds of source, said plainly on the page:
 *
 *  - "verified": the compliance registry's verified rules (the same facts the state guides show).
 *  - "researched": the due rule the free reminders already use (lib/reminders/state-due-rules.ts,
 *    restating PROVIDER_REPORT_FACTS, researched November 3, 2026 on each state's own filing
 *    office site) and the report fee only when it is one verified fixed amount.
 *
 * States with neither are left out. It only reshapes facts that exist; it never adds one.
 */

export const RESEARCHED_ON = "2026-11-03";

export type DueSource = "verified" | "researched";

export interface DueDateRow {
  code: string;
  name: string;
  slug: string;
  /** "Annual report", "Biennial report", ... */
  reportName: string;
  /** "LLCs: September 30. Business corporations: June 30." or "Last day of your anniversary month". */
  when: string;
  /** Months (1 to 12) with a fixed due date, for the year strip. Empty for anniversary-based states. */
  months: number[];
  /** True when the date depends on when the business was formed. */
  anniversary: boolean;
  /** "$7" / "LLC $50, corporation $25" / "Not verified". */
  stateFee: string;
  source: DueSource;
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Plain words for a researched due rule. */
export function researchedWhen(rule: DueRule): string {
  switch (rule.kind) {
    case "fixed_annual":
      return formatMonthDay(rule.month, rule.day);
    case "anniversary_month_end":
      return rule.intervalYears === 2
        ? "Every two years, by the last day of your formation anniversary month"
        : "Last day of your formation anniversary month";
    case "anniversary_month_start":
      return "1st of your formation anniversary month";
    case "anniversary_date":
      return rule.intervalYears === 2 ? "Every two years, on your formation anniversary" : "Your formation anniversary";
  }
}

function researchedFee(code: string): string {
  const llc = providerReportFeeCents(code, "llc");
  const corp = providerReportFeeCents(code, "corporation");
  const m = (c: number) => (c === 0 ? "no fee" : formatCents(c, { trimZeros: true }));
  if (llc !== null && corp !== null) return llc === corp ? cap(m(llc)) : `LLC ${m(llc)}, corporation ${m(corp)}`;
  if (llc !== null) return `LLC ${m(llc)}, corporation not verified`;
  if (corp !== null) return `Corporation ${m(corp)}, LLC not verified`;
  return "Not verified";
}

export function dueDateRows(): DueDateRow[] {
  const rows: DueDateRow[] = [];
  for (const j of listJurisdictions()) {
    if (isStateVerified(j.code)) {
      const rules = rulesForState(j.code).filter((r) => r.verificationStatus === "verified");
      if (rules.length === 0) continue;
      const groups = dueGroups(rules);
      const when =
        groups.length === 1
          ? cap(plainDashes(groups[0].day))
          : groups.map((g) => `${g.who}: ${plainDashes(g.day)}`).join(". ");
      rows.push({
        code: j.code,
        name: j.name,
        slug: j.slug,
        reportName: cap(rules[0].filingName.toLowerCase()),
        when,
        months: groups.flatMap((g) => (g.month ? [g.month] : [])),
        anniversary: groups.some((g) => g.month === null),
        stateFee: cap(plainDashes(feeSummary(rules))),
        source: "verified",
      });
      continue;
    }
    const due = STATE_DUE_RULES[j.code];
    const facts = providerReportFacts(j.code);
    if (!due || !facts) continue;
    rows.push({
      code: j.code,
      name: j.name,
      slug: j.slug,
      reportName: facts.reportName,
      when: researchedWhen(due.dueRule),
      months: due.dueRule.kind === "fixed_annual" ? [due.dueRule.month] : [],
      anniversary: due.dueRule.kind !== "fixed_annual",
      stateFee: researchedFee(j.code),
      source: "researched",
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** The state codes with a fixed due date in each month, January first. */
export function monthBuckets(rows: DueDateRow[]): { month: number; codes: string[] }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    codes: rows.filter((r) => r.months.includes(i + 1)).map((r) => r.code),
  }));
}

