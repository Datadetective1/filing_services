import { describe, expect, it } from "vitest";
import { getRaJurisdiction, raJurisdictionsWithPublicFacts } from "@/lib/registered-agent/jurisdictions";
import { changeAgentGuide } from "@/lib/seo/change-agent";

/** The change-of-agent guide says only what was verified on the state's own site. */
describe("change registered agent guide", () => {
  const base = { name: "Testland", changeOfAgent: { formName: "Statement of Change (Form 9)", governmentFeeCents: { llc: 500, corporation: 2500 }, newAgentConsentRequired: true, sources: [] } };

  it("names the form and each verified fee", () => {
    const g = changeAgentGuide(base, "$119");
    expect(g?.fees).toEqual([
      { label: "LLC", text: "$5.00" },
      { label: "Corporation", text: "$25.00" },
    ]);
    expect(g?.lowestFeeText).toBe("$5.00");
    expect(g?.steps.map((s) => s.title)).toContain("File the Statement of Change (Form 9)");
    expect(g?.faq.map((f) => f.a).join(" ")).toContain("$5.00 for an LLC and $25.00 for a corporation");
    expect(g?.faq.map((f) => f.a).join(" ")).toContain("$119 a year");
  });

  it("adds the consent step only when the state requires it, and never guesses a fee", () => {
    const g = changeAgentGuide({ ...base, changeOfAgent: { ...base.changeOfAgent, newAgentConsentRequired: null, governmentFeeCents: { llc: 0 } } }, null);
    expect(g?.steps.some((s) => /consent/i.test(s.title))).toBe(false);
    expect(g?.fees).toEqual([
      { label: "LLC", text: "No state fee" },
      { label: "Corporation", text: "Not verified yet" },
    ]);
    expect(g?.faq.map((f) => f.a).join(" ")).toContain("nothing for an LLC");
    expect(g?.faq.map((f) => f.a).join(" ")).not.toMatch(/corporation\b.*\$/);
  });

  it("builds a guide for every state with a public registered agent page, with no long dashes", () => {
    const states = raJurisdictionsWithPublicFacts();
    expect(states.length).toBeGreaterThan(40);
    for (const j of states) {
      const g = changeAgentGuide(j, "$119");
      expect(g, j.code).not.toBeNull();
      const text = [...(g?.steps ?? []).flatMap((s) => [s.title, s.body]), ...(g?.faq ?? []).flatMap((f) => [f.q, f.a])].join(" ");
      expect(text, j.code).not.toMatch(/[—–]/);
    }
    expect(changeAgentGuide({ name: "X", changeOfAgent: null }, null)).toBeNull();
    expect(getRaJurisdiction("TX")).toBeDefined();
  });
});
