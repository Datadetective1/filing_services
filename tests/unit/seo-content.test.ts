import { describe, expect, it } from "vitest";
import { rulesForState } from "@/lib/compliance/registry";
import { dueAndFeeSentence, dueDayText, dueGroups, dueSummary } from "@/lib/seo/content";

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

describe("dueAndFeeSentence", () => {
  it("keeps the comma inside a relative due rule instead of turning it into 'or'", () => {
    const days = dueGroups(rulesForState("NV")).map((g) => g.day);
    const text = dueAndFeeSentence(days, "$350 to $650");
    expect(text).toContain("(or registered, if formed elsewhere)");
    expect(text).not.toContain("registered or if");
    expect(text).not.toContain("depending on the entity type");
  });

  it("joins several due days with 'or' and names entity types", () => {
    const days = dueGroups(rulesForState("PA")).map((g) => g.day);
    expect(dueAndFeeSentence(days, "$7")).toBe(
      "Annual reports, due June 30, September 30 or December 31 depending on the entity type. State fee $7.",
    );
  });

  it("says 'No state fee.' rather than 'State fee no state fee.'", () => {
    expect(dueAndFeeSentence(["April 15"], "no state fee")).toBe("Annual reports, due April 15. No state fee.");
  });
});

describe("dueDayText in meta descriptions", () => {
  it("never starts a relative Colorado rule with a capital 'End of'", () => {
    for (const r of rulesForState("CO")) expect(dueDayText(r)).not.toMatch(/^End of/);
  });
});
