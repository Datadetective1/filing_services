import { describe, expect, it } from "vitest";
import { addressKey, formatMailAddress, mailExclusions, SHARED_ADDRESS_THRESHOLD } from "@/lib/outreach/mail";
import { landingCode, verifyLandingCode } from "@/lib/outreach/mail-codes";
import { cheapestPlan, NET_PER_ORDER, pilotCost, STRIPE_FEE, VENDOR_PLANS } from "@/lib/outreach/mail-economics";
import { csvCell, mailCsv, type MailRow } from "@/lib/outreach/mail-service";
import { postcardCopy, postcardFrontHtml, postcardText, SOLICITATION_DISCLAIMER } from "@/lib/outreach/postcard";
import { assessSituation } from "@/lib/outreach/segment";

const OCT1 = "2026-10-01";
const lp = (over: Partial<Parameters<typeof assessSituation>[0]> = {}) =>
  assessSituation({ stateCode: "PA", entityType: "lp", isForeign: false, formationDate: "2012-04-02", filedYears: null, today: OCT1, ...over });
const addr = { line1: "12 Market St", line2: "", city: "Harrisburg", region: "PA", postal_code: "17101", county: "Dauphin" };

describe("postcard pilot selection (December 31 group)", () => {
  it("includes an established LP with a complete, unshared address (deadline Dec 31, 91 days away)", () => {
    expect(lp()).toMatchObject({ dueDate: "2026-12-31", daysRemaining: 91, firstReportLater: false });
    expect(mailExclusions({ entityType: "lp", address: addr, situation: lp(), isCustomer: false, sharedCount: 1 })).toEqual([]);
  });

  it("excludes first-year entities, existing customers, and other deadline groups", () => {
    const firstYear = lp({ formationDate: "2026-03-01" });
    expect(mailExclusions({ entityType: "lp", address: addr, situation: firstYear, isCustomer: false, sharedCount: 1 })).toContain("first_year");
    expect(mailExclusions({ entityType: "lp", address: addr, situation: lp(), isCustomer: true, sharedCount: 1 })).toEqual(["existing_customer"]);
    const llc = assessSituation({ stateCode: "PA", entityType: "llc", isForeign: false, formationDate: "2012-01-01", filedYears: null, today: OCT1 });
    expect(mailExclusions({ entityType: "llc", address: addr, situation: llc, isCustomer: false, sharedCount: 1 })).toContain("not_dec31_deadline");
  });

  it("excludes missing, incomplete, foreign and shared (registered-agent) addresses", () => {
    const s = lp();
    expect(mailExclusions({ entityType: "lp", address: null, situation: s, isCustomer: false, sharedCount: 0 })).toEqual(["no_address"]);
    expect(mailExclusions({ entityType: "lp", address: { ...addr, postal_code: "171" }, situation: s, isCustomer: false, sharedCount: 1 })).toEqual(["incomplete_address"]);
    expect(mailExclusions({ entityType: "lp", address: { ...addr, region: "ON" }, situation: s, isCustomer: false, sharedCount: 1 })).toEqual(["non_us_address"]);
    expect(mailExclusions({ entityType: "lp", address: addr, situation: s, isCustomer: false, sharedCount: SHARED_ADDRESS_THRESHOLD })).toEqual(["shared_address"]);
  });

  it("excludes when the deadline is too far away, and never uses dataset filing history", () => {
    // After Dec 31 the current period is next year's report, which is too far away to mail about.
    expect(mailExclusions({ entityType: "lp", address: addr, situation: lp({ today: "2027-01-05" }), isCustomer: false, sharedCount: 1 })).toEqual(["too_early"]);
    expect(mailExclusions({ entityType: "lp", address: addr, situation: lp({ today: "2026-06-01" }), isCustomer: false, sharedCount: 1 })).toEqual(["too_early"]);
    // Open-dataset "filed" data is ignored: the business stays selectable (the card says "may be due").
    expect(mailExclusions({ entityType: "lp", address: addr, situation: lp({ filedYears: [2026], statusSource: "pa_dos_open_data" }), isCustomer: false, sharedCount: 1 })).toEqual([]);
  });

  it("normalizes addresses so suite numbers and spelling don't hide a shared registered-agent address", () => {
    expect(addressKey({ line1: "2595 Interstate Drive, Suite 103", postal_code: "17110-9378" })).toBe(addressKey({ line1: "2595 Interstate Drive", postal_code: "17110" }));
    expect(addressKey({ line1: "10 Main Street", postal_code: "19103" })).toBe(addressKey({ line1: "10 main st", postal_code: "19103" }));
    expect(addressKey({ line1: "", postal_code: "19103" })).toBeNull();
    expect(formatMailAddress({ line1: "5239 Tilghman St", city: "Allentown", region: "pa", postal_code: "18104-0" })).toBe("5239 Tilghman St, Allentown, PA 18104");
  });
});

