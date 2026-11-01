import { describe, expect, it } from "vitest";
import {
  ANNUAL_REPORT_PROPOSED_FEE_CENTS,
  ANNUAL_REPORT_PROPOSED_VARIANT,
  bundleSavingsCents,
  CROSS_SELL,
  SERVICES,
  SERVICE_CODES,
  WHOLESALE,
} from "@/lib/services/catalog";
import {
  allocateProcessingFee,
  changeOfAgentAbsorbedCents,
  contribution,
  economicsFromLines,
  estimateContribution,
  estimateProcessingFeeCents,
  proposedPriceEstimates,
  sumEconomics,
  type EconomicsLine,
} from "@/lib/services/economics";
import { bundleQuote, dollars, formationQuote, QuoteError, registeredAgentQuote } from "@/lib/services/quote";
import { addOneYear, includedRequirement, overdueBeforeBundle, plannedBundleReport, shouldRequestAuthorization, type RequirementLike } from "@/lib/services/bundle";

/**
 * Business services pricing: the catalog carries the approved proposal, quotes show every
 * charge on its own line and never add what the customer didn't pick, and the economics
 * keep government fees out of revenue.
 */

const price = (id: string, cents: number, approved = false) => ({ id, serviceFeeCents: cents, approved });

describe("catalog", () => {
  it("carries the approved proposal without changing the live annual report price", () => {
    expect(SERVICES.registered_agent.proposedServiceFeeCents).toBe(11900);
    expect(SERVICES.ra_annual_report_bundle.proposedServiceFeeCents).toBe(16900);
    expect(SERVICES.formation.proposedServiceFeeCents).toBe(9900);
    expect(SERVICES.change_registered_agent.proposedServiceFeeCents).toBe(0);
    expect(SERVICES.annual_report.proposedServiceFeeCents).toBe(4900);
    expect(SERVICES.annual_report.launchStatus).toBe("live");
    expect(ANNUAL_REPORT_PROPOSED_FEE_CENTS).toBe(7900);
    expect(ANNUAL_REPORT_PROPOSED_VARIANT).toBe("proposed_79");
  });

  it("uses the wholesale rates as quoted", () => {
    expect(WHOLESALE.registeredAgentPerYear).toBe(4500);
    expect(WHOLESALE.formation).toBe(7500);
    expect(WHOLESALE.annualReport).toBe(7500);
    expect(WHOLESALE.changeOfAgent).toBe(2500);
  });

  it("keeps services outside the agreement or unpriced switched off", () => {
    for (const code of ["amendment", "good_standing_certificate", "reinstatement", "ein_assistance"] as const) {
      expect(SERVICES[code].launchStatus).toBe("not_offered");
      expect(SERVICES[code].proposedServiceFeeCents).toBeNull();
    }
    expect(SERVICES.registered_agent.launchStatus).toBe("built_not_launched");
  });

  it("shows the bundle saving against both services at proposed prices", () => {
    expect(bundleSavingsCents()).toBe(11900 + 7900 - 16900);
  });

  it("cross-sells only related services", () => {
    for (const [from, to] of Object.entries(CROSS_SELL)) {
      expect(SERVICE_CODES).toContain(from);
      for (const t of to ?? []) expect(t).not.toBe(from);
    }
    expect(CROSS_SELL.formation).toEqual(["registered_agent"]);
  });
});

