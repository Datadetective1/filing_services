import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateFees } from "@/lib/compliance/fees";
import { openQuestionsFor } from "@/lib/compliance/open-questions";
import { findRule, isRuleSellable, RULES } from "@/lib/compliance/registry";
import { currentFilingPeriod, filingWindowOpensOn, isFilingWindowOpen } from "@/lib/domain/deadlines";
import { filingWindowText, stateFaq, stateWindowSentence } from "@/lib/seo/content";

afterEach(() => vi.unstubAllEnvs());

const ctx = (dueDate: string, filingDate: string) => ({ isNonprofit: false, dueDate, filingDate, status: null });

describe("South Dakota annual report", () => {
  const llc = findRule("SD", "llc")!;

  it("costs $55, plus $55 when filed after the end of the anniversary month", () => {
    expect(evaluateFees(llc, ctx("2027-03-31", "2027-03-31")).totalCents).toBe(5500);
    expect(evaluateFees(llc, ctx("2027-03-31", "2027-04-01")).totalCents).toBe(11000);
    expect(currentFilingPeriod(llc, { today: "2027-03-10", formationDate: "2021-03-04" }).dueDate).toBe("2027-03-31");
  });

  it("blocks the January 31 filing date and agricultural land", () => {
    const fields = llc.intake.sections.flatMap((s) => s.fields);
    const blockedValues = (key: string) => {
      const f = fields.find((x) => x.key === key);
      return f?.type === "choice" ? f.blocked?.map((b) => b.value) : undefined;
    };
    expect(blockedValues("filing_date_choice")).toEqual(["jan31"]);
    expect(blockedValues("owns_agricultural_land")).toEqual(["yes"]);
  });
});

describe("Montana annual report", () => {
  it("is free by April 15 and $35 after, for LLCs and domestic corporations", () => {
    const llc = findRule("MT", "llc")!;
    expect(llc.dueRule).toEqual({ kind: "fixed_annual", month: 4, day: 15 });
    expect(evaluateFees(llc, ctx("2027-04-15", "2027-04-15")).totalCents).toBe(0);
    expect(evaluateFees(llc, ctx("2027-04-15", "2027-04-16")).totalCents).toBe(3500);
    expect(findRule("MT", "corporation")!.appliesTo).toBe("domestic");
  });
});

describe("Michigan corporation annual report", () => {
  const corp = findRule("MI", "corporation")!;

  it("covers corporations only, due May 15 with a $25 fee", () => {
    expect(RULES.filter((r) => r.stateCode === "MI").map((r) => r.entityType)).toEqual(["corporation"]);
    expect(corp.dueRule).toEqual({ kind: "fixed_annual", month: 5, day: 15, opens: { month: 1, day: 15 } });
    expect(corp.stateFeeCents).toBe(2500);
  });

  it("adds $10 for each month or part of a month late, up to $50, matching LARA's table", () => {
    const total = (filingDate: string) => evaluateFees(corp, ctx("2027-05-15", filingDate)).totalCents;
    expect(total("2027-05-15")).toBe(2500);
    expect(total("2027-05-16")).toBe(3500);
    expect(total("2027-05-31")).toBe(3500);
    expect(total("2027-06-01")).toBe(4500);
    expect(total("2027-06-30")).toBe(4500);
    expect(total("2027-07-01")).toBe(5500);
    expect(total("2027-08-01")).toBe(6500);
    expect(total("2027-08-31")).toBe(6500);
    expect(total("2027-09-01")).toBe(7500);
    expect(total("2028-01-10")).toBe(7500);
  });

  it("opens on January 15, as LARA says, everywhere the page and app show it", () => {
    expect(isFilingWindowOpen(corp, 2027, "2027-05-15", "2027-01-14")).toBe(false);
    expect(isFilingWindowOpen(corp, 2027, "2027-05-15", "2027-01-15")).toBe(true);
    expect(filingWindowOpensOn(corp, 2027, "2027-05-15")).toBe("2027-01-15");
    expect(filingWindowText(corp)).toBe("Opens January 15 of the report year");
    expect(stateWindowSentence([corp])).toBe("The filing window opens January 15 of the report year.");
    const faq = stateFaq([corp], "Michigan", "LARA").map((f) => f.a).join(" ");
    expect(faq).toContain("opens January 15");
    expect(faq).not.toContain("January 1 ");
  });

  it("leaves other fixed-date states opening January 1", () => {
    const pa = RULES.find((r) => r.stateCode === "PA" && r.dueRule.kind === "fixed_annual")!;
    expect(filingWindowText(pa)).toBe("Opens January 1 of the report year");
    expect(filingWindowText(findRule("FL", "llc")!)).toBe("Opens January 1 of the report year");
  });
});

describe("new states stay closed for sale", () => {
  it("each has an open question and isn't sellable even with its switch on in production", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    for (const st of ["FL", "CO", "SD", "MT", "MI"]) {
      vi.stubEnv(`${st}_LIVE_FILING_SALES`, "true");
      expect(openQuestionsFor(st).length, st).toBeGreaterThan(0);
    }
    for (const r of RULES.filter((x) => ["FL", "CO", "SD", "MT", "MI"].includes(x.stateCode))) expect(isRuleSellable(r), r.ruleKey).toBe(false);
  });
});
