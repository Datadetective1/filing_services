import { isStateVerified, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { dueGroups, feeSummary, plainDashes } from "./content";

/**
 * One page with every state's annual report due date from the compliance registry's verified
 * rules (the same facts the state guides show), the state's fee and, where we file it, our full
 * price. Only verified states are listed; researched-but-unverified states are left out until
 * they pass the full check. It only reshapes facts that exist; it never adds one.
 */

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
  /** "$7" / "LLC $50, corporation $25". */
  stateFee: string;
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
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
      });
    }
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

