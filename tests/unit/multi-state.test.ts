import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateFees, quoteGovernmentLines } from "@/lib/compliance/fees";
import { lookupStates, stateLookupEnabled, stateSalesEnabled } from "@/lib/compliance/launch";
import { findRule, isRuleSellable, RULES, rulesForState } from "@/lib/compliance/registry";
import { formationDateRequired } from "@/lib/compliance/state-meta";
import { currentFilingPeriod, filingWindowOpensOn, isFilingWindowOpen } from "@/lib/domain/deadlines";
import { buildQuote } from "@/lib/domain/pricing";
import { mapEntityType, mapExport, parseCsv, parseUsDate } from "@/lib/registry/state-export";
import { normalizeEntityNumber } from "@/lib/registry/state-status";
import { reminderConsentText } from "@/lib/reminders/consent";
import { confirmationEmail, nextReminderDueDate, reminderEmail } from "@/lib/reminders/subscriber-plan";
import { STATE_GUIDE_SETS } from "@/lib/seo/state-guides";

const status = (value: string, checkedAt = "2026-10-01T12:00:00Z") => ({ value, source: "wa_ccfs_export", checkedAt });

afterEach(() => vi.unstubAllEnvs());

describe("registry: four states, verified with official sources", () => {
  it("has rules for PA, WA, NV and UT, all verified, each citing official URLs", () => {
    for (const st of ["PA", "WA", "NV", "UT"]) expect(rulesForState(st).length, st).toBeGreaterThan(0);
    for (const r of RULES) {
      expect(r.verificationStatus).toBe("verified");
      expect(r.sources.length).toBeGreaterThan(3);
      for (const s of r.sources) expect(s.url).toMatch(/^https:\/\/([a-z0-9-]+\.)*(pa\.gov|palegis\.us|wa\.gov|nv\.gov|nvsos\.gov|state\.nv\.us|utah\.gov)\//);
    }
  });

  it("base government fees match the verified research", () => {
    expect(findRule("WA", "llc")!.stateFeeCents).toBe(7000);
    expect(findRule("WA", "corporation", "annual_report", true)!.stateFeeCents).toBe(7000);
    expect(findRule("NV", "llc")!.feeComponents!.map((c) => c.cents)).toEqual([15000, 20000]);
    expect(findRule("NV", "corporation")!.feeComponents!.map((c) => c.cents)).toEqual([15000, 50000]);
    expect(findRule("UT", "llc")!.stateFeeCents).toBe(1800);
    expect(findRule("UT", "business_trust")!.lateFees).toEqual([]);
  });

  it("due dates: end of the formation month for WA, NV and UT", () => {
    for (const st of ["WA", "NV", "UT"]) {
      const r = findRule(st, "llc")!;
      expect(r.dueRule).toEqual({ kind: "anniversary_month_end" });
      expect(formationDateRequired(st)).toBe(true);
      const p = currentFilingPeriod(r, { today: "2026-10-01", formationDate: "2019-10-14" });
      expect(p.dueDate).toBe("2026-10-31");
    }
    expect(formationDateRequired("PA")).toBe(false);
  });

  it("filing windows follow each state's verified rule", () => {
    const wa = findRule("WA", "llc")!;
    const nv = findRule("NV", "llc")!;
    const ut = findRule("UT", "llc")!;
    expect(filingWindowOpensOn(wa, 2026, "2026-10-31")).toBe("2026-05-04"); // 180 days
    expect(filingWindowOpensOn(nv, 2026, "2026-10-31")).toBe("2026-08-02"); // 90 days
    expect(filingWindowOpensOn(ut, 2026, "2026-10-31")).toBe("2026-09-01"); // 60 days
    expect(isFilingWindowOpen(ut, 2026, "2026-12-31", "2026-10-01")).toBe(false);
  });
});

describe("Washington: delinquency fee only from the state's own status", () => {
  const rule = findRule("WA", "llc")!;
  const base = { isNonprofit: false, dueDate: "2026-10-31", filingDate: "2026-10-05" };

  it("timely October entity: $70, no late charge, delinquency only 'possible' while status unknown", () => {
    const e = evaluateFees(rule, { ...base, status: null });
    expect(e.totalCents).toBe(7000);
    expect(e.due.map((l) => l.key)).toEqual(["filing_fee"]);
    expect(e.possible).toHaveLength(1);
    expect(e.possible[0]).toMatchObject({ cents: 2500, requiresStatus: ["Delinquent"] });
  });

  it("actually delinquent (state record says Delinquent): $70 + $25", () => {
    const e = evaluateFees(rule, { ...base, filingDate: "2026-11-20", status: status("Delinquent") });
    expect(e.totalCents).toBe(9500);
    expect(e.due.find((l) => l.kind === "government_late_fee")).toMatchObject({ cents: 2500, label: "Delinquency fee" });
    const q = quoteGovernmentLines(e);
    expect(q.lines?.map((l) => l.kind)).toEqual(["government_fee", "government_late_fee"]);
  });

  it("a passed date alone never triggers the $25 (status Active, or unknown)", () => {
    expect(evaluateFees(rule, { ...base, filingDate: "2026-12-15", status: status("Active") }).totalCents).toBe(7000);
    expect(evaluateFees(rule, { ...base, filingDate: "2026-12-15", status: null }).totalCents).toBe(7000);
  });
});

describe("Nevada: annual list + State Business License, each with its own penalty", () => {
  const llc = findRule("NV", "llc")!;
  const corp = findRule("NV", "corporation")!;
  const ctx = (filingDate: string) => ({ isNonprofit: false, dueDate: "2026-10-31", filingDate, status: null });

  it("LLC on time: $150 list + $200 license = $350, itemized", () => {
    const e = evaluateFees(llc, ctx("2026-10-20"));
    expect(e.totalCents).toBe(35000);
    expect(e.due.map((l) => [l.label, l.cents])).toEqual([
      ["Annual List fee", 15000],
      ["State Business License fee", 20000],
    ]);
    expect(e.avoidable.map((a) => a.fileBy)).toEqual(["2026-10-31", "2026-10-31"]);
  });

  it("corporation on time: $150 list + $500 license = $650", () => {
    expect(evaluateFees(corp, ctx("2026-10-20")).totalCents).toBe(65000);
  });

  it("late filing adds $75 (list) + $100 (license), both itemized as government late fees", () => {
    const e = evaluateFees(llc, ctx("2026-11-02"));
    expect(e.totalCents).toBe(52500);
    expect(e.due.filter((l) => l.kind === "government_late_fee").map((l) => l.cents)).toEqual([7500, 10000]);
    expect(evaluateFees(corp, ctx("2026-11-02")).totalCents).toBe(82500);
  });

  it("on an informational page a passed date only makes the penalties 'possible'", () => {
    const e = evaluateFees(llc, { ...ctx("2026-11-02"), filingThisPeriod: false });
    expect(e.totalCents).toBe(35000);
    expect(e.possible.map((l) => l.dueBy)).toEqual(["2026-10-31", "2026-10-31"]);
  });

  it("quote keeps government components separate from the service fee", () => {
    const e = evaluateFees(llc, ctx("2026-10-20"));
    const g = quoteGovernmentLines(e);
    const q = buildQuote({
      stateName: "Nevada",
      filingName: llc.filingName,
      governmentFeeCents: g.totalCents,
      governmentLines: g.lines,
      price: { id: "p", filingTypeCode: "annual_report", stateCode: "NV", entityType: null, serviceFeeCents: 4900, approved: false, active: true },
    });
    expect(q.lineItems.map((l) => [l.kind, l.amountCents])).toEqual([
      ["government_fee", 15000],
      ["government_fee", 20000],
      ["service_fee", 4900],
    ]);
    expect(q.totalCents).toBe(39900);
    expect(q.servicePriceApproved).toBe(false);
  });

  it("corporations above the $75,000 stock tier and publicly traded ones are blocked from online checkout", () => {
    const field = corp.intake.sections.flatMap((s) => s.fields).find((f) => f.key === "authorized_stock_tier");
    expect(field && field.type === "choice" && field.blocked?.map((b) => b.value)).toEqual(["over_75k"]);
  });
});

describe("Utah: $18 renewal; $10 late fee only where Utah applies it", () => {
  const ctx = { isNonprofit: false, dueDate: "2026-10-31", status: null };

  it("LLC and corporation timely renewal: $18", () => {
    expect(evaluateFees(findRule("UT", "llc")!, { ...ctx, filingDate: "2026-10-10" }).totalCents).toBe(1800);
    expect(evaluateFees(findRule("UT", "corporation")!, { ...ctx, filingDate: "2026-10-10" }).totalCents).toBe(1800);
  });

  it("late renewal: the $10 applies when Utah's record shows Delinquent, never from a date alone", () => {
    const llc = findRule("UT", "llc")!;
    expect(evaluateFees(llc, { ...ctx, filingDate: "2026-12-20" }).totalCents).toBe(1800);
    expect(evaluateFees(llc, { ...ctx, filingDate: "2026-12-20", status: { value: "Delinquent", source: "ut_official_export", checkedAt: "2026-12-19T00:00:00Z" } }).totalCents).toBe(2800);
  });

  it("business trust: no late fee even when delinquent", () => {
    const e = evaluateFees(findRule("UT", "business_trust")!, {
      ...ctx,
      filingDate: "2026-12-20",
      status: { value: "Delinquent", source: "ut_official_export", checkedAt: "2026-12-19T00:00:00Z" },
    });
    expect(e.totalCents).toBe(1800);
    expect(e.possible).toEqual([]);
  });
});

describe("launch switches", () => {
  it("Pennsylvania stays on by default; WA/NV/UT are off unless explicitly enabled", () => {
    for (const st of ["WA", "NV", "UT"]) {
      vi.stubEnv(`${st}_LOOKUP_ENABLED`, undefined);
      vi.stubEnv(`${st}_LIVE_FILING_SALES`, undefined);
      expect(stateLookupEnabled(st)).toBe(false);
      expect(stateSalesEnabled(st)).toBe(false);
      expect(isRuleSellable(findRule(st, "llc")!)).toBe(false);
    }
    vi.stubEnv("PA_LOOKUP_ENABLED", undefined);
    vi.stubEnv("PA_LIVE_FILING_SALES", undefined);
    expect(stateSalesEnabled("PA")).toBe(true);
    expect(isRuleSellable(findRule("PA", "llc")!)).toBe(true);
    expect(lookupStates()).toEqual(["PA"]);
  });

  it("lookup and sales are independent, and only the exact value 'true' enables a new state", () => {
    vi.stubEnv("WA_LOOKUP_ENABLED", "true");
    vi.stubEnv("WA_LIVE_FILING_SALES", "TRUE");
    expect(stateLookupEnabled("WA")).toBe(true);
    expect(stateSalesEnabled("WA")).toBe(false);
    expect(lookupStates()).toEqual(["PA", "WA"]);
    vi.stubEnv("PA_LIVE_FILING_SALES", "false");
    expect(stateSalesEnabled("PA")).toBe(false);
  });

  it("checkout still refuses unapproved prices in live mode (second gate)", () => {
    const src = readFileSync("src/lib/filings/customer.ts", "utf8");
    expect(src).toContain("requiresApprovedPrice(provider.mode) && !quote.servicePriceApproved");
  });
});

describe("official export import (operator-downloaded CSV)", () => {
  const csv = [
    "UBI#,Business Name,Business Type,Status,Expiration Date,Principal Office Address,Registered Agent Name",
    '604 123 456,"Cascade Plumbing, LLC",WA LIMITED LIABILITY COMPANY,Active,10/31/2026,"1 Main St, Seattle, WA 98101",Jane Agent',
    "603999888,Evergreen Holdings Inc.,WA PROFIT CORPORATION,Delinquent,09/30/2026,,",
    "601111222,Helping Hands,WA NONPROFIT CORPORATION,Active,10/31/2026,,",
    ",No Number LLC,WA LIMITED LIABILITY COMPANY,Active,10/31/2026,,",
    "604123456,Duplicate,WA LIMITED LIABILITY COMPANY,Active,10/31/2026,,",
  ].join("\r\n");

  it("parses quoted fields and maps WA columns", () => {
    expect(parseCsv('a,"b,c","d ""e"""\n1,2,3')).toEqual([["a", "b,c", 'd "e"'], ["1", "2", "3"]]);
    const r = mapExport(csv, { normalizeNumber: (v) => normalizeEntityNumber("WA", v) });
    expect(r.rows.map((x) => [x.entityNumber, x.entityType, x.status, x.dueDate])).toEqual([
      ["604123456", "llc", "Active", "2026-10-31"],
      ["603999888", "corporation", "Delinquent", "2026-09-30"],
      ["601111222", null, "Active", "2026-10-31"],
    ]);
    expect(r.rows[0]).toMatchObject({ name: "Cascade Plumbing, LLC", agent: "Jane Agent", isForeign: false });
    expect(r.skipped.map((s) => s.reason)).toEqual(["Missing entity number or name", "Duplicate entity number"]);
  });

  it("maps business types conservatively", () => {
    expect(mapEntityType("FOREIGN LIMITED LIABILITY COMPANY")).toEqual({ entityType: "llc", isForeign: true });
    expect(mapEntityType("WA LIMITED LIABILITY PARTNERSHIP").entityType).toBe("llp");
    expect(mapEntityType("WA LIMITED PARTNERSHIP").entityType).toBe("lp");
    expect(mapEntityType("WA NONPROFIT CORPORATION").entityType).toBeNull();
    expect(parseUsDate("2/30/2026")).toBeNull();
  });
});

describe("free reminders adapt to each state", () => {
  it("next due date for anniversary states", () => {
    expect(nextReminderDueDate(findRule("WA", "llc")!, "2015-10-03", "2026-10-01")).toEqual({ periodYear: 2026, dueDate: "2026-10-31" });
    expect(nextReminderDueDate(findRule("NV", "llc")!, "2015-03-03", "2026-10-01")).toEqual({ periodYear: 2027, dueDate: "2027-03-31" });
    expect(nextReminderDueDate(findRule("UT", "llc")!, "2015-12-03", "2026-10-01")?.dueDate).toBe("2026-12-31");
  });

  it("consent and emails name the state, separate state fees, and keep Pennsylvania's wording", () => {
    expect(reminderConsentText("Pennsylvania", "Annual Report")).toContain("Pennsylvania annual report");
    expect(reminderConsentText("Nevada", "Annual List and State Business License renewal")).toContain("Nevada annual list and state business license renewal");
    const nv = reminderEmail(
      {
        businessName: "Silver State LLC",
        dueDate: "2027-03-31",
        stateName: "Nevada",
        filingName: "Annual List and State Business License renewal",
        agencyName: "Nevada Secretary of State",
        directFilingHost: "orion.nv.gov",
        stateFeeCents: 35000,
        nonprofitFeeCents: null,
        feeComponents: [
          { label: "Annual List fee", cents: 15000 },
          { label: "State Business License fee", cents: 20000 },
        ],
        serviceFeeCents: null,
      },
      -30,
    );
    expect(nv.body).toContain("orion.nv.gov for the $350.00 in state fees ($150.00 Annual List fee + $200.00 State Business License fee)");
    expect(nv.body).not.toContain("Filewell can prepare");
    expect(nv.body).toContain("not the Nevada Secretary of State");
    expect(confirmationEmail({ businessName: "X", dueDate: "2026-12-31", stateFeeCents: 700, nonprofitFeeCents: 0, serviceFeeCents: 4900 }).subject).toBe(
      "Confirm your Pennsylvania annual report reminders for X",
    );
  });
});

describe("state guide pages", () => {
  it("each new state has a small set of sourced guides with no fear language", () => {
    for (const set of STATE_GUIDE_SETS) {
      expect(set.guides.length).toBeGreaterThanOrEqual(2);
      for (const g of set.guides) {
        expect(g.sources.length).toBeGreaterThan(0);
        expect(JSON.stringify(g)).not.toMatch(/\b(final notice|act now|urgent|unfiled)\b/i);
        expect(g.title.length).toBeLessThanOrEqual(95);
        expect(g.description.length).toBeLessThanOrEqual(220);
      }
    }
  });
});
