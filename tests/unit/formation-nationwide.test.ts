import { afterEach, describe, expect, it, vi } from "vitest";
import { placesText, stateCount } from "@/lib/registered-agent/public-copy";
import { formationOpenStates } from "@/lib/registered-agent/sales";

afterEach(() => vi.unstubAllEnvs());

/**
 * Formation fees with FORMATION_SALES_ALL on: the seven states rechecked 2026-11-03 and every
 * other jurisdiction rechecked on its own official site 2026-11-13. A missing entity type is
 * not sold there.
 */
const OPEN: Record<string, { llc?: number; corporation?: number }> = {
  AK: { llc: 25000, corporation: 25000 },
  AR: { llc: 4500, corporation: 4500 },
  CO: { llc: 5000, corporation: 5000 },
  CT: { llc: 12000 },
  DC: { llc: 9900 },
  DE: { llc: 11000 },
  FL: { llc: 12500, corporation: 7000 },
  GA: { llc: 11000 },
  HI: { llc: 5100, corporation: 5100 },
  IA: { llc: 5000, corporation: 5000 },
  ID: { llc: 10000, corporation: 10000 },
  IL: { llc: 15000 },
  IN: { llc: 9500, corporation: 9500 },
  KS: { llc: 8500, corporation: 8500 },
  KY: { llc: 4000 },
  LA: { llc: 12500, corporation: 9500 },
  MA: { llc: 50000, corporation: 27500 },
  MD: { llc: 10000 },
  ME: { llc: 17500, corporation: 14500 },
  MI: { llc: 5000, corporation: 6000 },
  MN: { llc: 15500, corporation: 15500 },
  MO: { llc: 5000 },
  MS: { llc: 5000, corporation: 5000 },
  MT: { llc: 3500, corporation: 3500 },
  NC: { llc: 12500, corporation: 12500 },
  ND: { llc: 13500, corporation: 10000 },
  NH: { llc: 10200, corporation: 10200 },
  NM: { llc: 5000 },
  OH: { llc: 9900 },
  OK: { llc: 10000 },
  OR: { llc: 10000, corporation: 10000 },
  PA: { llc: 12500 },
  PR: { llc: 25000, corporation: 15000 },
  RI: { llc: 15600, corporation: 23800 },
  SC: { llc: 11000, corporation: 13500 },
  SD: { llc: 15000, corporation: 15000 },
  TN: { corporation: 10000 },
  TX: { llc: 30000, corporation: 30000 },
  UT: { llc: 5900, corporation: 5900 },
  VA: { llc: 10000 },
  VT: { llc: 15500, corporation: 15500 },
  WA: { llc: 20000, corporation: 20000 },
  WI: { llc: 13000, corporation: 10000 },
  WY: { llc: 10000, corporation: 10000 },
};

/** Held back on purpose: publication, extra filings or fees that vary, or conflicting official pages. */
const HELD = ["AL", "AZ", "CA", "NE", "NJ", "NV", "NY", "WV"];

function live() {
  for (const [k, v] of Object.entries({
    PAYMENTS_LIVE_ENABLED: "true",
    RA_PROVIDER_AGREEMENT_SIGNED: "true",
    NEXT_PUBLIC_LEGAL_ENTITY: "Harborlune LLC",
    RA_ALERTS_MAILBOX: "support@getfilewell.com",
    RA_FULFILLMENT_TESTED: "true",
    FORMATION_SALES_ALL: "true",
  }))
    vi.stubEnv(k, v);
}

describe("formation nationwide", () => {
  it("opens every verified jurisdiction with its verified fees, and nothing else", () => {
    live();
    const open = formationOpenStates();
    expect(Object.fromEntries(open.map((s) => [s.code, s.feeCents]))).toEqual(OPEN);
    for (const code of HELD) expect(open.some((s) => s.code === code), code).toBe(false);
  });

  it("counts 42 states, plus DC and Puerto Rico", () => {
    live();
    const open = formationOpenStates();
    expect(stateCount(open.map((s) => s.code))).toBe(42);
    expect(placesText(open)).toBe("42 states, DC and Puerto Rico");
  });
});

describe("placesText", () => {
  it("names a single place and says all 50 when every state is in", () => {
    expect(placesText([{ code: "TX", name: "Texas" }])).toBe("Texas");
    const fifty = Array.from({ length: 50 }, (_, i) => ({ code: `S${i}`, name: `State ${i}` }));
    expect(placesText([...fifty, { code: "DC", name: "District of Columbia" }])).toBe("all 50 states and DC");
    expect(placesText([{ code: "TX", name: "Texas" }, { code: "FL", name: "Florida" }])).toBe("2 states");
  });
});
