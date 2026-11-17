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
