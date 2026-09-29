import { describe, expect, it } from "vitest";
import { findRule } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { deadlineAriaLabel, deadlineCopy, deadlineLabel, hasVerifiedNoLateFee } from "@/lib/domain/deadline-copy";
import { currentFilingPeriod } from "@/lib/domain/deadlines";
import type { EntityType } from "@/lib/domain/types";

function paRule(entityType: EntityType): ComplianceRuleDef {
  const rule = findRule("PA", entityType);
  if (!rule) throw new Error(`missing PA rule for ${entityType}`);
  return rule;
}

const llc = paRule("llc");
const lp = paRule("lp");
const PA = { rule: llc, stateName: "Pennsylvania" };
const NO_LATE_FEE_NOTE = "Pennsylvania charges no state late fee, and the report can still be filed.";

/** Wording that must never appear in a customer-facing deadline label. */
const ALARM = /late|overdue|past due|-\d/i;

function copyOn(rule: ComplianceRuleDef, today: string) {
  const p = currentFilingPeriod(rule, { today });
  return { period: p, copy: deadlineCopy(p.daysRemaining, p.dueDate, { rule, stateName: "Pennsylvania" }) };
}

describe("deadlineLabel", () => {
  it("counts down, then says the deadline passed without a negative number", () => {
    expect(deadlineLabel(12, "2026-09-30")).toBe("12 days left");
    expect(deadlineLabel(2, "2026-09-30")).toBe("2 days left");
    expect(deadlineLabel(1, "2026-09-30")).toBe("Due tomorrow");
    expect(deadlineLabel(0, "2026-09-30")).toBe("Due today");
    expect(deadlineLabel(-1, "2026-09-30")).toBe("Deadline passed September 30");
    expect(deadlineLabel(-92, "2026-09-30")).toBe("Deadline passed September 30");
    for (const d of [-400, -30, -1]) expect(deadlineLabel(d, "2026-06-30")).not.toMatch(ALARM);
  });
});

describe("deadlineAriaLabel", () => {
  it("uses the right singular/plural and never counts backwards", () => {
    expect(deadlineAriaLabel(5, "2026-09-30")).toBe("5 days until the September 30, 2026 deadline");
    expect(deadlineAriaLabel(1, "2026-09-30")).toBe("1 day until the September 30, 2026 deadline");
    expect(deadlineAriaLabel(0, "2026-09-30")).toBe("Due today, September 30, 2026");
    expect(deadlineAriaLabel(-1, "2026-09-30")).toBe("The September 30, 2026 deadline has passed");
    expect(deadlineAriaLabel(-40, "2026-09-30")).not.toMatch(ALARM);
  });
});

describe("hasVerifiedNoLateFee", () => {
  it("is true for Pennsylvania rules: no published fee, backed by the cited no-late-fee source", () => {
    for (const rule of [llc, lp, paRule("corporation")]) expect(hasVerifiedNoLateFee(rule)).toBe(true);
  });

  it("is true for an explicit $0 late fee on a verified rule", () => {
    expect(hasVerifiedNoLateFee({ verificationStatus: "verified", lateFeeCents: 0, sources: [] })).toBe(true);
  });

  it("is false whenever the data doesn't prove zero", () => {
    expect(hasVerifiedNoLateFee(null)).toBe(false);
    expect(hasVerifiedNoLateFee({ ...llc, verificationStatus: "unverified" })).toBe(false);
    expect(hasVerifiedNoLateFee({ ...llc, lateFeeCents: 1500 })).toBe(false);
    expect(hasVerifiedNoLateFee({ ...llc, sources: llc.sources.filter((s) => s.factKey !== "no_late_fee") })).toBe(false);
  });
});

describe("deadlineCopy", () => {
  it("adds the no-late-fee sentence only after the deadline and only with verified data", () => {
    expect(deadlineCopy(3, "2026-09-30", PA)).toEqual({ label: "3 days left", passed: false, note: null });
    expect(deadlineCopy(0, "2026-09-30", PA)).toEqual({ label: "Due today", passed: false, note: null });
    expect(deadlineCopy(-1, "2026-09-30", PA)).toEqual({
      label: "Deadline passed September 30",
      passed: true,
      note: NO_LATE_FEE_NOTE,
    });
    expect(deadlineCopy(-1, "2026-09-30").note).toBeNull();
    expect(deadlineCopy(-1, "2026-09-30", { rule: { ...llc, lateFeeCents: 1500 }, stateName: "Pennsylvania" }).note).toBeNull();
  });
});

describe("Pennsylvania LLC wording across September 30, 2026", () => {
  it("2026-09-29: due tomorrow", () => {
    const { period, copy } = copyOn(llc, "2026-09-29");
    expect(period).toMatchObject({ periodYear: 2026, daysRemaining: 1 });
    expect(copy).toEqual({ label: "Due tomorrow", passed: false, note: null });
  });

  it("2026-09-30: due today", () => {
    const { period, copy } = copyOn(llc, "2026-09-30");
    expect(period).toMatchObject({ periodYear: 2026, daysRemaining: 0, phase: "due_today" });
    expect(copy).toEqual({ label: "Due today", passed: false, note: null });
  });

  it("2026-10-01: deadline passed, no late fee, still fileable", () => {
    const { period, copy } = copyOn(llc, "2026-10-01");
    expect(period).toMatchObject({ periodYear: 2026, daysRemaining: -1, phase: "overdue" });
    expect(copy).toEqual({ label: "Deadline passed September 30", passed: true, note: NO_LATE_FEE_NOTE });
    expect(copy.label).not.toMatch(ALARM);
  });
});

describe("December 31, 2026 to January 1, 2027", () => {
  it("the December 31 group is due today, then counts down to its 2027 report", () => {
    expect(copyOn(lp, "2026-12-31").copy.label).toBe("Due today");
    const next = copyOn(lp, "2027-01-01");
    expect(next.period).toMatchObject({ periodYear: 2027, dueDate: "2027-12-31", daysRemaining: 364 });
    expect(next.copy).toEqual({ label: "364 days left", passed: false, note: null });
  });

  it("an unfiled 2026 LLC report reads as passed on Dec 31, and the 2027 report counts down on Jan 1", () => {
    expect(copyOn(llc, "2026-12-31").copy).toEqual({
      label: "Deadline passed September 30",
      passed: true,
      note: NO_LATE_FEE_NOTE,
    });
    const next = copyOn(llc, "2027-01-01");
    expect(next.period).toMatchObject({ periodYear: 2027, dueDate: "2027-09-30", daysRemaining: 272 });
    expect(next.copy.label).toBe("272 days left");
  });
});
