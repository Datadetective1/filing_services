import { describe, expect, it } from "vitest";
import { getJurisdiction } from "@/lib/compliance/registry";
import { STATE_ANSWERS } from "@/lib/seo/state-answers";

describe("state answers", () => {
  for (const [code, a] of Object.entries(STATE_ANSWERS)) {
    it(`${code}: leads with the search phrase, cites official pages, and stays short`, () => {
      const j = getJurisdiction(code);
      expect(j).toBeTruthy();
      expect(a.title.startsWith(`${j!.name} Annual Report`)).toBe(true);
      expect(a.description.length).toBeLessThanOrEqual(160);
      expect(a.sources.length).toBeGreaterThan(0);
      for (const s of a.sources) expect(new URL(s.url).hostname).toMatch(/(\.gov|\.us)$|^(www\.)?sec\.state\.ma\.us$|^sosnc\.gov$/);
      const text = [a.title, a.description, a.answer, a.llc, ...a.more, ...a.facts.flatMap((f) => [f.term, f.value])].join(" ");
      expect(text).not.toMatch(/—|–| -- /);
      expect(text).not.toMatch(/https?:\/\//);
    });
  }
});