describe("registered agent quote", () => {
  it("new entity: one yearly line, renews at the same price, nothing else added", () => {
    const q = registeredAgentQuote({ stateName: "Texas", situation: "new_entity", agentPrice: price("ra", 11900) });
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]).toMatchObject({ billing: "annual", amountCents: 11900, addOn: false });
    expect(q.dueTodayCents).toBe(11900);
    expect(q.governmentFeeCents).toBe(0);
    expect(q.renewal?.amountCents).toBe(11900);
    expect(q.disclosures.join(" ")).toMatch(/Renews every year/);
  });

  it("switching: shows the service, the included change filing and the state fee separately", () => {
    const q = registeredAgentQuote({
      stateName: "Colorado",
      situation: "switching",
      agentPrice: price("ra", 11900, true),
      changePrice: price("chg", 0, true),
      changeGovernmentFeeCents: 1000,
    });
    expect(q.lines.map((l) => [l.kind, l.serviceCode, l.amountCents])).toEqual([
      ["service_fee", "registered_agent", 11900],
      ["service_fee", "change_registered_agent", 0],
      ["government_fee", "change_registered_agent", 1000],
    ]);
    expect(q.lines[1].description).toMatch(/included/);
    expect(q.serviceFeeCents).toBe(11900);
    expect(q.governmentFeeCents).toBe(1000);
    expect(q.dueTodayCents).toBe(12900);
    expect(q.renewal?.amountCents).toBe(11900);
    expect(q.pricesApproved).toBe(true);
    expect(q.priceIds).toEqual(["ra", "chg"]);
  });

  it("refuses to guess an unverified state fee", () => {
    expect(() =>
      registeredAgentQuote({ stateName: "Ohio", situation: "switching", agentPrice: price("ra", 11900), changePrice: price("chg", 0), changeGovernmentFeeCents: null }),
    ).toThrow(QuoteError);
  });

  it("reports unapproved prices so live checkout can refuse them", () => {
    const q = registeredAgentQuote({ stateName: "Texas", situation: "switching", agentPrice: price("ra", 11900, true), changePrice: price("chg", 0, false), changeGovernmentFeeCents: 1500 });
    expect(q.pricesApproved).toBe(false);
  });

  it("rejects negative or fractional amounts", () => {
    expect(() => registeredAgentQuote({ stateName: "Texas", situation: "new_entity", agentPrice: price("ra", -1) })).toThrow(QuoteError);
    expect(() => registeredAgentQuote({ stateName: "Texas", situation: "new_entity", agentPrice: price("ra", 1.5) })).toThrow(QuoteError);
  });
});

describe("bundle quote", () => {
  it("charges $169 today and never the annual report state fee", () => {
    const q = bundleQuote({ stateName: "Florida", situation: "new_entity", bundlePrice: price("b", 16900), includedReportingYear: 2027, annualReportStateFeeCents: 13875 });
    expect(q.dueTodayCents).toBe(16900);
    expect(q.governmentFeeCents).toBe(0);
    expect(q.lines[0].serviceCode).toBe("ra_annual_report_bundle");
    expect(q.disclosures.join(" ")).toMatch(/not charged today/);
    expect(q.disclosures.join(" ")).toContain("$138.75");
  });

  it("names a past due report it doesn't cover", () => {
    const base = { stateName: "Florida", situation: "new_entity" as const, bundlePrice: price("b", 16900), includedReportingYear: 2027, annualReportStateFeeCents: 13875 };
    expect(bundleQuote(base).disclosures.join(" ")).not.toMatch(/past due/);
    expect(bundleQuote({ ...base, notCoveredReportingYears: [2026] }).disclosures.join(" ")).toContain("The 2026 annual report is past due and not part of this plan.");
    expect(bundleQuote({ ...base, notCoveredReportingYears: [2025, 2026] }).disclosures.join(" ")).toContain("The 2025 and 2026 annual reports are past due");
  });

  it("can't be sold when no report falls due in the first year", () => {
    expect(() => bundleQuote({ stateName: "Florida", situation: "new_entity", bundlePrice: price("b", 16900), includedReportingYear: null, annualReportStateFeeCents: 13875 })).toThrow(
      /can't be sold/,
    );
  });
});

describe("formation quote", () => {
  it("never includes registered agent service unless chosen", () => {
    const q = formationQuote({ stateName: "Texas", formationPrice: price("f", 9900), formationGovernmentFeeCents: 30000 });
    expect(q.lines.map((l) => l.serviceCode)).toEqual(["formation", "formation"]);
    expect(q.renewal).toBeNull();
    expect(q.dueTodayCents).toBe(39900);
  });

  it("adds the agent as a marked optional add-on that renews", () => {
    const q = formationQuote({ stateName: "Texas", formationPrice: price("f", 9900), formationGovernmentFeeCents: 30000, registeredAgentAddOn: price("ra", 11900) });
    const addOn = q.lines.find((l) => l.addOn);
    expect(addOn).toMatchObject({ serviceCode: "registered_agent", billing: "annual", amountCents: 11900 });
    expect(q.renewal?.amountCents).toBe(11900);
    expect(q.dueTodayCents).toBe(9900 + 30000 + 11900);
  });

  it("refuses an unverified formation fee", () => {
    expect(() => formationQuote({ stateName: "Ohio", formationPrice: price("f", 9900), formationGovernmentFeeCents: null })).toThrow(QuoteError);
  });

  it("formats dollars without stray cents", () => {
    expect(dollars(11900)).toBe("$119");
    expect(dollars(13875)).toBe("$138.75");
  });
});

