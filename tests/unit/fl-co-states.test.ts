import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateFees } from "@/lib/compliance/fees";
import { openQuestionsFor } from "@/lib/compliance/open-questions";
import { findRule, isRuleSellable, RULES } from "@/lib/compliance/registry";
import { formationDateRequired } from "@/lib/compliance/state-meta";
import { FL_FELONY_WARNING, FL_FORGERY_WARNING } from "@/lib/compliance/states/florida";
import { dueRuleText } from "@/lib/compliance/view";
import { currentFilingPeriod, dueDateForYear, isFilingWindowOpen } from "@/lib/domain/deadlines";
import { authorizationText, stateAuthorizationTextInput } from "@/lib/filings/customer";
import { listedPrincipal, principalSignerProblem } from "@/lib/filings/principal-signature";

afterEach(() => vi.unstubAllEnvs());

describe("Florida annual report", () => {
  const llc = findRule("FL", "llc")!;
  const corp = findRule("FL", "corporation")!;

  it("covers LLCs and profit corporations with Sunbiz's fees", () => {
    expect(RULES.filter((r) => r.stateCode === "FL").map((r) => r.entityType).sort()).toEqual(["corporation", "llc"]);
    expect(llc.stateFeeCents).toBe(13875);
    expect(corp.stateFeeCents).toBe(15000);
    expect(formationDateRequired("FL")).toBe(false);
  });

  it("is due May 1, first in the year after formation", () => {
    expect(llc.dueRule).toEqual({ kind: "fixed_annual", month: 5, day: 1 });
    const p = currentFilingPeriod(llc, { today: "2027-01-02", formationDate: "2026-06-15" });
    expect(p).toMatchObject({ periodYear: 2027, dueDate: "2027-05-01", isFirstReport: true });
    expect(isFilingWindowOpen(llc, 2027, "2027-05-01", "2027-01-01")).toBe(true);
    expect(isFilingWindowOpen(llc, 2027, "2027-05-01", "2026-12-31")).toBe(false);
  });

  it("charges the $400 late fee only after May 1, never to a non-profit", () => {
    const ctx = (filingDate: string, isNonprofit = false) => ({ isNonprofit, dueDate: "2027-05-01", filingDate, status: null });
    expect(evaluateFees(llc, ctx("2027-05-01")).totalCents).toBe(13875);
    expect(evaluateFees(llc, ctx("2027-05-02")).totalCents).toBe(53875);
    expect(evaluateFees(corp, ctx("2027-06-01")).totalCents).toBe(55000);
    expect(evaluateFees(corp, ctx("2027-06-01", true)).totalCents).toBe(15000);
  });

  it("blocks registered agent and FEIN changes, and never collects the FEIN itself", () => {
    const fields = llc.intake.sections.flatMap((s) => s.fields);
    const ra = fields.find((f) => f.key === "registered_agent_change");
    const fein = fields.find((f) => f.key === "fein_status");
    expect(ra?.type === "choice" && ra.blocked?.map((b) => b.value)).toEqual(["new"]);
    expect(fein?.type === "choice" && fein.blocked?.map((b) => b.value)).toEqual(["change"]);
    expect(fields.some((f) => /fein_number|ein_number/.test(f.key))).toBe(false);
  });

  it("needs a listed principal's own signature, with Sunbiz's warnings verbatim", () => {
    const ps = llc.stateAuthorization!.principalSignature!;
    expect(ps.principalsKey).toBe("governors");
    expect(ps.warnings.map((w) => w.text)).toEqual([FL_FORGERY_WARNING, FL_FELONY_WARNING]);
    for (const w of ps.warnings) expect(llc.sources.find((s) => s.factKey === w.sourceFactKey)?.quote).toBe(w.text);
  });

  it("stays closed for sale until counsel answers the signer question", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("FL_LIVE_FILING_SALES", "true");
    expect(openQuestionsFor("FL", "llc").map((q) => q.key)).toEqual(["fl_signer_permission"]);
    for (const r of RULES.filter((x) => x.stateCode === "FL")) expect(isRuleSellable(r), r.ruleKey).toBe(false);
  });
});

