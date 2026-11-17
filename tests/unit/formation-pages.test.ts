import { describe, expect, it } from "vitest";
import { formationNeeds, formationStateAnswer, formationStateFaq, formationStatePath, formationStateSnippet, leadType } from "@/lib/seo/formation-pages";

const tx = { code: "TX", name: "Texas", slug: "texas", feeCents: { llc: 30000, corporation: 30000 } };
const tn = { code: "TN", name: "Tennessee", slug: "tennessee", feeCents: { corporation: 10000 } };
const wy = { code: "WY", name: "Wyoming", slug: "wyoming", feeCents: { llc: 10000, corporation: 10000 } };

describe("state formation pages", () => {
  it("answers with the state fee first, then the total", () => {
    expect(formationStateAnswer(tx, 9900)).toBe(
      "The Texas state fee to form an LLC is $300. Filewell files it for $99, so you pay $399 in total, with each fee on its own line.",
    );
  });

  it("leads with a corporation where LLCs aren't open", () => {
    expect(leadType(tn)).toBe("corporation");
    expect(formationStateSnippet(tn, 9900).title).toBe("How to Start a Corporation in Tennessee: $100 State Fee");
  });

  it("keeps the search snippet within 160 characters", () => {
    for (const s of [tx, tn, wy]) expect(formationStateSnippet(s, 9900).description.length).toBeLessThanOrEqual(160);
  });

  it("asks Wyoming orders for owners' home addresses, and only Wyoming's", () => {
    expect(formationNeeds(wy).some((n) => n.includes("home address"))).toBe(true);
    expect(formationNeeds(tx).some((n) => n.includes("home address"))).toBe(false);
  });

  it("prices the FAQ from the same numbers", () => {
    const faq = formationStateFaq(tx, { serviceCents: 9900, raCents: 11900 });
    expect(faq[0].a).toContain("$399 in total");
    expect(faq.some((f) => f.a.includes("$119 a year"))).toBe(true);
    expect(formationStatePath("texas")).toBe("/business-formation/texas");
  });
});

describe("which states get a formation page", () => {
  it("skips states with a formation blocker wherever real money can be taken", async () => {
    const { vi } = await import("vitest");
    for (const [k, v] of Object.entries({
      FORMATION_SALES_ALL: "true",
      RA_PROVIDER_AGREEMENT_SIGNED: "true",
      RA_FULFILLMENT_TESTED: "true",
      BUSINESS_SERVICES_PAGES: "true",
      NEXT_PUBLIC_LEGAL_ENTITY: "Harborlune LLC",
      RA_ALERTS_MAILBOX: "alerts@example.org",
      PAYMENTS_LIVE_ENABLED: "true",
    }))
      vi.stubEnv(k, v);
    const { formationOpenStates } = await import("@/lib/registered-agent/sales");
    const codes = formationOpenStates().map((s) => s.code);
    for (const held of ["AL", "AZ", "CA", "NE", "NV", "NJ", "NY", "WV"]) expect(codes).not.toContain(held);
    expect(codes).toContain("TX");
    vi.unstubAllEnvs();
  });
});
