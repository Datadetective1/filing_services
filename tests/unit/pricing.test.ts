import { describe, expect, it } from "vitest";
import { findRule } from "@/lib/compliance/registry";
import { buildQuote, governmentFeeFor, resolveServicePrice, type ServicePrice } from "@/lib/domain/pricing";

function price(p: Partial<ServicePrice> & { id: string }): ServicePrice {
  return {
    filingTypeCode: "annual_report",
    stateCode: null,
    entityType: null,
    serviceFeeCents: 1000,
    approved: true,
    active: true,
    ...p,
  };
}

const PRICES: ServicePrice[] = [
  price({ id: "global", serviceFeeCents: 1000 }),
  price({ id: "entity", entityType: "llc", serviceFeeCents: 2000 }),
  price({ id: "state", stateCode: "PA", serviceFeeCents: 3000 }),
  price({ id: "state_entity", stateCode: "PA", entityType: "llc", serviceFeeCents: 4000 }),
  price({ id: "inactive", stateCode: "PA", entityType: "llc", serviceFeeCents: 9999, active: false }),
  price({ id: "other_type", filingTypeCode: "biennial_report", stateCode: "PA", entityType: "llc" }),
  price({ id: "other_state", stateCode: "NY", entityType: "llc", serviceFeeCents: 5000 }),
];

const scope = (stateCode: string, entityType: "llc" | "corporation") => ({
  filingTypeCode: "annual_report",
  stateCode,
  entityType,
});

describe("resolveServicePrice", () => {
  it("picks the most specific active price: state+entity > state > entity > global", () => {
    expect(resolveServicePrice(PRICES, scope("PA", "llc"))?.id).toBe("state_entity");
    expect(resolveServicePrice(PRICES, scope("PA", "corporation"))?.id).toBe("state");
    expect(resolveServicePrice(PRICES, scope("NJ", "llc"))?.id).toBe("entity");
    expect(resolveServicePrice(PRICES, scope("NJ", "corporation"))?.id).toBe("global");
    expect(resolveServicePrice(PRICES, scope("NY", "llc"))?.id).toBe("other_state");
  });

  it("is independent of input order", () => {
    const reversed = [...PRICES].reverse();
    expect(resolveServicePrice(reversed, scope("PA", "llc"))?.id).toBe("state_entity");
    expect(resolveServicePrice(reversed, scope("PA", "corporation"))?.id).toBe("state");
  });

  it("ignores inactive prices, other filing types and other states", () => {
    const onlyInactive = [price({ id: "x", stateCode: "PA", active: false })];
    expect(resolveServicePrice(onlyInactive, scope("PA", "llc"))).toBeNull();
    const otherType = [price({ id: "y", filingTypeCode: "biennial_report" })];
    expect(resolveServicePrice(otherType, scope("PA", "llc"))).toBeNull();
    const otherState = [price({ id: "z", stateCode: "NY" })];
    expect(resolveServicePrice(otherState, scope("PA", "llc"))).toBeNull();
    expect(resolveServicePrice([], scope("PA", "llc"))).toBeNull();
  });
});

describe("governmentFeeFor", () => {
  const llc = findRule("PA", "llc")!;
  const corp = findRule("PA", "corporation")!;
  const nonprofit = findRule("PA", "nonprofit_corporation")!;
  const toFee = (r: typeof llc) => ({ stateFeeCents: r.stateFeeCents, nonprofitStateFeeCents: r.nonprofitStateFeeCents });

  it("charges the standard PA fee to for-profit entities", () => {
    expect(governmentFeeFor(toFee(llc), { isNonprofit: false })).toBe(700);
    expect(governmentFeeFor(toFee(corp), { isNonprofit: false })).toBe(700);
  });

  it("uses the not-for-profit fee only where the rule defines one", () => {
    expect(governmentFeeFor(toFee(llc), { isNonprofit: true })).toBe(0);
    // Business corporations have no separate nonprofit fee in the rule: the standard fee applies.
    expect(governmentFeeFor(toFee(corp), { isNonprofit: true })).toBe(700);
    expect(governmentFeeFor(toFee(nonprofit), { isNonprofit: true })).toBe(0);
    expect(governmentFeeFor({ stateFeeCents: 700 }, { isNonprofit: true })).toBe(700);
  });
});

describe("buildQuote", () => {
  const svc = price({ id: "pa", stateCode: "PA", serviceFeeCents: 4900, approved: false });

  it("totals the government and service fee and keeps them itemized separately", () => {
    const q = buildQuote({ stateName: "Pennsylvania", filingName: "Annual Report", governmentFeeCents: 700, price: svc });
    expect(q.currency).toBe("usd");
    expect(q.governmentFeeCents).toBe(700);
    expect(q.serviceFeeCents).toBe(4900);
    expect(q.totalCents).toBe(5600);
    expect(q.lineItems).toHaveLength(2);
    expect(q.lineItems.map((l) => l.kind)).toEqual(["government_fee", "service_fee"]);
    expect(q.lineItems.map((l) => l.amountCents)).toEqual([700, 4900]);
    expect(q.lineItems.reduce((s, l) => s + l.amountCents, 0)).toBe(q.totalCents);
    expect(q.lineItems[0].description).toContain("Pennsylvania Annual Report");
    expect(q.lineItems[0].description).toMatch(/paid to the state/);
    expect(q.servicePriceId).toBe("pa");
    expect(q.servicePriceApproved).toBe(false);
  });

  it("supports a zero state fee (nonprofits)", () => {
    const q = buildQuote({ stateName: "Pennsylvania", filingName: "Annual Report", governmentFeeCents: 0, price: svc });
    expect(q.totalCents).toBe(4900);
    expect(q.lineItems[0].amountCents).toBe(0);
  });

  it("line item copy uses no em or en dashes", () => {
    const q = buildQuote({ stateName: "Pennsylvania", filingName: "Annual Report", governmentFeeCents: 700, price: svc });
    for (const l of q.lineItems) expect(l.description).not.toMatch(/[–—]/);
  });

  it("rejects invalid amounts", () => {
    const base = { stateName: "Pennsylvania", filingName: "Annual Report" };
    expect(() => buildQuote({ ...base, governmentFeeCents: -1, price: svc })).toThrow(/government fee/i);
    expect(() => buildQuote({ ...base, governmentFeeCents: 7.5, price: svc })).toThrow(/government fee/i);
    expect(() => buildQuote({ ...base, governmentFeeCents: Number.NaN, price: svc })).toThrow(/government fee/i);
    expect(() => buildQuote({ ...base, governmentFeeCents: 700, price: { ...svc, serviceFeeCents: -100 } })).toThrow(
      /service fee/i,
    );
    expect(() => buildQuote({ ...base, governmentFeeCents: 700, price: { ...svc, serviceFeeCents: 49.99 } })).toThrow(
      /service fee/i,
    );
  });
});
