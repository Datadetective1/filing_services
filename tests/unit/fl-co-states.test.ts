import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateFees } from "@/lib/compliance/fees";
import { openQuestionBlockers, openQuestionsFor } from "@/lib/compliance/open-questions";
import { findRule, isRuleSellable, RULES } from "@/lib/compliance/registry";
import { formationDateRequired } from "@/lib/compliance/state-meta";
import { CO_DELIVERY_NOTICE } from "@/lib/compliance/states/colorado";
import { FL_FELONY_WARNING, FL_FORGERY_WARNING } from "@/lib/compliance/states/florida";
import { dueRuleText } from "@/lib/compliance/view";
import { currentFilingPeriod, dueDateForYear, isFilingWindowOpen } from "@/lib/domain/deadlines";
import { authorizationText, stateAuthorizationTextInput } from "@/lib/filings/customer";
import { listedPrincipal, principalSignerProblem } from "@/lib/filings/customer-signature";

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

  it("is signed by the customer as a listed principal, with Sunbiz's warnings verbatim", () => {
    const ps = llc.stateAuthorization!.customerSignature!;
    expect(ps.principalsKey).toBe("governors");
    expect(ps.warnings.map((w) => w.text)).toEqual([FL_FORGERY_WARNING, FL_FELONY_WARNING]);
    for (const w of ps.warnings) expect(llc.sources.find((s) => s.factKey === w.sourceFactKey)?.quote).toBe(w.text);
  });

  it("takes orders with its switch on and has no open question now that the customer signs", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("FL_LIVE_FILING_SALES", "true");
    expect(openQuestionsFor("FL", "llc")).toEqual([]);
    expect(openQuestionBlockers("FL", "corporation")).toEqual([]);
    for (const r of RULES.filter((x) => x.stateCode === "FL")) expect(isRuleSellable(r), r.ruleKey).toBe(true);
  });

  it("cites Florida's acceptance of conformed and electronic signatures", () => {
    expect(llc.sources.find((s) => s.factKey === "signature_forms")?.quote).toBe("any symbol, manual, facsimile, conformed, or electronic signature");
  });
});

