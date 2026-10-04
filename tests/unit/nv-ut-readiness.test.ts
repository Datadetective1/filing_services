import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateFees, quoteGovernmentLines } from "@/lib/compliance/fees";
import { OPEN_QUESTIONS, openQuestionBlockers, openQuestionsFor } from "@/lib/compliance/open-questions";
import { findRule, isRuleSellable, RULES, stateAuthorizationForState } from "@/lib/compliance/registry";
import { buildQuote } from "@/lib/domain/pricing";
import { buildFilingPacket, packetSections } from "@/lib/filings/packet";
import { validateAll } from "@/lib/intake/validate";

vi.mock("server-only", () => ({}));
const { authorizationText } = await import("@/lib/filings/customer");
const { readyToFileBlockers } = await import("@/lib/filings/operations");

afterEach(() => vi.unstubAllEnvs());

const addr = (region: string) => ({ line1: "1 Main St", city: "Reno", region, postal_code: "89501" });

function nvAnswers(over: Record<string, unknown> = {}) {
  return {
    legal_name: "Sierra Test LLC",
    entity_number: "E1234567",
    jurisdiction_of_formation: "Nevada",
    sbl_exemption: "no",
    governors: [{ name: "Robin Hale", title: "Manager", address: "1 Main St, Reno, NV 89501" }],
    llc_management: "manager",
    nv_trade_investigations: "no",
    nv_market_share: "no",
    principal_office: addr("NV"),
    changes_since_last_report: "no",
    state_notice_email: "",
    ...over,
  };
}

describe("Nevada v2 follows the 7/1/2026 annual list form", () => {
  const llc = findRule("NV", "llc")!;
  const llp = findRule("NV", "llp")!;

  it("is version 2 and quotes the statute's certification and declaration for each entity type", () => {
    for (const t of ["llc", "corporation", "lp", "llp"] as const) {
      const r = findRule("NV", t)!;
      expect(r.version).toBe(2);
      expect(r.stateAuthorization?.certificationText).toMatch(/certifying that the list is true, complete and accurate/i);
      expect(r.stateAuthorization?.certificationText).toContain("declaration under penalty of perjury");
      expect(r.stateAuthorization?.certificationText).toContain("category C felony");
      expect(r.stateAuthorization?.operatorCheckpoint).toBe(true);
      expect(r.sources.map((s) => s.factKey)).toEqual(expect.arrayContaining(["certification", "license_signer", "investigation_disclosure"]));
    }
    expect(findRule("NV", "corporation")!.stateAuthorization!.certificationText).toContain("officers or directors");
    expect(findRule("NV", "llp")!.stateAuthorization!.certificationText).toContain("managing partners");
  });

  it("a complete LLC answer set is valid; the business location must be in Nevada", () => {
    expect(validateAll(llc.intake, nvAnswers()).ok).toBe(true);
    expect(validateAll(llc.intake, nvAnswers({ principal_office: addr("CA") })).ok).toBe(false);
  });

  it("both disclosure answers Yes ($100,000 fee) is blocked; one Yes is fine", () => {
    const both = validateAll(llc.intake, nvAnswers({ nv_trade_investigations: "yes", nv_market_share: "yes" }));
    expect(both.ok).toBe(false);
    expect(both.errors.nv_market_share).toMatch(/\$100,000/);
    expect(validateAll(llc.intake, nvAnswers({ nv_trade_investigations: "yes" })).ok).toBe(true);
    expect(validateAll(llc.intake, nvAnswers({ nv_market_share: "yes" })).ok).toBe(true);
  });

  it("business-license-exempt entities are blocked (their fee differs)", () => {
    expect(validateAll(llc.intake, nvAnswers({ sbl_exemption: "yes" })).errors.sbl_exemption).toMatch(/exempt/);
  });

  it("LLPs aren't asked the disclosure (the form asks LLCs, LPs/LLLPs and corporations)", () => {
    const keys = llp.intake.sections.flatMap((s) => s.fields.map((f) => f.key));
    expect(keys).not.toContain("nv_trade_investigations");
  });

  it("packet follows the form's order", () => {
    const rows = buildFilingPacket(stateAuthorizationForState("NV")!.runbook, llc.intake, validateAll(llc.intake, nvAnswers()).values);
    expect(packetSections(rows).map((s) => s.section)).toEqual([
      "Type of filing",
      "State Business License",
      "Name of entity",
      "Optional business information",
      "Business location",
      "Investigation disclosure",
      "Entity management",
      "Contact",
      "Declaration and signature",
    ]);
  });
});

describe("Utah v2", () => {
  it("is version 2 with a packet-confirmation step but no invented certification wording", () => {
    const r = findRule("UT", "llc")!;
    expect(r.version).toBe(2);
    expect(r.stateAuthorization?.certificationText).toBeNull();
    const t = authorizationText({
      businessName: "Wasatch Test LLC",
      stateName: "Utah",
      filingName: "Annual Report/Renewal",
      brand: "Filewell",
      state: { filingAgent: "Amary Coulibaly, sole proprietor", certificationText: null },
    });
    expect(t).toContain("will make the attestations the state's form requires");
    expect(t).not.toContain("“");
  });

  it("packet follows the Division's renewal screens", () => {
    const r = findRule("UT", "llc")!;
    const rows = buildFilingPacket(stateAuthorizationForState("UT")!.runbook, r.intake, {});
    expect(packetSections(rows).map((s) => s.section)).toEqual([
      "Entity search",
      "Purpose statement",
      "Principal office",
      "Registered agent",
      "Principal information",
      "Supporting documentation",
      "Signature",
    ]);
  });

  it("the $10 late fee is never charged from a date: only when Utah's own record shows it", () => {
    const r = findRule("UT", "llc")!;
    const late = evaluateFees(r, { isNonprofit: false, dueDate: "2026-10-31", filingDate: "2026-12-20", status: null });
    expect(late.totalCents).toBe(1800);
    expect(late.due.some((l) => l.kind === "government_late_fee")).toBe(false);
  });
});

