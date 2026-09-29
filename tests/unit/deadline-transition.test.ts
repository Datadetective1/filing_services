import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroStatusCard } from "@/components/marketing/hero-status-card";
import { ProductPreview } from "@/components/marketing/product-preview";
import { CountdownRing } from "@/components/visual/countdown-ring";
import { findRule } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { isFilingWindowOpen } from "@/lib/domain/deadlines";
import { marketingPeriod } from "@/lib/seo/period";

function paRule(entityType: "llc" | "lp"): ComplianceRuleDef {
  const rule = findRule("PA", entityType);
  if (!rule) throw new Error(`missing PA rule for ${entityType}`);
  return rule;
}

const llc = paRule("llc");
const lp = paRule("lp");
const at = (iso: string) => new Date(iso);

/** Visible text only (tags stripped), so attribute values don't count. */
function text(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
}

// businessNow() honours FILEWELL_CLOCK_OVERRIDE over the fake system time, so clear it
// here: a shell pinned for visual QA must not change these results.
beforeEach(() => {
  vi.stubEnv("FILEWELL_CLOCK_OVERRIDE", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("marketingPeriod at the September 30 boundary (America/New_York)", () => {
  it("Sept 29: the 2026 report, due tomorrow", () => {
    const { period, missed } = marketingPeriod(llc, at("2026-09-29T16:00:00Z"));
    expect(period).toMatchObject({ periodYear: 2026, dueDate: "2026-09-30", daysRemaining: 1, phase: "due_soon" });
    expect(missed).toBeNull();
  });

  it("11:59 pm ET on Sept 30 is still the due date", () => {
    const { period, missed } = marketingPeriod(llc, at("2026-10-01T03:59:00Z"));
    expect(period).toMatchObject({ periodYear: 2026, daysRemaining: 0, phase: "due_today" });
    expect(missed).toBeNull();
  });

  it("midnight ET on Oct 1 moves to the 2027 report and returns the missed 2026 report", () => {
    const { period, missed } = marketingPeriod(llc, at("2026-10-01T04:00:00Z"));
    expect(period).toMatchObject({ periodYear: 2027, dueDate: "2027-09-30", daysRemaining: 364 });
    expect(missed).toMatchObject({ periodYear: 2026, dueDate: "2026-09-30", daysRemaining: -1, phase: "overdue" });
  });

  it("the missed 2026 report stays fileable through Dec 31 (find/result keeps 'Have us file it')", () => {
    for (const today of ["2026-10-01", "2026-12-31"]) {
      expect(isFilingWindowOpen(llc, 2026, "2026-09-30", today)).toBe(true);
    }
  });
});

describe("marketingPeriod at the December 31 to January 1 rollover", () => {
  it("Dec 31: LLC still shows the missed 2026 report; the Dec 31 group is due today", () => {
    const now = at("2026-12-31T16:00:00Z");
    const llcInfo = marketingPeriod(llc, now);
    expect(llcInfo.period).toMatchObject({ periodYear: 2027, daysRemaining: 273 });
    expect(llcInfo.missed).toMatchObject({ periodYear: 2026, daysRemaining: -92 });
    expect(marketingPeriod(lp, now)).toMatchObject({ period: { periodYear: 2026, daysRemaining: 0 }, missed: null });
  });

  it("11:59 pm ET on Dec 31 is still 2026", () => {
    expect(marketingPeriod(llc, at("2027-01-01T04:59:00Z")).missed).toMatchObject({ periodYear: 2026 });
  });

  it("midnight ET on Jan 1, 2027 starts the 2027 reports with nothing missed", () => {
    const now = at("2027-01-01T05:00:00Z");
    expect(marketingPeriod(llc, now)).toMatchObject({ period: { periodYear: 2027, daysRemaining: 272 }, missed: null });
    expect(marketingPeriod(lp, now)).toMatchObject({ period: { periodYear: 2027, dueDate: "2027-12-31", daysRemaining: 364 }, missed: null });
  });
});

describe("CountdownRing", () => {
  const ring = (days: number) => renderToStaticMarkup(createElement(CountdownRing, { days, label: "x" }));

  it("shows days before the deadline, 'Due today' on it and a neutral 'Passed' after it", () => {
    expect(text(ring(2))).toBe("2 days");
    expect(text(ring(1))).toBe("1 day");
    expect(text(ring(0))).toBe("Due today");
    // No number (negative or absolute) and no "late" wording once the date has passed.
    for (const days of [-1, -30]) expect(text(ring(days))).toBe("Passed");
  });
});

describe("homepage cards after the deadline", () => {
  it("the hero shows the missed 2026 report as fileable, with the 2027 due date as secondary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at("2026-10-01T14:00:00Z"));
    const { period, missed } = marketingPeriod(llc);
    const html = renderToStaticMarkup(
      createElement(HeroStatusCard, { rule: llc, period, missed, stateName: "Pennsylvania", agency: "Pennsylvania Department of State" }),
    );
    const t = text(html);
    expect(t).toContain("2026 annual report");
    expect(t).toContain("Deadline passed September 30");
    expect(t).toContain("Pennsylvania charges no state late fee, and the report can still be filed.");
    expect(t).toContain("Next: 2027 report due September 30, 2027");
    expect(t).not.toMatch(/Filing opens|Filing for the .* opens|days late|past due|overdue/);
    expect(html).toContain('aria-label="The September 30, 2026 deadline has passed"');
  });

  it("before the deadline the hero is unchanged: this year's report and its countdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at("2026-09-29T14:00:00Z"));
    const { period, missed } = marketingPeriod(llc);
    const t = text(
      renderToStaticMarkup(
        createElement(HeroStatusCard, { rule: llc, period, missed, stateName: "Pennsylvania", agency: "Pennsylvania Department of State" }),
      ),
    );
    expect(t).toContain("2026 annual report");
    expect(t).toContain("Due September 30, 2026");
    expect(t).toContain("Filing window is open");
    expect(t).not.toContain("Next:");
  });

  it("without a missed report, a future report says which year opens when", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at("2026-10-01T14:00:00Z"));
    const { period } = marketingPeriod(llc);
    const t = text(
      renderToStaticMarkup(createElement(HeroStatusCard, { rule: llc, period, stateName: "Pennsylvania", agency: "Pennsylvania Department of State" })),
    );
    expect(t).toContain("Filing for the 2027 report opens Jan 1, 2027");
  });

  it("the product preview shows the missed report with 'Have us file it' still available", () => {
    const { missed } = marketingPeriod(llc, at("2026-10-01T14:00:00Z"));
    expect(missed).not.toBeNull();
    const html = renderToStaticMarkup(
      createElement(ProductPreview, { rule: llc, period: missed!, stateName: "Pennsylvania", nextReminder: "2026-10-07" }),
    );
    const t = text(html);
    expect(t).toContain("The Sep 30 deadline for the 2026 annual report has passed");
    expect(t).toContain("Have us file it");
    expect(t).toContain("2025 report");
    expect(t).not.toMatch(/days late|past due|overdue/);
  });
});
