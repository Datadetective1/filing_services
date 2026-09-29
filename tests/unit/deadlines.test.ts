import { describe, expect, it } from "vitest";
import { findRule } from "@/lib/compliance/registry";
import type { DueRule } from "@/lib/compliance/types";
import {
  currentFilingPeriod,
  type DeadlineRule,
  dueDateForYear,
  firstReportYear,
  nextFilingPeriod,
} from "@/lib/domain/deadlines";
import type { EntityType } from "@/lib/domain/types";

function paRule(entityType: EntityType): DeadlineRule {
  const rule = findRule("PA", entityType);
  if (!rule) throw new Error(`missing PA rule for ${entityType}`);
  return { dueRule: rule.dueRule, firstDueRule: rule.firstDueRule, firstRequiredYear: rule.firstRequiredYear };
}

describe("Pennsylvania LLC deadlines (registry rule)", () => {
  const llc = paRule("llc");

  it("is due September 30 of the current year and due soon three days before", () => {
    const p = currentFilingPeriod(llc, { today: "2026-09-27" });
    expect(p).toEqual({
      periodYear: 2026,
      dueDate: "2026-09-30",
      daysRemaining: 3,
      phase: "due_soon",
      isFirstReport: false,
    });
  });

  it("stays on the unfiled current-year report and reports it overdue after the deadline", () => {
    const p = currentFilingPeriod(llc, { today: "2026-10-05" });
    expect(p.periodYear).toBe(2026);
    expect(p.dueDate).toBe("2026-09-30");
    expect(p.daysRemaining).toBe(-5);
    expect(p.phase).toBe("overdue");
  });

  it("moves to next year once this year's report is filed", () => {
    const p = currentFilingPeriod(llc, { today: "2026-09-27", lastFiledYear: 2026 });
    expect(p.periodYear).toBe(2027);
    expect(p.dueDate).toBe("2027-09-30");
    expect(p.daysRemaining).toBe(368);
    expect(p.phase).toBe("upcoming");
  });

  it("a business formed this year files its first report the following year", () => {
    const p = currentFilingPeriod(llc, { today: "2026-09-27", formationDate: "2026-03-01" });
    expect(p.periodYear).toBe(2027);
    expect(p.dueDate).toBe("2027-09-30");
    expect(p.isFirstReport).toBe(true);
    expect(p.phase).toBe("first_report_later");
  });

  it("a business formed last year is on its first report this year (not 'later')", () => {
    const p = currentFilingPeriod(llc, { today: "2026-09-27", formationDate: "2025-05-01" });
    expect(p.periodYear).toBe(2026);
    expect(p.isFirstReport).toBe(true);
    expect(p.phase).toBe("due_soon");
  });

  it("classifies due today, the 30-day boundary and upcoming", () => {
    expect(currentFilingPeriod(llc, { today: "2026-09-30" }).phase).toBe("due_today");
    expect(currentFilingPeriod(llc, { today: "2026-08-31" })).toMatchObject({ daysRemaining: 30, phase: "due_soon" });
    expect(currentFilingPeriod(llc, { today: "2026-08-30" })).toMatchObject({ daysRemaining: 31, phase: "upcoming" });
    expect(currentFilingPeriod(llc, { today: "2026-09-29" })).toMatchObject({ daysRemaining: 1, phase: "due_soon" });
  });

  it("never schedules a report before the first year the state required it", () => {
    // Formed long ago: the first report is still 2025 (firstRequiredYear), not 2011.
    expect(firstReportYear(llc, "2010-06-15")).toBe(2025);
    expect(firstReportYear(llc, null)).toBe(2025);
    expect(firstReportYear(llc, "2026-03-01")).toBe(2027);
  });

  it("rolls forward to the next period", () => {
    expect(nextFilingPeriod(llc, 2026)).toEqual({ periodYear: 2027, dueDate: "2027-09-30" });
  });
});