describe("fail closed on unresolved state questions", () => {
  it("lists exactly the Nevada and Utah questions; Washington and Pennsylvania have none", () => {
    expect(OPEN_QUESTIONS.map((q) => q.key).sort()).toEqual(["nv_orion_client_access", "nv_signer_authority", "ut_sb40_operations", "ut_third_party_filing"]);
    expect(openQuestionsFor("WA", "llc")).toEqual([]);
    expect(openQuestionsFor("PA", "llc")).toEqual([]);
    expect(openQuestionsFor("NV", "llc").map((q) => q.key)).toEqual(["nv_signer_authority", "nv_orion_client_access"]);
    expect(openQuestionsFor("NV", "corporation").map((q) => q.key)).toEqual(["nv_orion_client_access"]);
  });

  it("production checkout refuses NV and UT even if their switch is on; WA opens with its switch", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("WA_LIVE_FILING_SALES", "true");
    vi.stubEnv("NV_LIVE_FILING_SALES", "true");
    vi.stubEnv("UT_LIVE_FILING_SALES", "true");
    expect(isRuleSellable(findRule("WA", "llc")!)).toBe(true);
    for (const r of RULES.filter((x) => x.stateCode === "NV" || x.stateCode === "UT")) expect(isRuleSellable(r), r.ruleKey).toBe(false);
    expect(isRuleSellable(findRule("PA", "llc")!)).toBe(true);
  });

  it("with the switches off (production today) no expansion state is sellable", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    for (const r of RULES.filter((x) => x.stateCode !== "PA")) expect(isRuleSellable(r), r.ruleKey).toBe(false);
  });

  it("filing is blocked anywhere while a question is open", () => {
    const b = readyToFileBlockers({
      schema: findRule("NV", "llc")!.intake,
      answers: nvAnswers(),
      intakeComplete: true,
      authorizationSha256: null,
      order: { status: "paid", payment_mode: "live" },
      ruleVerificationStatus: "verified",
      production: false,
      openQuestions: openQuestionBlockers("NV", "llc"),
    });
    expect(b.filter((x) => x.startsWith("Unresolved state question"))).toHaveLength(2);
    expect(openQuestionBlockers("WA", "llc")).toEqual([]);
  });
});

describe("cross-state isolation", () => {
  const base = { isNonprofit: false, dueDate: "2026-10-31", filingDate: "2026-10-10", status: null };

  it("each state's rules carry only that state's fees and late-fee rules", () => {
    const expected: Record<string, number> = { WA: 7000, UT: 1800 };
    for (const r of RULES) {
      expect(r.ruleKey.startsWith(`${r.stateCode}:`)).toBe(true);
      const e = evaluateFees(r, base);
      if (expected[r.stateCode]) expect(e.totalCents, r.ruleKey).toBe(expected[r.stateCode]);
      for (const l of r.lateFees ?? []) {
        if (r.stateCode === "WA") expect(l.trigger).toEqual({ kind: "state_status", statuses: ["Delinquent"] });
        if (r.stateCode === "UT") expect(l.trigger).toEqual({ kind: "state_status", statuses: ["Delinquent"] });
        if (r.stateCode === "NV") expect(l.trigger.kind).toBe("filed_after_due_date");
      }
      if (r.stateCode === "PA") expect(r.lateFees ?? []).toEqual([]);
    }
    expect(evaluateFees(findRule("NV", "llc")!, base).totalCents).toBe(35000);
    expect(evaluateFees(findRule("NV", "corporation")!, base).totalCents).toBe(65000);
  });

  it("late charges need state-specific evidence: status for WA/UT, the statute's date rule for NV, none for PA", () => {
    const late = { ...base, filingDate: "2026-11-20" };
    expect(evaluateFees(findRule("WA", "llc")!, late).totalCents).toBe(7000);
    expect(evaluateFees(findRule("UT", "llc")!, late).totalCents).toBe(1800);
    expect(evaluateFees(findRule("NV", "llc")!, late).totalCents).toBe(35000 + 7500 + 10000);
    const pa = findRule("PA", "llc")!;
    expect(evaluateFees(pa, late).totalCents).toBe(pa.stateFeeCents);
  });

  it("the service fee stays a separate line from government fees in every state", () => {
    for (const st of ["PA", "WA", "NV", "UT"]) {
      const rule = findRule(st, "llc")!;
      const e = evaluateFees(rule, base);
      const g = quoteGovernmentLines(e);
      const q = buildQuote({
        stateName: st,
        filingName: rule.filingName,
        governmentFeeCents: e.totalCents,
        governmentLines: g.lines,
        price: { id: "p", filingTypeCode: "annual_report", stateCode: st, entityType: null, serviceFeeCents: 4900, approved: true, active: true },
      });
      expect(q.serviceFeeCents).toBe(4900);
      expect(q.governmentFeeCents).toBe(e.totalCents);
      expect(q.totalCents).toBe(e.totalCents + 4900);
      expect(q.lineItems.filter((l) => l.kind === "service_fee")).toHaveLength(1);
      expect(q.lineItems.filter((l) => l.kind !== "service_fee").reduce((n, l) => n + l.amountCents, 0)).toBe(e.totalCents);
    }
  });
});
