import { describe, expect, it } from "vitest";
import { getJurisdictionBySlug, rulesForState } from "@/lib/compliance/registry";
import { guideArticleSnippet, stateGuideSnippet } from "@/lib/seo/state-snippets";

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
    expect(stateGuideSnippet({ code: "MI" }, verified("MI"), {})).toBeNull();
  });

  it("Pennsylvania leads with the exact search phrase and the $56 total", () => {
    const s = stateGuideSnippet({ code: "PA" }, verified("PA"), { filingServiceCents: 4900 })!;
    expect(s.title).toBe("Pennsylvania Annual Report: $7 Fee, Due Dates & Filing");
    expect(s.description).toContain("$56 total");
    expect(s.description.length).toBeLessThanOrEqual(160);
  });

  it("Florida leads with the May 1 due date and the LLC fee", () => {
    const s = stateGuideSnippet({ code: "FL" }, verified("FL"), { filingServiceCents: 4900 })!;
    expect(s.title).toMatch(/^Florida Annual Report: Due May 1, \$138\.75 LLC Fee/);
    expect(s.description.length).toBeLessThanOrEqual(160);
  });
});

describe("Utah and guide article snippets", () => {
  const ut = getJurisdictionBySlug("utah")!;

  it("Utah leads with the $18 renewal fee", () => {
    const s = stateGuideSnippet(ut, verified("UT"), { filingServiceCents: 4900 })!;
    expect(s.title).toBe("Utah Annual Report: $18 Renewal Fee & Due Date");
    expect(s.description).toContain("Filewell files it for $49 + the state fee.");
    expect(stateGuideSnippet(ut, verified("UT"), {})!.description).not.toMatch(/files it/);
  });

  it("PA articles lead with the answer and never claim we file when we don't", () => {
    const pa = verified("PA");
    const deadline = guideArticleSnippet("PA", "annual-report-deadline", pa, { filingServiceCents: 4900 })!;
    expect(deadline.title).toBe("PA Annual Report Due Dates: June 30, Sept 30, Dec 31");
    expect(deadline.description).toContain("Filewell files yours for $49 + the $7 state fee.");
    const fee = guideArticleSnippet("PA", "annual-report-fee", pa, {})!;
    expect(fee.title).toBe("PA Annual Report Fee: $7 ($0 for Nonprofits)");
    expect(fee.description).not.toMatch(/files yours/);
    expect(guideArticleSnippet("PA", "how-to-file-annual-report", pa, {})).toBeNull();
  });

  it("keeps every guide snippet short, plain and free of state filing sites", () => {
    const offers = [{}, { filingServiceCents: 4900 }, { filingServiceCents: 9900, registeredAgentCents: 11900 }];
    const cases = offers.flatMap((o) => [
      stateGuideSnippet(ut, verified("UT"), o),
      guideArticleSnippet("PA", "annual-report-deadline", verified("PA"), o),
      guideArticleSnippet("PA", "annual-report-after-deadline", verified("PA"), o),
      guideArticleSnippet("PA", "annual-report-fee", verified("PA"), o),
      guideArticleSnippet("NV", "annual-list-deadline", verified("NV"), o),
    ]);
    for (const s of cases) {
      expect(s).not.toBeNull();
      expect(s!.title.length).toBeLessThanOrEqual(58);
      expect(s!.description.length).toBeLessThanOrEqual(160);
      expect(`${s!.title} ${s!.description}`).not.toMatch(/--|—|–|\.gov|secretary of state|sos\./i);
    }
  });
});
