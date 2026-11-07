import { describe, expect, it } from "vitest";
import { plansFrom } from "@/components/marketing/plan-cards";
import type { PlanOffers } from "@/lib/services/plan-offers";

const base: PlanOffers = { bundleStateCount: 6, reportFromCents: 4900, reportStateCount: 6, formationStates: [] };

describe("annual report plan card", () => {
  it("leads with a real all-in total when one is known", () => {
    const card = plansFrom({ ...base, reportExample: { stateName: "Pennsylvania", totalCents: 5600 } }).find((p) => p.title === "Annual report");
    expect(card?.points[0]).toBe("Pennsylvania: $56 total, state fee included");
    expect(card?.points).toHaveLength(3);
  });

  it("keeps the plain points when no total is known", () => {
    const card = plansFrom(base).find((p) => p.title === "Annual report");
    expect(card?.points[0]).toBe("Pay once per filing");
  });
});