describe("customer signature", () => {
  const auth = findRule("FL", "llc")!.stateAuthorization!;
  const values = { governors: [{ name: "Ana  Lopez", title: "Manager", address: "1 Main St" }, { name: "Ben Ode", title: "Managing Member" }] };

  it("matches the signer to a listed principal, ignoring case and spacing", () => {
    expect(listedPrincipal(auth, values, "ana lopez")).toEqual({ name: "Ana  Lopez", title: "Manager" });
    expect(listedPrincipal(auth, values, "Cara Fox")).toBeNull();
  });

  it("refuses a signer who isn't listed, or who signs with another title", () => {
    expect(principalSignerProblem(auth, values, { name: "Ana Lopez", title: "manager" })).toBeNull();
    expect(principalSignerProblem(auth, values, { name: "Cara Fox", title: "Manager" })).toMatch(/one of the people listed/);
    expect(principalSignerProblem(auth, values, { name: "Ben Ode", title: "Manager" })).toMatch(/Managing Member/);
  });

  it("does nothing for states without a customer signature, or with no people to match (Colorado)", () => {
    expect(principalSignerProblem(findRule("UT", "llc")!.stateAuthorization!, {}, { name: "X", title: "Y" })).toBeNull();
    expect(principalSignerProblem(findRule("CO", "llc")!.stateAuthorization!, {}, { name: "X", title: "Y" })).toBeNull();
  });

  it("requires Montana's signer to be one of the listed people too", () => {
    const mt = findRule("MT", "llc")!.stateAuthorization!;
    expect(principalSignerProblem(mt, values, { name: "Ben Ode", title: "Managing Member" })).toBeNull();
    expect(principalSignerProblem(mt, values, { name: "Cara Fox", title: "Member" })).toMatch(/people listed/);
  });

  const text = (state: string, stateName: string, filingName = "Annual Report") =>
    authorizationText({
      businessName: "Sun LLC",
      stateName,
      filingName,
      brand: "Filewell",
      state: stateAuthorizationTextInput(findRule(state, "llc")!.stateAuthorization!, "Filewell"),
    });

  it("has the customer sign Florida's report themselves, with the state's warnings, and Filewell never signs", () => {
    const t = text("FL", "Florida");
    expect(t).toContain("I am signing this Annual Report myself, as one of the people listed in it.");
    expect(t).toContain("I adopt them as my electronic signature on this Annual Report, with the intent to sign it.");
    expect(t).toContain("I authorize Filewell to enter my signature on the state's form exactly as I type it and to submit this Annual Report only. Filewell does not sign, certify or affirm it for me.");
    expect(t).toContain(`“${FL_FORGERY_WARNING}”`);
    expect(t).toContain("preparing and submitting the Florida Annual Report described above, using the information I provided and my own signature");
    expect(t).not.toContain("electronically signing");
    expect(t).not.toContain("permission to type");
    expect(t).not.toContain("will sign the Annual Report as the business's authorized person");
  });

  it("names the Colorado customer as the individual causing delivery, making Colorado's statement word for word", () => {
    const t = text("CO", "Colorado", "Periodic Report");
    expect(t).toContain("I am signing this Periodic Report myself.");
    expect(t).toContain("I am the individual causing this Periodic Report to be delivered for filing, and Filewell will name me as that individual, at the business's mailing address.");
    expect(t).toContain(`I make the state's statement myself: “${CO_DELIVERY_NOTICE}”`);
    expect(t).not.toContain("will sign the Periodic Report as the business's authorized person");
  });

  it("tells the Montana customer the declarations come before filing", () => {
    const t = text("MT", "Montana");
    expect(t).toContain("The state's form also asks the signer to confirm declarations. Filewell will show me their exact wording, and nothing is filed until I confirm them.");
    expect(t).not.toContain("I make the state's statement");
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

  it("takes orders with its switch on and has no open question now that the customer is the individual causing delivery", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("CO_LIVE_FILING_SALES", "true");
    expect(openQuestionsFor("CO", "llc")).toEqual([]);
    for (const r of RULES.filter((x) => x.stateCode === "CO")) expect(isRuleSellable(r), r.ruleKey).toBe(true);
  });

  it("quotes Colorado's delivery notice as the customer's own statement, from a cited source", () => {
    const auth = llc.stateAuthorization!;
    expect(auth.certificationText).toBe(CO_DELIVERY_NOTICE);
    expect(auth.customerSignature).toMatchObject({ signerIsDeliverer: true });
    expect(llc.sources.find((s) => s.factKey === auth.certificationSourceFactKey)?.quote).toBe(CO_DELIVERY_NOTICE);
    expect(llc.operatorRunbook!.steps.join(" ")).not.toMatch(/Enter your own name/);
  });
});

describe("Montana annual report signing", () => {
  it("keeps filing closed only until the declaration wording is captured", () => {
    expect(openQuestionsFor("MT", "llc").map((q) => q.key)).toEqual(["mt_declaration_text"]);
    expect(openQuestionsFor("MT", "llc")[0].blocksSales).toBe(false);
    expect(openQuestionBlockers("MT", "corporation").join(" ")).toMatch(/mt_declaration_text.*Do not file/);
    const auth = findRule("MT", "llc")!.stateAuthorization!;
    expect(auth.certificationText).toBeNull();
    expect(auth.customerSignature).toMatchObject({ principalsKey: "governors", declarationsPending: true });
  });

  it("never tells the operator to sign with their own name", () => {
    for (const r of RULES.filter((x) => ["FL", "CO", "MT"].includes(x.stateCode))) {
      expect(r.operatorRunbook!.steps.join(" "), r.ruleKey).not.toMatch(/sign with your own name as|Enter your own name and mailing address/);
      expect(r.stateAuthorization!.customerSignature, r.ruleKey).toBeDefined();
    }
  });
});
