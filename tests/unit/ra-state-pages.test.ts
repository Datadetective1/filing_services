import { afterEach, describe, expect, it } from "vitest";
import { getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import { bundleSaleCheck, bundleSalesOpen } from "@/lib/registered-agent/sales";
import { stateRegisteredAgentFaq } from "@/lib/services/public-faq";

describe("per-state registered agent page copy", () => {
  afterEach(() => {
    delete process.env.RA_BUNDLE_SALES;
  });

  it("builds a state FAQ from verified facts only", () => {
    const fl = getRaJurisdiction("FL")!;
    const faq = stateRegisteredAgentFaq({
      stateName: fl.name,
      priceText: "$119",
      changeFormName: fl.changeOfAgent!.formName,
      appointmentProcess: fl.appointmentProcess,
    });
    expect(faq.map((f) => f.q)).toContain("Do I need a registered agent in Florida?");
    expect(faq.some((f) => f.a.includes(fl.changeOfAgent!.formName))).toBe(true);
    expect(faq.some((f) => f.a.includes("$119 a year"))).toBe(true);
    for (const f of faq) expect(`${f.q} ${f.a}`).not.toMatch(/[—–]/);
  });

  it("leaves out the new-business answer when the state's appointment process is not verified", () => {
    const faq = stateRegisteredAgentFaq({ stateName: "Nowhere", priceText: null, changeFormName: "Form X", appointmentProcess: null });
    expect(faq.some((f) => f.q.startsWith("How do I name"))).toBe(false);
    expect(faq.some((f) => f.a.includes("a year per business"))).toBe(false);
  });

  it("shows the bundle only while its switch is on", () => {
    expect(bundleSalesOpen()).toBe(false);
    expect(bundleSaleCheck("FL", { entityType: "llc", isForeign: false, isNonprofit: false }, "switching").ok).toBe(false);
    process.env.RA_BUNDLE_SALES = "true";
    expect(bundleSalesOpen()).toBe(true);
  });
});
