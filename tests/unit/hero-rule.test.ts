import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroStatusCard } from "@/components/marketing/hero-status-card";
import { rulesForState } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { currentFilingPeriod } from "@/lib/domain/deadlines";
import { dueGroups } from "@/lib/seo/content";
import { heroRule } from "@/lib/seo/hero-rule";

/** The homepage hero shows the Pennsylvania rule whose next verified due date is soonest. */

const PA = rulesForState("PA");

describe("heroRule (Pennsylvania)", () => {
  it.each([
    ["2026-10-28", "lp", "2026-12-31"],
    ["2027-01-15", "corporation", "2027-06-30"],
    ["2027-07-15", "llc", "2027-09-30"],
    ["2026-12-31", "lp", "2026-12-31"],
    // The edges: a due date is still "next" on the day itself.
    ["2026-09-30", "llc", "2026-09-30"],
    ["2026-10-01", "lp", "2026-12-31"],
    ["2027-01-01", "corporation", "2027-06-30"],
    ["2027-06-30", "corporation", "2027-06-30"],
    ["2027-07-01", "llc", "2027-09-30"],
  ])("on %s shows %s (due %s)", (today, entityType, dueDate) => {
    const pick = heroRule(PA, today);
    expect(pick?.rule.entityType).toBe(entityType);
    expect(pick?.dueDate).toBe(dueDate);
  });

  it("for December 31 uses the limited partnership, the rule the homepage's deadline group links to", () => {
    const dec31 = dueGroups(PA).find((g) => g.month === 12 && g.dayOfMonth === 31);
    expect(dec31?.rules[0].entityType).toBe("lp");
    expect(heroRule(PA, "2026-10-28")?.rule).toBe(dec31?.rules[0]);
  });

  it("the chosen rule's current period is never a missed one, so the card counts down to a real date", () => {
    for (const today of ["2026-10-28", "2027-01-15", "2027-07-15", "2026-12-31"]) {
      const pick = heroRule(PA, today)!;
      const period = currentFilingPeriod(pick.rule, { today });
      expect(period.phase).not.toBe("overdue");
      expect(period.dueDate).toBe(pick.dueDate);
    }
  });

  it("only uses verified rules with a fixed annual due date", () => {
    const unverified = PA.map((r): ComplianceRuleDef => (r.entityType === "lp" ? { ...r, verificationStatus: "unverified" } : r));
    // Without the LP, the December 31 group's next verified rule is shown.
    expect(heroRule(unverified, "2026-10-28")?.rule.entityType).toBe("llp");
    const anniversary = PA.map((r): ComplianceRuleDef => ({ ...r, dueRule: { kind: "anniversary_month_end" } }));
    expect(heroRule(anniversary, "2026-10-28")).toBeNull();
    expect(heroRule([], "2026-10-28")).toBeNull();
  });

  it("HeroStatusCard renders the chosen rule as is (entity, due date, verified source)", () => {
    const { rule } = heroRule(PA, "2026-10-28")!;
    const period = currentFilingPeriod(rule, { today: "2026-10-28" });
    const html = renderToStaticMarkup(createElement(HeroStatusCard, { rule, period, stateName: "Pennsylvania", agency: "Pennsylvania Department of State" }));
    expect(html).toContain("Limited partnership (LP / LLLP)");
    expect(html).toContain("2026 annual report");
    expect(html).not.toMatch(/past due|overdue/i);
  });
});
