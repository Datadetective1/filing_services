import { describe, expect, it } from "vitest";
import { serviceFeeText } from "@/lib/services/fee-text";

describe("serviceFeeText", () => {
  it("is null when nothing is open", () => {
    expect(serviceFeeText([])).toBeNull();
  });
  it("names one fee once", () => {
    expect(serviceFeeText([{ serviceCents: 4900 }, { serviceCents: 4900 }])).toEqual({ lowest: "$49", all: "$49" });
  });
  it("names two fees, lowest first", () => {
    expect(serviceFeeText([{ serviceCents: 9900 }, { serviceCents: 4900 }])).toEqual({ lowest: "$49", all: "$49 or $99" });
  });
  it("gives a range for three or more", () => {
    expect(serviceFeeText([{ serviceCents: 9900 }, { serviceCents: 4900 }, { serviceCents: 7500 }])).toEqual({ lowest: "$49", all: "$49 to $99" });
  });
});
