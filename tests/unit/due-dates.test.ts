import { describe, expect, it } from "vitest";
import { isStateVerified } from "@/lib/compliance/registry";
import { dueDateRows, monthBuckets } from "@/lib/seo/due-dates";

describe("annual report due dates page", () => {
  const rows = dueDateRows();

  it("lists only verified states, A to Z, once each", () => {
    const codes = rows.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(isStateVerified(c)).toBe(true);
    for (const c of ["PA", "FL", "CO"]) expect(codes).toContain(c);
    for (const c of ["CT", "NY", "MD"]) expect(codes).not.toContain(c);
    expect(rows.map((r) => r.name)).toEqual([...rows.map((r) => r.name)].sort((a, b) => a.localeCompare(b)));
  });

  it("states dates plainly, with no long dashes, links or unverified wording", () => {
    for (const r of rows) expect(`${r.when} ${r.stateFee} ${r.reportName}`).not.toMatch(/https?:\/\/|--|–|—|not verified/i);
  });

  it("puts fixed dates in their month and anniversary states in none", () => {
    const b = monthBuckets(rows);
    expect(b).toHaveLength(12);
    expect(b[5].codes).toContain("PA");
    const anniversary = rows.filter((r) => r.anniversary);
    for (const r of anniversary) expect(b.some((m) => m.codes.includes(r.code))).toBe(false);
  });
});
