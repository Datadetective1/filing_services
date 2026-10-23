import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Fail-closed sales and public claims for the expansion states (WA, NV, UT): an unresolved
 * state question blocks sales wherever real money could be taken, nonprofits are never sold
 * outside their verified scope, and no public page or reminder offers paid filing in a state
 * whose sales switch is off.
 */

vi.mock("server-only", () => ({}));
const { findRule, isRuleSellable, isSellableForBusiness, RULES, stateAuthorizationForEntity, stateAuthorizationForState, stateSupportLabel } = await import(
  "@/lib/compliance/registry"
);
const { buildFilingPacket } = await import("@/lib/filings/packet");
const { readyToFileBlockers } = await import("@/lib/filings/operations");
const { filingOptionsSentence } = await import("@/lib/reminders/engine");
const { DEFAULT_TEMPLATES } = await import("@/lib/email/templates");

afterEach(() => vi.unstubAllEnvs());

const onSwitches = () => {
  for (const s of ["WA", "NV", "UT"]) vi.stubEnv(`${s}_LIVE_FILING_SALES`, "true");
};

describe("open state questions block sales wherever real money could be taken", () => {
  it("a sandbox deployment (no live keys allowed) may run the NV/UT sandbox journeys", () => {
    onSwitches();
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "false");
    expect(isRuleSellable(findRule("NV", "llc")!)).toBe(true);
    expect(isRuleSellable(findRule("UT", "llc")!)).toBe(true);
  });

  it("a non-production deployment allowed live keys refuses every NV/UT rule with an open question", () => {
    onSwitches();
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "true");
    for (const r of RULES.filter((x) => x.stateCode === "NV" || x.stateCode === "UT")) expect(isRuleSellable(r), r.ruleKey).toBe(false);
    // Washington has no open question: it follows its switch alone.
    expect(isRuleSellable(findRule("WA", "llc")!)).toBe(true);
    expect(isRuleSellable(findRule("PA", "llc")!)).toBe(true);
  });

  it("checkout itself also refuses live payment while an open question applies (defense in depth)", () => {
    const src = readFileSync("src/lib/filings/customer.ts", "utf8");
    expect(src).toMatch(/provider\.mode === "live" && openQuestionsFor\(loaded\.filing\.state_code/);
  });
});

