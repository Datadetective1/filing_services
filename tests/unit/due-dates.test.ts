import { describe, expect, it } from "vitest";
import { dueDateRows, monthBuckets, researchedWhen } from "@/lib/seo/due-dates";

describe("annual report due dates page", () => {
  const rows = dueDateRows();

  it("covers the verified states and the researched reminder states, A to Z, once each", () => {
    const codes = rows.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of ["PA", "FL", "CO", "CT", "NY", "MD"]) expect(codes).toContain(c);
    expect(rows.map((r) => r.name)).toEqual([...rows.map((r) => r.name)].sort((a, b) => a.localeCompare(b)));
  });

  it("marks where each row comes from and keeps verified facts verified", () => {
    expect(rows.find((r) => r.code === "PA")?.source).toBe("verified");
    expect(rows.find((r) => r.code === "CT")?.source).toBe("researched");
  });

  it("states dates plainly, with no long dashes or links", () => {
    for (const r of rows) expect(`${r.when} ${r.stateFee} ${r.reportName}`).not.toMatch(/https?:\/\/|--|–|—/);
    expect(rows.find((r) => r.code === "MD")?.when).toBe("April 15");
    expect(researchedWhen({ kind: "anniversary_month_end", intervalYears: 2 })).toMatch(/^Every two years/);
  });

  it("puts fixed dates in their month and anniversary states in none", () => {
    const b = monthBuckets(rows);
    expect(b).toHaveLength(12);
    expect(b[3].codes).toContain("MD");
    const ny = rows.find((r) => r.code === "NY");
    expect(ny?.anniversary).toBe(true);
    expect(b.some((m) => m.codes.includes("NY"))).toBe(false);
  });
});
