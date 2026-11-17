import { describe, expect, it } from "vitest";
import { checkedLabel, reportPriceComparison } from "@/lib/seo/report-comparisons";

describe("annual report price comparisons", () => {
  it("lists Northwest's own Pennsylvania price and nothing for states we haven't checked", () => {
    const pa = reportPriceComparison("PA");
    expect(pa).toEqual([expect.objectContaining({ name: "Northwest Registered Agent", serviceCents: 10000 })]);
    expect(reportPriceComparison("FL")).toEqual([]);
  });

  it("dates every price", () => {
    for (const row of reportPriceComparison("PA")) expect(checkedLabel(row.checked)).toBe("November 17, 2026");
  });
});
