import { describe, expect, it } from "vitest";
import { findRule } from "@/lib/compliance/registry";
import { filingWindowOpensOn, isFilingWindowOpen } from "@/lib/domain/deadlines";

const llc = findRule("PA", "llc")!;

describe("filing window", () => {
  it("PA reports open January 1 of the report year", () => {
    expect(isFilingWindowOpen(llc, 2026, "2026-09-30", "2026-09-28")).toBe(true);
    expect(isFilingWindowOpen(llc, 2026, "2026-09-30", "2026-01-01")).toBe(true);
    expect(isFilingWindowOpen(llc, 2027, "2027-09-30", "2026-12-31")).toBe(false);
    expect(isFilingWindowOpen(llc, 2027, "2027-09-30", "2027-01-01")).toBe(true);
    expect(filingWindowOpensOn(llc, 2027, "2027-09-30")).toBe("2027-01-01");
  });

  it("an overdue report stays fileable", () => {
    expect(isFilingWindowOpen(llc, 2026, "2026-09-30", "2026-11-15")).toBe(true);
  });

  it("anniversary rules open 90 days before the due date", () => {
    const rule = { dueRule: { kind: "anniversary_month_end" as const } };
    expect(isFilingWindowOpen(rule, 2027, "2027-06-30", "2027-04-01")).toBe(true);
    expect(isFilingWindowOpen(rule, 2027, "2027-06-30", "2027-03-01")).toBe(false);
    expect(filingWindowOpensOn(rule, 2027, "2027-06-30")).toBe("2027-04-01");
  });
});
