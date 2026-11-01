import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { getRaJurisdiction, raJurisdictionsWithPublicFacts } from "@/lib/registered-agent/jurisdictions";
import { changeFeeText, formationLlcFeeText } from "@/lib/registered-agent/public-copy";
import { stateRegisteredAgentFaq } from "@/lib/services/public-faq";
import { changeAgentGuide } from "@/lib/seo/change-agent";

/** Long dashes and double hyphens read as machine-written; none in public copy. */
const AI_TELLS = /[—–]|--/;

describe("state registered agent page copy", () => {
  it("states the change fee once when both entity types pay the same", () => {
    const tx = getRaJurisdiction("TX")!;
    expect(changeFeeText(tx)).toBe("$15 for an LLC or a corporation");
    expect(formationLlcFeeText(tx)).toBe("$300");
  });

  it("answers cost, self-service and own-agent questions for every public state, with no AI tells", () => {
    const states = raJurisdictionsWithPublicFacts();
    expect(states.length).toBeGreaterThanOrEqual(51);
    for (const j of states) {
      const faq = stateRegisteredAgentFaq({
        stateName: j.name,
        priceText: "$119",
        changeFormName: j.changeOfAgent!.formName,
        appointmentProcess: j.appointmentProcess,
        changeFee: changeFeeText(j),
      });
      expect(faq.some((f) => f.q === `Can I be my own registered agent in ${j.name}?`)).toBe(true);
      const guide = changeAgentGuide(j, "$119")!;
      expect(guide.faq.some((f) => f.q === `Can I be my own registered agent in ${j.name}?`)).toBe(true);
      expect(guide.faq.some((f) => /not a government agency/.test(f.a))).toBe(true);
      for (const t of [...faq, ...guide.faq].flatMap((f) => [f.q, f.a])) expect(t, `${j.code}: ${t}`).not.toMatch(AI_TELLS);
    }
  });

  it("leaves the fee out of the answer when it isn't verified", () => {
    const faq = stateRegisteredAgentFaq({ stateName: "Nowhere", priceText: null, changeFormName: "Form X", appointmentProcess: null, changeFee: null });
    expect(faq.find((f) => f.q.startsWith("How do I change"))!.a).not.toMatch(/state's fee is/);
  });

  it("keeps the 'not a government agency' and 'be your own agent' notes on the pages", () => {
    const change = readFileSync("src/app/(marketing)/registered-agent/[state]/change/page.tsx", "utf8");
    expect(change).toContain("not a government agency");
    expect(change).toContain("be your own registered agent");
    const state = readFileSync("src/app/(marketing)/registered-agent/[state]/page.tsx", "utf8");
    expect(state).toContain("Filewell is not affiliated with the state");
  });
});

describe("registered agent pages in the sitemap", () => {
  beforeEach(() => {
    for (const k of ["VERCEL_ENV", "NEXT_PUBLIC_VERCEL_ENV", "NEXT_PUBLIC_ALLOW_INDEXING", "NEXT_PUBLIC_SITE_URL", "BUSINESS_SERVICES_PAGES"]) vi.stubEnv(k, undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("lists every state page and its change guide, with the date the facts were checked, once launched", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", "true");
    vi.stubEnv("BUSINESS_SERVICES_PAGES", "true");
    const entries = sitemap();
    const urls = entries.map((e) => new URL(e.url).pathname);
    expect(urls).toContain("/registered-agent");
    for (const j of raJurisdictionsWithPublicFacts()) {
      expect(urls).toContain(`/registered-agent/${j.slug}`);
      expect(urls).toContain(`/registered-agent/${j.slug}/change`);
    }
    expect(new Set(urls).size).toBe(urls.length);
    const tx = entries.find((e) => e.url.endsWith("/registered-agent/texas"))!;
    expect(tx.lastModified).toBeInstanceOf(Date);
  });

  it("lists none of them before launch", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls.some((u) => u.startsWith("/registered-agent"))).toBe(false);
  });
});
