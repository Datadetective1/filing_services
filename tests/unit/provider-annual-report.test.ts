import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Annual reports in the states Filewell doesn't file itself, filed by Registered Agents Inc.:
 * every fee has an official source, a state opens only with its switch and a fixed fee, the
 * self-filed states never route to the provider, and the operator sees "Send to RAI".
 */

vi.mock("server-only", () => ({}));
const { PROVIDER_REPORT_FACTS } = await import("@/lib/registered-agent/provider-report-facts");
const { providerReportFeeCents, providerReportOpenStates, providerReportSaleCheck, SELF_FILED_REPORT_STATES } = await import(
  "@/lib/registered-agent/provider-report"
);
const { providerAnnualReportQuote, QuoteError } = await import("@/lib/services/quote");
const { validateProviderReportInput } = await import("@/lib/services/provider-report");
const { providerEntrySheet } = await import("@/lib/registered-agent/manual-provider");
const { nextOperatorAction, PROVIDER_ORDER_KINDS, transitionProblem } = await import("@/lib/registered-agent/status");
const { SERVICES } = await import("@/lib/services/catalog");
const { proposedPriceEstimates } = await import("@/lib/services/economics");

afterEach(() => vi.unstubAllEnvs());

const LIVE_GATES = {
  PAYMENTS_LIVE_ENABLED: "true",
  RA_PROVIDER_AGREEMENT_SIGNED: "true",
  NEXT_PUBLIC_LEGAL_ENTITY: "Harborlune LLC",
  RA_ALERTS_MAILBOX: "support@getfilewell.com",
  RA_FULFILLMENT_TESTED: "true",
};