describe("unit economics", () => {
  it("registered agent at $119 contributes $70.25 with an estimated card fee", () => {
    expect(estimateProcessingFeeCents(11900)).toBe(375);
    const e = estimateContribution({ serviceCode: "registered_agent", label: "x", serviceFeeCents: 11900 });
    expect(e.wholesaleCents).toBe(4500);
    expect(e.contributionCents).toBe(7025);
  });

  it("the switch promotion carries the absorbed $25 as acquisition cost", () => {
    const e = proposedPriceEstimates().find((x) => x.serviceCode === "change_registered_agent")!;
    expect(e.acquisitionCents).toBe(2500);
    expect(e.contributionCents).toBe(11900 - 4500 - 2500 - e.processingFeeCents);
  });

  it("never counts government fees as revenue", () => {
    const line: EconomicsLine = {
      serviceCode: "change_registered_agent",
      fulfillmentMethod: "registered_agents_inc",
      serviceRevenueCents: 0,
      governmentFeesCollectedCents: 1000,
      governmentFeesRemittedCents: 1000,
      wholesaleCostCents: 0,
      acquisitionCostCents: 2500,
      processingFeeCents: 59,
      processingFeeSource: "actual",
      serviceRefundsCents: 0,
      governmentRefundsCents: 0,
      taxCollectedCents: 0,
    };
    const r = contribution(line);
    expect(r.netServiceRevenueCents).toBe(0);
    expect(r.contributionCents).toBe(-2559);
    expect(r.contributionMarginPct).toBeNull();
    expect(r.governmentFeeBalanceCents).toBe(0);
    const sum = sumEconomics([line, { ...line, processingFeeSource: "estimated", governmentFeesRemittedCents: 0 }]);
    expect(sum.lines).toBe(2);
    expect(sum.estimatedFeeLines).toBe(1);
    expect(sum.governmentFeeBalanceCents).toBe(1000);
  });

  it("splits one order into rows per service with wholesale and absorbed cost", () => {
    const rows = economicsFromLines(
      [
        { kind: "service_fee", serviceCode: "registered_agent", amountCents: 11900 },
        { kind: "service_fee", serviceCode: "change_registered_agent", amountCents: 0 },
        { kind: "government_fee", serviceCode: "change_registered_agent", amountCents: 1000 },
      ],
      { absorbedChangeCents: 2500 },
    );
    expect(rows).toEqual([
      expect.objectContaining({ serviceCode: "registered_agent", serviceRevenueCents: 11900, wholesaleCostCents: 4500, acquisitionCostCents: 0, governmentFeesCollectedCents: 0 }),
      expect.objectContaining({ serviceCode: "change_registered_agent", serviceRevenueCents: 0, wholesaleCostCents: 0, acquisitionCostCents: 2500, governmentFeesCollectedCents: 1000 }),
    ]);
  });

  it("allocates a processing fee in proportion and to the exact cent", () => {
    const drafts = economicsFromLines(
      [
        { kind: "service_fee", serviceCode: "registered_agent", amountCents: 11900 },
        { kind: "government_fee", serviceCode: "change_registered_agent", amountCents: 1000 },
      ],
      { absorbedChangeCents: 2500 },
    );
    const parts = allocateProcessingFee(drafts, 404);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(404);
    expect(parts[0]).toBeGreaterThan(parts[1]);
    expect(allocateProcessingFee(drafts, 0)).toEqual([0, 0]);
    expect(allocateProcessingFee([], 100)).toEqual([]);
  });

  it("reads the absorbed change cost from configuration, falling back to $25", () => {
    expect(changeOfAgentAbsorbedCents({})).toBe(2500);
    expect(changeOfAgentAbsorbedCents({ CHANGE_OF_AGENT_ABSORBED_CENTS: "1500" })).toBe(1500);
    expect(changeOfAgentAbsorbedCents({ CHANGE_OF_AGENT_ABSORBED_CENTS: "abc" })).toBe(2500);
    expect(changeOfAgentAbsorbedCents({ CHANGE_OF_AGENT_ABSORBED_CENTS: "-5" })).toBe(2500);
  });
});

