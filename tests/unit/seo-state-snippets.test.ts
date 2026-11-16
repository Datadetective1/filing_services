import { describe, expect, it } from "vitest";
import { getJurisdictionBySlug, rulesForState } from "@/lib/compliance/registry";
import { stateGuideSnippet } from "@/lib/seo/state-snippets";

const verified = (code: string) => rulesForState(code).filter((r) => r.verificationStatus === "verified");
const wa = getJurisdictionBySlug("washington")!;
const nv = getJurisdictionBySlug("nevada")!;

describe("state guide search snippets", () => {
  it("Washington leads with the fee and our price when we file it", () => {
    const s = stateGuideSnippet(wa, verified("WA"), { filingServiceCents: 9900, registeredAgentCents: 11900 })!;
    expect(s.title).toBe("Washington Annual Report: $70 Fee, Due Date & Filing");
    expect(s.description).toBe(
      "Due by the end of the month your business was formed, with a $70 state fee. Filewell files your Washington annual report for $99 + the state fee.",
    );
  });

  it("Washington never claims we file it when we don't", () => {
    const s = stateGuideSnippet(wa, verified("WA"), { registeredAgentCents: 11900 })!;
    expect(s.description).not.toMatch(/files your/);
    expect(s.description).toContain("free reminders");
  });

  it("Nevada uses the Annual List name and both state fees", () => {
    const s = stateGuideSnippet(nv, verified("NV"), { registeredAgentCents: 11900 })!;
    expect(s.title).toBe("Nevada Annual Report (Annual List): Due Date & Fees");
    expect(s.description).toContain("$350 for LLCs, from $650 for corporations");
    expect(s.description).not.toMatch(/files it/);
  });

  it("keeps snippets short, with no dashes and no state filing sites", () => {
    const cases = [
      stateGuideSnippet(wa, verified("WA"), { filingServiceCents: 9900, registeredAgentCents: 11900 })!,
      stateGuideSnippet(wa, verified("WA"), {})!,
      stateGuideSnippet(nv, verified("NV"), { registeredAgentCents: 11900 })!,
      stateGuideSnippet(nv, verified("NV"), { filingServiceCents: 9900 })!,
      stateGuideSnippet(nv, verified("NV"), {})!,
    ];
    for (const s of cases) {
      expect(s.title.length).toBeLessThanOrEqual(52);
      expect(s.description.length).toBeLessThanOrEqual(160);
      expect(`${s.title} ${s.description}`).not.toMatch(/--|—|–|\.gov|secretary of state|sos\./i);
    }
  });

  it("other states keep the generic snippet", () => {
    expect(stateGuideSnippet({ code: "PA" }, verified("PA"), {})).toBeNull();
  });
});