describe("landing codes", () => {
  const secret = "unit-test-secret-0000000000000000";
  const campaign = "3f2a9c10-1111-4222-8333-944455556666";

  it("round-trips the campaign and the 10-digit entity number", () => {
    const code = landingCode(campaign, "0007380992", secret);
    expect(code).toMatch(/^3f2a9c10-7380992-[A-Za-z0-9_-]{10}$/);
    expect(verifyLandingCode(code, secret)).toEqual({ campaignShort: "3f2a9c10", entityNumber: "0007380992" });
  });

  it("rejects a code pointed at another entity, another campaign, a different secret, or garbage", () => {
    const code = landingCode(campaign, "0007380992", secret);
    expect(verifyLandingCode(code.replace("7380992", "7380993"), secret)).toBeNull();
    expect(verifyLandingCode(code.replace("3f2a9c10", "3f2a9c11"), secret)).toBeNull();
    expect(verifyLandingCode(code, "other-secret-000000000000000000")).toBeNull();
    expect(verifyLandingCode("../../admin", secret)).toBeNull();
  });
});

describe("postcard copy", () => {
  const c = postcardCopy({
    businessName: "Example Partners LP",
    periodYear: 2026,
    stateFeeCents: 700,
    nonprofitStateFeeCents: 0,
    serviceFeeCents: 4900,
    landingUrl: "https://www.getfilewell.com/m/3f2a9c10-7380992-abcdefghij",
    operator: "Amary Coulibaly, sole proprietor",
    returnAddress: "PO Box 1, Allentown, PA 18101",
  });
  const text = postcardText(c);

  it("leads with the solicitation / not-a-government-document banner and the private-service label", () => {
    expect(c.banner).toBe("THIS IS A SOLICITATION. NOT A BILL OR OFFICIAL GOVERNMENT DOCUMENT. NOT SENT BY THE PENNSYLVANIA DEPARTMENT OF STATE.");
    expect(c.brandLine).toBe("Filewell · Private filing service · Advertisement");
    expect(text.indexOf(c.banner)).toBe(0);
  });

  it("says 'may be due', offers direct filing for $7, and shows $49 + $7 = $56", () => {
    expect(c.headline).toBe("Your 2026 Pennsylvania annual report may be due by December 31.");
    expect(text).toContain("File it yourself at file.dos.pa.gov: $7.00 state fee ($0.00 for not-for-profit associations).");
    expect(text).toContain("$49.00 service fee + $7.00 state fee = $56.00");
    expect(text).toContain("Already filed? Please ignore this card.");
  });

  it("carries the 39 U.S.C. 3001(d) notice, operator identity, return address and how to stop mail", () => {
    expect(text).toContain(SOLICITATION_DISCLAIMER);
    expect(text).toContain("operated by Amary Coulibaly, sole proprietor. It is not the Pennsylvania Department of State");
    expect(text).toContain("Filewell, PO Box 1, Allentown, PA 18101");
    expect(text).toContain("To stop mail from Filewell, email support@getfilewell.com.");
    expect(c.cta).toBe("Start here: www.getfilewell.com/m/3f2a9c10-7380992-abcdefghij");
  });

  it("never threatens or invents consequences", () => {
    expect(text).not.toMatch(/dissol|penalt|final|urgent|immediately|must file|late fee of/i);
  });

  it("produces print-ready HTML with vendor merge fields and escaped copy", () => {
    const html = postcardFrontHtml(c);
    expect(html).toContain("{{business_name}}");
    expect(html).toContain("{{landing_url}}");
    expect(html).toContain("size:6.25in 4.25in");
    expect(html).not.toMatch(/<script/i);
  });
});

describe("export CSV", () => {
  it("neutralizes spreadsheet formulas and quotes every cell", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("\"'+1\"");
    expect(csvCell("Acme, LP")).toBe("\"Acme, LP\"");
  });

  it("has the required columns", () => {
    const header = mailCsv("c", [] as MailRow[]).split("\r\n")[0];
    for (const col of ["business_name", "entity_number", "entity_type", "mailing_address_line1", "deadline", "source", "source_url", "retrieved_at", "exclusion_reason", "landing_url", "campaign_id"]) {
      expect(header).toContain(col);
    }
  });
});

describe("pilot economics", () => {
  it("net per paid order is $49 minus the card fee on $56", () => {
    expect(STRIPE_FEE).toBe(1.92);
    expect(NET_PER_ORDER).toBe(47.08);
  });

  it("costs and break-even per pilot size use the cheapest single-month plan", () => {
    expect(cheapestPlan(100)).toMatchObject({ cost: 90.2, breakEvenOrders: 2 });
    expect(cheapestPlan(500)).toMatchObject({ cost: 451, breakEvenOrders: 10 });
    expect(cheapestPlan(1000)).toMatchObject({ cost: 909, breakEvenOrders: 20 });
    expect(cheapestPlan(5000)).toMatchObject({ cost: 3505, breakEvenOrders: 75 });
    expect(pilotCost(1000, VENDOR_PLANS.find((p) => p.id === "postgrid_starter")!).months).toBe(2);
  });
});
