import { describe, expect, it } from "vitest";
import { formationFeeCents, getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";

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
