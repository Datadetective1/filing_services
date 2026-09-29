import { describe, expect, it } from "vitest";
import { rulesForState } from "@/lib/compliance/registry";
import { dueGroups, dueSummary } from "@/lib/seo/content";

describe("dueGroups", () => {
  const rules = rulesForState("PA");

  it("groups Pennsylvania rules by due day in calendar order", () => {
    const groups = dueGroups(rules);
    expect(groups.map((g) => g.day)).toEqual(["June 30", "September 30", "December 31"]);
    expect(groups.map((g) => [g.month, g.dayOfMonth])).toEqual([
      [6, 30],
      [9, 30],
      [12, 31],
    ]);
    expect(groups[1].who).toBe("LLCs");
    expect(groups[2].who).toBe("Other filing entities");
  });

  it("covers every rule exactly once", () => {
    const grouped = dueGroups(rules).flatMap((g) => g.rules.map((r) => r.ruleKey));
    expect(grouped.sort()).toEqual(rules.map((r) => r.ruleKey).sort());
  });

  it("agrees with the prose summary", () => {
    const summary = dueSummary(rules);
    for (const g of dueGroups(rules)) expect(summary).toContain(`by ${g.day}`);
  });
});