describe("annual report facts", () => {
  it("never covers a state Filewell files itself", () => {
    for (const code of SELF_FILED_REPORT_STATES) expect(PROVIDER_REPORT_FACTS[code], code).toBeUndefined();
  });

  it("backs every fee with an official https source, quoted and dated", () => {
    for (const [code, f] of Object.entries(PROVIDER_REPORT_FACTS)) {
      for (const t of ["llc", "corporation"] as const) {
        const e = f[t];
        if (e.feeCents === null) {
          expect(e.whyNotFixed, `${code} ${t}`).toBeTruthy();
          continue;
        }
        expect(Number.isInteger(e.feeCents) && e.feeCents >= 0, `${code} ${t}`).toBe(true);
        expect(e.required, `${code} ${t}`).toBe(true);
        expect(f.sources.length, code).toBeGreaterThan(0);
      }
      for (const s of f.sources) {
        expect(s.url, code).toMatch(/^https:\/\//);
        expect(s.quote.trim().length, code).toBeGreaterThan(0);
        expect(s.checkedAt, code).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("keeps a report that comes with a tax or a varying fee closed", () => {
    expect(providerReportFeeCents("DE", "corporation")).toBeNull(); // franchise tax
    expect(providerReportFeeCents("TX", "llc")).toBeNull(); // franchise tax report, no SOS report
    expect(providerReportFeeCents("TN", "llc")).toBeNull(); // per-member fee
    expect(providerReportFeeCents("WY", "llc")).toBeNull(); // license tax on assets
    expect(providerReportFeeCents("LA", "llc")).toBeNull(); // card convenience fee
  });

  it("has the fixed fees checked on November 3", () => {
    expect(providerReportFeeCents("KY", "llc")).toBe(1500);
    expect(providerReportFeeCents("CT", "corporation")).toBe(15000);
    expect(providerReportFeeCents("MN", "llc")).toBe(0);
    expect(providerReportFeeCents("WA", "corporation")).toBe(7000);
  });
});

describe("which states sell", () => {
  it("opens nothing without a switch", () => {
    for (const [k, v] of Object.entries(LIVE_GATES)) vi.stubEnv(k, v);
    expect(providerReportOpenStates()).toEqual([]);
  });

  it("opens one state on its own switch, only for entity types with a fixed fee", () => {
    for (const [k, v] of Object.entries(LIVE_GATES)) vi.stubEnv(k, v);
    vi.stubEnv("RAI_REPORT_SALES_IL", "true");
    const open = providerReportOpenStates();
    expect(open.map((s) => s.code)).toEqual(["IL"]);
    expect(open[0].feeCents).toEqual({ llc: 7500 });
    expect(providerReportSaleCheck("IL", "corporation").ok).toBe(false);
  });

  it("never sends a self-filed state to the provider, even with ALL on", () => {
    vi.stubEnv("RAI_REPORT_SALES_ALL", "true");
    for (const code of SELF_FILED_REPORT_STATES) {
      const r = providerReportSaleCheck(code, "llc");
      expect(r.ok, code).toBe(false);
      expect(r.reason, code).toMatch(/ourselves/);
    }
  });

  it("stays closed for real money until the nationwide gates pass", () => {
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "true");
    vi.stubEnv("RAI_REPORT_SALES_KY", "true");
    expect(providerReportSaleCheck("KY", "llc").ok).toBe(false);
  });

  it("sells in test mode with the switch, so the flow can be tried end to end", () => {
    vi.stubEnv("RAI_REPORT_SALES_KY", "true");
    expect(providerReportSaleCheck("KY", "llc")).toEqual({ ok: true, reason: null });
  });
});

describe("quote", () => {
  const price = { id: "p1", serviceFeeCents: 9900, approved: true };

  it("shows our $99 and the state fee on separate lines, nothing recurring", () => {
    const q = providerAnnualReportQuote({ stateName: "Kentucky", reportName: "Annual report", reportPrice: price, reportGovernmentFeeCents: 1500 });
    expect(q.lines.map((l) => [l.kind, l.amountCents])).toEqual([
      ["service_fee", 9900],
      ["government_fee", 1500],
    ]);
    expect(q.dueTodayCents).toBe(11400);
    expect(q.renewal).toBeNull();
    expect(q.lines[1].description).toBe("Kentucky annual report fee, paid to the state");
  });

  it("leaves out a $0 state fee line", () => {
    const q = providerAnnualReportQuote({ stateName: "Minnesota", reportName: "Annual renewal", reportPrice: price, reportGovernmentFeeCents: 0 });
    expect(q.lines).toHaveLength(1);
    expect(q.dueTodayCents).toBe(9900);
  });

  it("refuses an unverified fee", () => {
    expect(() => providerAnnualReportQuote({ stateName: "Texas", reportName: "Annual report", reportPrice: price, reportGovernmentFeeCents: null })).toThrow(QuoteError);
  });

  it("keeps $24 a report before card fees", () => {
    expect(SERVICES.provider_annual_report.proposedServiceFeeCents).toBe(9900);
    const row = proposedPriceEstimates().find((r) => r.serviceCode === "provider_annual_report")!;
    expect(row.serviceFeeCents - row.wholesaleCents).toBe(2400);
    expect(row.contributionCents).toBeLessThan(2400); // the card fee comes out of it
  });
});

describe("order details", () => {
  const good = {
    stateCode: "ky",
    entityType: "llc",
    formedHere: "yes",
    pastDue: "no",
    businessName: "Acme  Widgets LLC",
    entityNumber: "0123456",
    principalAddress: "1 Main St, Louisville, KY 40202",
    people: "Jo Smith, 1 Main St, Louisville, KY 40202",
    contactName: "Jo Smith",
    contactPhone: "(502) 555-0100",
    acceptedTerms: "on",
  };

  it("accepts what the report needs", () => {
    const r = validateProviderReportInput(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ stateCode: "KY", businessName: "Acme Widgets LLC", entityNumber: "0123456", changes: null });
  });

  it("sends a late report to support for a quote", () => {
    const r = validateProviderReportInput({ ...good, pastDue: "yes" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/email/i);
  });

  it("refuses a business formed in another state, a PO box and a missing terms tick", () => {
    expect(validateProviderReportInput({ ...good, formedHere: "no" }).ok).toBe(false);
    expect(validateProviderReportInput({ ...good, principalAddress: "PO Box 12, Louisville, KY" }).ok).toBe(false);
    expect(validateProviderReportInput({ ...good, acceptedTerms: undefined }).ok).toBe(false);
  });
});

describe("operator side", () => {
  it("is a provider order kind with its own Send to RAI step, completed with evidence", () => {
    expect(PROVIDER_ORDER_KINDS).toContain("annual_report");
    expect(nextOperatorAction("annual_report", "ready_for_provider")).toMatch(/^Send to RAI/);
    expect(transitionProblem("annual_report", "processing", "active", { confirmedOn: "2026-11-03", evidence: "x" })).toMatch(/completed/);
    expect(transitionProblem("annual_report", "processing", "completed", {})).toBeTruthy();
    expect(transitionProblem("annual_report", "processing", "completed", { confirmedOn: "2026-11-03", evidence: "State record" })).toBeNull();
  });

  it("puts everything RAI needs on the entry sheet and flags what's missing", () => {
    const base = {
      kind: "annual_report" as const,
      legalName: "Acme Widgets LLC",
      stateName: "Kentucky",
      entityTypeLabel: "LLC",
      entityNumber: "0123456",
      contactName: "Jo Smith",
      contactPhone: "(502) 555-0100",
      contactAddress: "1 Main St, Louisville, KY 40202",
      currentAgentName: null,
    };
    const full = providerEntrySheet({ ...base, details: { report_name: "Annual report", principal_address: "1 Main St", people: "Jo Smith" } });
    expect(full.missing).toEqual([]);
    expect(full.rows.map((r) => r.label)).toEqual(expect.arrayContaining(["Report", "Members or managers to list", "Changes since the last report"]));
    const thin = providerEntrySheet({ ...base, details: { report_name: "Annual report" } });
    expect(thin.missing).toEqual(["Principal address", "Members or managers to list"]);
  });
});
