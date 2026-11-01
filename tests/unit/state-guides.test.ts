import { describe, expect, it } from "vitest";
import { findRule } from "@/lib/compliance/registry";
import { STATE_GUIDE_SETS } from "@/lib/seo/state-guides";

const all = STATE_GUIDE_SETS.flatMap((set) => set.guides.map((g) => ({ set, g })));

describe("state guide pages", () => {
  it("keep titles short enough to show in full with the brand appended", () => {
    for (const { g } of all) expect(`${g.title} | Filewell`.length, g.title).toBeLessThanOrEqual(70);
  });

  it("keep descriptions within what search results show", () => {
    for (const { g } of all) expect(g.description.length, g.slug).toBeLessThanOrEqual(170);
  });

  it("use no long dashes or double hyphens in copy", () => {
    for (const { g } of all) {
      const text = [g.title, g.description, g.h1, ...g.answer, ...g.blocks.flatMap((b) => [b.heading, ...(b.paragraphs ?? []), ...(b.list ?? [])])].join(" ");
      expect(text, g.slug).not.toMatch(/[—–]|--/);
    }
  });

  it("have unique slugs per state and cite at least one source", () => {
    for (const set of STATE_GUIDE_SETS) {
      const slugs = set.guides.map((g) => g.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const g of set.guides) expect(g.sources.length, g.slug).toBeGreaterThan(0);
    }
  });

  it("match the verified Florida and Montana rules", () => {
    expect(findRule("FL", "llc")?.stateFeeCents).toBe(13875);
    expect(findRule("FL", "corporation")?.stateFeeCents).toBe(15000);
    expect(findRule("FL", "llc")?.lateFeeCents).toBe(40000);
    expect(findRule("FL", "llc")?.dueRule).toMatchObject({ kind: "fixed_annual", month: 5, day: 1 });
    expect(findRule("MT", "llc")?.lateFeeCents).toBe(3500);
    expect(findRule("MT", "llc")?.dueRule).toMatchObject({ kind: "fixed_annual", month: 4, day: 15 });
  });
});
