import { describe, expect, it } from "vitest";
import { countyLabel } from "@/lib/format/county";
import { formatRegisteredOffice } from "@/lib/intake/validate";
import { annualReportEconomicsLine, refundTotalsByOrder, sumEconomics } from "@/lib/services/economics";
import { FILING_AGENT_TOKEN, OWNER_CHECKS } from "@/lib/admin/owner-checks";

describe("countyLabel", () => {
  it("adds County once", () => {
    expect(countyLabel("Lehigh")).toBe("Lehigh County");
    expect(countyLabel("Lehigh County")).toBe("Lehigh County");
    expect(countyLabel("lehigh county ")).toBe("lehigh county");
    expect(countyLabel("Orleans Parish")).toBe("Orleans Parish");
  });
  it("registered office never says County twice", () => {
    const r = { mode: "address", line1: "85 Willow St", city: "Macungie", region: "PA", postal_code: "18062", county: "Lehigh County" };
    expect(formatRegisteredOffice(r as never)).toBe("85 Willow St, Macungie, PA 18062, Lehigh County");
  });
});

describe("annual report economics with refunds", () => {
  const order = { id: "o1", service_fee_cents: 4900, government_fee_cents: 700, total_cents: 5600, status: "refunded" };
  it("a fully refunded order adds no revenue and leaves no government balance", () => {
    const refunds = refundTotalsByOrder([{ order_id: "o1", service_fee_cents: 4900, government_fee_cents: 700 }]);
    const t = sumEconomics([annualReportEconomicsLine(order, refunds.get("o1"))]);
    expect(t.netServiceRevenueCents).toBe(0);
    expect(t.governmentFeeBalanceCents).toBe(0);
    expect(t.contributionCents).toBeLessThan(0); // the card fee is not returned on refunds
  });
  it("a paid order still counts in full", () => {
    const t = sumEconomics([annualReportEconomicsLine({ ...order, status: "paid" })]);
    expect(t.netServiceRevenueCents).toBe(4900);
    expect(t.governmentFeeBalanceCents).toBe(0);
  });
});

describe("owner checks operator name", () => {
  it("never hard-codes an operator name in the Washington counsel text", () => {
    const text = JSON.stringify(OWNER_CHECKS);
    expect(text).not.toMatch(/sole proprietor will certify|Amary Coulibaly, sole proprietor, doing business/);
    expect(text).toContain(FILING_AGENT_TOKEN);
  });
});
