import { afterEach, describe, expect, it, vi } from "vitest";
import { formationFeeCents, getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import { formationOpenStates } from "@/lib/registered-agent/sales";

afterEach(() => vi.unstubAllEnvs());

// State formation fees rechecked on each state's own site, 2026-11-03.
const FEES: Record<string, { llc: number; corporation: number | null }> = {
  TX: { llc: 30000, corporation: 30000 },
  PA: { llc: 12500, corporation: null },
  CO: { llc: 5000, corporation: 5000 },
  FL: { llc: 12500, corporation: 7000 },
  SD: { llc: 15000, corporation: 15000 },
  MT: { llc: 3500, corporation: 3500 },
  MI: { llc: 5000, corporation: 6000 },
};

describe("formation in Texas and the six annual-report states", () => {
  it("has the verified state fee for each entity type sold", () => {
    for (const [code, f] of Object.entries(FEES)) {
      expect(formationFeeCents(code, "llc"), code).toBe(f.llc);
      expect(formationFeeCents(code, "corporation"), code).toBe(f.corporation);
    }
  });

  it("keeps Pennsylvania corporations closed for the newspaper notice, LLCs open", () => {
    const pa = getRaJurisdiction("PA")!;
    expect(pa.formationBlockers).toEqual([]);
    expect(pa.unverified.join(" ")).toMatch(/two newspapers/);
  });
});

describe("going live with the production switches", () => {
  it("opens exactly the seven states, Pennsylvania as LLC only, with real payments on", () => {
    for (const [k, v] of Object.entries({
      PAYMENTS_LIVE_ENABLED: "true",
      RA_PROVIDER_AGREEMENT_SIGNED: "true",
      NEXT_PUBLIC_LEGAL_ENTITY: "Harborlune LLC",
      RA_ALERTS_MAILBOX: "support@getfilewell.com",
      RA_FULFILLMENT_TESTED: "true",
    }))
      vi.stubEnv(k, v);
    for (const code of Object.keys(FEES)) vi.stubEnv(`FORMATION_SALES_${code}`, "true");
    const open = formationOpenStates();
    expect(open.map((s) => s.code).sort()).toEqual(Object.keys(FEES).sort());
    for (const s of open) {
      const f = FEES[s.code];
      expect(s.feeCents, s.code).toEqual(f.corporation === null ? { llc: f.llc } : { llc: f.llc, corporation: f.corporation });
    }
  });

  it("opens nothing without a switch", () => {
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "true");
    expect(formationOpenStates()).toEqual([]);
  });
});
