import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Registered agent service is sold in every state, so no visitor should hit a dead end:
 * a lookup in a state where we don't file reports still offers the agent, the agent lookup
 * doesn't talk about reports, and pricing lists every service.
 */

const read = (p: string) => readFileSync(p, "utf8");

describe("a state we don't file reports in", () => {
  const result = read("src/app/(marketing)/find/result/page.tsx");

  it("offers registered agent service before saying we can't file", () => {
    const offer = result.indexOf('raSaleCheck(lookup.stateCode, lookup.entityType, "switching")');
    const deadEnd = result.indexOf("We can&apos;t help with this one yet");
    expect(offer).toBeGreaterThan(-1);
    expect(deadEnd).toBeGreaterThan(offer);
    expect(result).toContain("We can be your registered agent in ${stateName}");
  });

  it("still points to the state's own deadline", () => {
    expect(result).toContain("Check your deadline with the state");
  });
});

describe("the agent lookup", () => {
  const form = read("src/components/funnel/lookup-form.tsx");
  const find = read("src/app/(marketing)/find/page.tsx");

  it("asks for the state instead of assuming Pennsylvania", () => {
    expect(form).toContain("Choose your state");
    expect(find).toMatch(/forAgent \? "" : "PA"/);
  });

  it("talks about the agent, not a report", () => {
    expect(form).toContain('forAgent ? "Continue" : <>See what&apos;s due</>');
    expect(form).toContain("You see the full price before you pay anything.");
    expect(form).toMatch(/forAgent \? null : \([\s\S]{0,80}alreadyFiledThisYear/);
  });
});

describe("pricing", () => {
  const pricing = read("src/app/(marketing)/pricing/page.tsx");

  it("lists registered agent and the bundle beside annual reports", () => {
    expect(pricing).toContain('title="Registered agent"');
    expect(pricing).toContain('title="Agent + annual report"');
    expect(pricing).toContain('title="Annual report"');
    expect(pricing).toContain("bundleSalesOpen()");
  });
});

describe("copy", () => {
  it("has no long dashes in the changed pages", () => {
    for (const p of [
      "src/app/(marketing)/find/result/page.tsx",
      "src/components/funnel/lookup-form.tsx",
      "src/app/(marketing)/pricing/page.tsx",
      "src/components/marketing/service-choice.tsx",
      "src/components/services/ra-lookup-result.tsx",
    ]) {
      expect(read(p), p).not.toMatch(/[–—]/);
    }
  });
});