describe("Pennsylvania deadlines by entity type", () => {
  it("corporations and nonprofit corporations are due June 30", () => {
    for (const t of ["corporation", "nonprofit_corporation"] as const) {
      expect(dueDateForYear(paRule(t).dueRule, 2026)).toBe("2026-06-30");
    }
    const p = currentFilingPeriod(paRule("corporation"), { today: "2026-09-27" });
    expect(p).toMatchObject({ periodYear: 2026, dueDate: "2026-06-30", phase: "overdue", daysRemaining: -89 });
    expect(currentFilingPeriod(paRule("corporation"), { today: "2026-09-27", lastFiledYear: 2026 }).dueDate).toBe(
      "2027-06-30",
    );
  });

  it("all other entity types are due December 31", () => {
    for (const t of ["lp", "llp", "electing_partnership", "professional_association", "business_trust"] as const) {
      expect(dueDateForYear(paRule(t).dueRule, 2026)).toBe("2026-12-31");
    }
    expect(currentFilingPeriod(paRule("lp"), { today: "2026-09-27" })).toMatchObject({
      dueDate: "2026-12-31",
      daysRemaining: 95,
      phase: "upcoming",
    });
  });
});

describe("anniversary and biennial rules", () => {
  const monthEnd: DueRule = { kind: "anniversary_month_end" };
  const anniversary: DueRule = { kind: "anniversary_date" };
  const biennialMonthEnd: DueRule = { kind: "anniversary_month_end", intervalYears: 2 };

  it("anniversary_month_end is the last day of the formation month", () => {
    expect(dueDateForYear(monthEnd, 2026, "2019-04-10")).toBe("2026-04-30");
    expect(dueDateForYear(monthEnd, 2026, "2019-02-03")).toBe("2026-02-28");
    expect(dueDateForYear(monthEnd, 2028, "2019-02-03")).toBe("2028-02-29");
  });

  it("anniversary_date is the formation day of month", () => {
    expect(dueDateForYear(anniversary, 2026, "2019-04-10")).toBe("2026-04-10");
  });

  it("requires a formation date and nothing is due in or before the formation year", () => {
    expect(dueDateForYear(monthEnd, 2026, null)).toBeNull();
    expect(dueDateForYear(monthEnd, 2026, "not-a-date")).toBeNull();
    expect(dueDateForYear(monthEnd, 2019, "2019-04-10")).toBeNull();
    expect(dueDateForYear(monthEnd, 2018, "2019-04-10")).toBeNull();
    expect(() =>
      currentFilingPeriod({ dueRule: monthEnd, firstDueRule: { kind: "year_after_formation" } }, { today: "2026-09-27" }),
    ).toThrow(/formation date/);
  });

  it("biennial rules are due every other year after formation", () => {
    const f = "2020-07-15";
    expect(dueDateForYear(biennialMonthEnd, 2021, f)).toBeNull();
    expect(dueDateForYear(biennialMonthEnd, 2022, f)).toBe("2022-07-31");
    expect(dueDateForYear(biennialMonthEnd, 2025, f)).toBeNull();
    expect(dueDateForYear(biennialMonthEnd, 2026, f)).toBe("2026-07-31");
  });

  it("currentFilingPeriod skips off-years for biennial rules", () => {
    const rule: DeadlineRule = { dueRule: biennialMonthEnd, firstDueRule: { kind: "year_after_formation" } };
    const p = currentFilingPeriod(rule, { today: "2027-01-10", formationDate: "2020-07-15" });
    expect(p.periodYear).toBe(2028);
    expect(p.dueDate).toBe("2028-07-31");
    expect(nextFilingPeriod(rule, 2026, "2020-07-15")).toEqual({ periodYear: 2028, dueDate: "2028-07-31" });
  });

  it("handles a February 29 formation date in non-leap years", () => {
    const leap = "2024-02-29";
    expect(dueDateForYear(anniversary, 2025, leap)).toBe("2025-02-28");
    expect(dueDateForYear(anniversary, 2028, leap)).toBe("2028-02-29");
    expect(dueDateForYear(monthEnd, 2025, leap)).toBe("2025-02-28");
    expect(dueDateForYear(monthEnd, 2028, leap)).toBe("2028-02-29");
    const rule: DeadlineRule = { dueRule: anniversary, firstDueRule: { kind: "year_after_formation" } };
    expect(currentFilingPeriod(rule, { today: "2025-01-15", formationDate: leap })).toMatchObject({
      periodYear: 2025,
      dueDate: "2025-02-28",
      daysRemaining: 44,
      isFirstReport: true,
    });
  });

  it("fixed_annual clamps a February 29 due day in non-leap years", () => {
    const feb29: DueRule = { kind: "fixed_annual", month: 2, day: 29 };
    expect(dueDateForYear(feb29, 2026)).toBe("2026-02-28");
    expect(dueDateForYear(feb29, 2028)).toBe("2028-02-29");
  });
});