describe("nonprofits are out of scope in WA, NV and UT", () => {
  it("a business marked not-for-profit is never sold there; Pennsylvania keeps its nonprofit handling", () => {
    onSwitches();
    for (const st of ["WA", "NV", "UT"]) {
      const r = findRule(st, "corporation")!;
      expect(isSellableForBusiness(r, { isNonprofit: false }), st).toBe(true);
      expect(isSellableForBusiness(r, { isNonprofit: true }), st).toBe(false);
    }
    expect(isSellableForBusiness(findRule("PA", "nonprofit_corporation")!, { isNonprofit: true })).toBe(true);
  });

  it("every server and page gate that starts a filing or checkout uses the business-aware check", () => {
    const customer = readFileSync("src/lib/filings/customer.ts", "utf8");
    expect(customer).not.toMatch(/isRuleSellable\(/);
    expect(customer.match(/isSellableForBusiness\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(readFileSync("src/app/(marketing)/find/result/page.tsx", "utf8")).toContain("isSellableForBusiness(rule, { isNonprofit: lookup.isNonprofit })");
    expect(readFileSync("src/app/(app)/file/start/page.tsx", "utf8")).toContain("isSellableForBusiness(rule, { isNonprofit: lookup.isNonprofit })");
  });
});

describe("public pages and reminders never offer paid filing where sales are off", () => {
  it("'Filing supported' only while the state's sales are open", () => {
    expect(stateSupportLabel("PA")).toBe("Filing supported");
    for (const st of ["WA", "NV", "UT"]) expect(stateSupportLabel(st)).toBe("Guide and free reminders");
    expect(stateSupportLabel("TX")).toBe("Not yet verified");
    vi.stubEnv("WA_LIVE_FILING_SALES", "true");
    expect(stateSupportLabel("WA")).toBe("Filing supported");
  });

  it("no public listing hard-codes the 'Filing supported' badge", () => {
    for (const f of [
      "src/app/(marketing)/annual-report/page.tsx",
      "src/app/(marketing)/states/page.tsx",
      "src/components/marketing/state-directory.tsx",
      "src/components/visual/us-tile-map.tsx",
    ]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/>Filing supported<|\? "Filing supported"|"filing supported"/);
    }
  });

  it("state hub and entity pages describe the filing service (JSON-LD offers, our price) only when sellable", () => {
    const hub = readFileSync("src/app/(marketing)/annual-report/[state]/page.tsx", "utf8");
    expect(hub).toMatch(/\.\.\.\(sellable\s*\?\s*\[\s*serviceJsonLd/);
    expect(hub).toContain('title={sellable ? "If we file it for you" : "What the state charges"}');
    expect(hub).toContain("sellable && exampleQuote && exampleRule");
    const entity = readFileSync("src/app/(marketing)/annual-report/[state]/[entity]/page.tsx", "utf8");
    expect(entity).toMatch(/\.\.\.\(sellable\s*\?\s*\[\s*serviceJsonLd/);
    expect(entity).toContain("quote={sellable ? quote : null}");
  });

  it("the upcoming reminder offers our filing only where we sell it", () => {
    const tpl = DEFAULT_TEMPLATES.find((t) => t.key === "reminder_upcoming")!;
    expect(tpl.body).not.toContain("prepare and submit");
    expect(tpl.body).toContain("{{filing_options}}");
    expect(filingOptionsSentence(true, "Filewell")).toContain("have Filewell prepare and submit it for you");
    expect(filingOptionsSentence(false, "Filewell")).toBe("You can file it yourself on the state's website.");
  });
});

describe("Nevada: the packet and checks use the entity's own rule", () => {
  it("a corporation's packet has its own rows, not the LLC's", () => {
    const corp = stateAuthorizationForEntity("NV", "corporation")!;
    const llc = stateAuthorizationForEntity("NV", "llc")!;
    expect(corp.rule.entityType).toBe("corporation");
    // The state-level lookup returns the first (LLC) rule, which is why it must not be used per entity.
    expect(stateAuthorizationForState("NV")!.rule.entityType).toBe("llc");
    const keys = (a: typeof corp) => buildFilingPacket(a.runbook, a.rule.intake, {}).map((r) => r.answerKey);
    expect(keys(corp)).not.toContain("llc_management");
    expect(keys(llc)).toContain("llc_management");
    expect(corp.auth.certificationText).not.toBe(llc.auth.certificationText);
  });

  it("an entity with a rule but no state authorization (Pennsylvania) gets none; unknown entity falls back to the state", () => {
    expect(stateAuthorizationForEntity("PA", "llc")).toBeNull();
    expect(stateAuthorizationForEntity("WA", null)!.rule.stateCode).toBe("WA");
  });

  it("the packet page, order page and filing checks all resolve the entity's rule", () => {
    for (const f of ["src/app/admin/filings/[id]/packet/page.tsx", "src/app/admin/filings/[id]/load.ts"]) {
      expect(readFileSync(f, "utf8"), f).toContain("stateAuthorizationForEntity(filing.state_code, business?.entity_type");
    }
    expect(readFileSync("src/lib/filings/operations.ts", "utf8")).toContain("stateAuthorizationForEntity(ctx.filing.stateCode, ctx.filing.entityType)");
  });
});

describe("a refunded state fee blocks filing", () => {
  const schema = findRule("PA", "llc")!.intake;
  it("any government-fee refund on the order stops Mark ready / Start filing / Mark submitted", () => {
    const base = {
      schema,
      answers: {},
      intakeComplete: true,
      authorizationSha256: "x".repeat(64),
      order: { status: "partially_refunded", payment_mode: "sandbox" },
      ruleVerificationStatus: "verified",
      production: false,
    };
    const refunded = readyToFileBlockers({ ...base, governmentFeeRefundedCents: 7000 });
    expect(refunded.some((b) => b.includes("state fee was refunded"))).toBe(true);
    const serviceOnly = readyToFileBlockers({ ...base, governmentFeeRefundedCents: 0 });
    expect(serviceOnly.some((b) => b.includes("state fee was refunded"))).toBe(false);
  });
});