describe("bundle year and annual report due date are separate", () => {
  const req = (id: string, dueDate: string, status: RequirementLike["status"] = "open"): RequirementLike => ({ id, periodYear: Number(dueDate.slice(0, 4)), dueDate, status });

  it("includes the earliest open report due inside the bundle year", () => {
    const period = { start: "2026-11-01", end: addOneYear("2026-11-01") };
    expect(period.end).toBe("2027-11-01");
    const r = includedRequirement(period, [req("b", "2027-09-01"), req("a", "2027-05-01"), req("c", "2027-12-01")]);
    expect(r?.id).toBe("a");
  });

  it("skips reports already filed or not required, and returns none when nothing falls due", () => {
    const period = { start: "2026-11-01", end: "2027-11-01" };
    expect(includedRequirement(period, [req("a", "2027-05-01", "filed_elsewhere"), req("b", "2027-06-01", "not_required")])).toBeNull();
    expect(includedRequirement(period, [req("z", "2028-05-01")])).toBeNull();
  });

  const florida = { dueRule: { kind: "fixed_annual" as const, month: 5, day: 1 }, firstDueRule: { kind: "year_after_formation" as const } };

  it("plans next year's report when this year's is still open and past due", () => {
    const period = { start: "2026-11-01", end: "2027-11-01" };
    const reqs = [req("cur", "2026-05-01")];
    expect(includedRequirement(period, reqs)).toBeNull();
    expect(plannedBundleReport(period, reqs, florida)).toEqual({ periodYear: 2027, dueDate: "2027-05-01" });
    expect(overdueBeforeBundle(period, reqs).map((r) => r.periodYear)).toEqual([2026]);
  });

  it("plans nothing when a report is already inside the year or next year's is handled", () => {
    const period = { start: "2026-11-01", end: "2027-11-01" };
    expect(plannedBundleReport(period, [req("a", "2027-05-01")], florida)).toBeNull();
    expect(plannedBundleReport(period, [req("a", "2026-05-01"), req("b", "2027-05-01", "filed_elsewhere")], florida)).toBeNull();
    expect(overdueBeforeBundle(period, [req("a", "2026-05-01", "filed_elsewhere")])).toEqual([]);
  });

  it("plans the first report from the formation date when nothing exists yet", () => {
    const period = { start: "2026-11-01", end: "2027-11-01" };
    expect(plannedBundleReport(period, [], florida, "2026-10-01")).toEqual({ periodYear: 2027, dueDate: "2027-05-01" });
  });

  it("rejects an empty period and rolls Feb 29 forward", () => {
    expect(() => includedRequirement({ start: "2027-01-01", end: "2027-01-01" }, [])).toThrow();
    expect(addOneYear("2028-02-29")).toBe("2029-03-01");
  });

  it("asks for authorization only once the state's window opens, never before", () => {
    const base = { dueDate: "2027-05-01", filingWindowDaysBefore: 90, reportingYear: 2027, status: "scheduled" as const };
    expect(shouldRequestAuthorization({ ...base, today: "2027-01-15" })).toBe(false);
    expect(shouldRequestAuthorization({ ...base, today: "2027-02-01" })).toBe(true);
    expect(shouldRequestAuthorization({ ...base, today: "2027-06-01" })).toBe(true);
    expect(shouldRequestAuthorization({ ...base, today: "2027-02-01", status: "authorized" })).toBe(false);
    expect(shouldRequestAuthorization({ ...base, filingWindowDaysBefore: null, today: "2026-12-31" })).toBe(false);
    expect(shouldRequestAuthorization({ ...base, filingWindowDaysBefore: null, today: "2027-01-01" })).toBe(true);
  });
});