describe("principal signature", () => {
  const auth = findRule("FL", "llc")!.stateAuthorization!;
  const values = { governors: [{ name: "Ana  Lopez", title: "Manager", address: "1 Main St" }, { name: "Ben Ode", title: "Managing Member" }] };

  it("matches the signer to a listed principal, ignoring case and spacing", () => {
    expect(listedPrincipal(auth, values, "ana lopez")).toEqual({ name: "Ana  Lopez", title: "Manager" });
    expect(listedPrincipal(auth, values, "Cara Fox")).toBeNull();
  });

  it("refuses a signer who isn't listed, or who signs with another title", () => {
    expect(principalSignerProblem(auth, values, { name: "Ana Lopez", title: "manager" })).toBeNull();
    expect(principalSignerProblem(auth, values, { name: "Cara Fox", title: "Manager" })).toMatch(/one of the principals/);
    expect(principalSignerProblem(auth, values, { name: "Ben Ode", title: "Manager" })).toMatch(/Managing Member/);
  });

  it("does nothing for states without a principal signature", () => {
    expect(principalSignerProblem(findRule("UT", "llc")!.stateAuthorization!, {}, { name: "X", title: "Y" })).toBeNull();
  });

  it("puts the permission and the state's warnings in the signed text, not a certification by the agent", () => {
    const t = authorizationText({
      businessName: "Sun LLC",
      stateName: "Florida",
      filingName: "Annual Report",
      brand: "Filewell",
      state: stateAuthorizationTextInput(auth, "Filewell"),
    });
    expect(t).toContain("I give Filewell permission to type my name and title, exactly as I sign below, as my electronic signature on this Annual Report only.");
    expect(t).toContain(`“${FL_FORGERY_WARNING}”`);
    expect(t).not.toContain("will sign the Annual Report as the business's authorized person");
  });
});

describe("Colorado Periodic Report", () => {
  const llc = findRule("CO", "llc")!;

  it("costs $25, with a $50 penalty after the due date", () => {
    expect(llc.stateFeeCents).toBe(2500);
    const ctx = (filingDate: string) => ({ isNonprofit: false, dueDate: "2027-03-31", filingDate, status: null });
    expect(evaluateFees(llc, ctx("2027-03-31")).totalCents).toBe(2500);
    expect(evaluateFees(llc, ctx("2027-04-01")).totalCents).toBe(7500);
  });

  it("is due the last day of the second month after the report month", () => {
    expect(formationDateRequired("CO")).toBe(true);
    expect(dueDateForYear(llc.dueRule, 2027, "2020-01-10")).toBe("2027-03-31");
    expect(dueDateForYear(llc.dueRule, 2027, "2020-12-03")).toBe("2028-02-29");
    expect(dueDateForYear(llc.dueRule, 2026, "2020-11-20")).toBe("2027-01-31");
    expect(dueRuleText(llc.dueRule)).toMatch(/second month after/);
  });

  it("keeps last year's report current while its due date carries into this January", () => {
    const p = currentFilingPeriod(llc, { today: "2027-01-15", formationDate: "2020-11-20" });
    expect(p).toMatchObject({ periodYear: 2026, dueDate: "2027-01-31", phase: "due_soon" });
    const late = currentFilingPeriod(llc, { today: "2027-02-05", formationDate: "2020-11-20" });
    expect(late).toMatchObject({ periodYear: 2026, phase: "overdue" });
    const filed = currentFilingPeriod(llc, { today: "2027-01-15", formationDate: "2020-11-20", lastFiledYear: 2026 });
    expect(filed).toMatchObject({ periodYear: 2027, dueDate: "2028-01-31" });
  });

  it("opens about five months before the due date", () => {
    expect(isFilingWindowOpen(llc, 2026, "2027-03-31", "2026-11-01")).toBe(true);
    expect(isFilingWindowOpen(llc, 2026, "2027-03-31", "2026-10-31")).toBe(false);
  });

  it("stays closed for sale until counsel answers the delivery question", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("CO_LIVE_FILING_SALES", "true");
    expect(openQuestionsFor("CO", "llc").map((q) => q.key)).toEqual(["co_delivery_affirmation"]);
    for (const r of RULES.filter((x) => x.stateCode === "CO")) expect(isRuleSellable(r), r.ruleKey).toBe(false);
  });
});
