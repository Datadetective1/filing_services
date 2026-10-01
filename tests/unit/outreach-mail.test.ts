import { describe, expect, it, vi } from "vitest";
import { addressKey, cohortExclusions, type CohortExclusion, formatMailAddress, looksLikePersonalName, mailExclusions, selectCohort, SHARED_ADDRESS_THRESHOLD } from "@/lib/outreach/mail";
import { createLobPostcard, type LobAddress, lobFromAddress, lobMode, mailBlockers, MailBlockedError } from "@/lib/outreach/lob";
import { landingCode, verifyLandingCode } from "@/lib/outreach/mail-codes";
import { cheapestPlan, NET_PER_ORDER, pilotCost, STRIPE_FEE, VENDOR_PLANS } from "@/lib/outreach/mail-economics";
import { csvCell, mailCsv, type MailRow } from "@/lib/outreach/mail-service";
import { postcardBackHtml, postcardCopy, postcardFrontHtml, postcardText, SOLICITATION_STATEMENT } from "@/lib/outreach/postcard";
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

  it("excludes care-of and agent-service addresses", () => {
    for (const line1 of ["C/o Norman Yaffe Esq 100 Pine St", "c/o John Doe", "Incorporating Services Ltd", "Attn: Legal Dept", "CT Corporation System"]) {
      expect(mailExclusions({ entityType: "lp", address: { ...addr, line1 }, situation: lp(), isCustomer: false, sharedCount: 1 }), line1).toEqual(["agent_address"]);
    }
    expect(mailExclusions({ entityType: "lp", address: { ...addr, line1: "12 Corporation Way" }, situation: lp(), isCustomer: false, sharedCount: 1 })).toEqual([]);
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
  const front = postcardFrontHtml(c);
  const back = postcardBackHtml(c, "https://www.getfilewell.com/m/3f2a9c10-7380992-abcdefghij/qr.png");

  it("leads the front with the solicitation / not a bill / not government / not the Department of State banner", () => {
    expect(c.banner).toBe("THIS IS A SOLICITATION. NOT A BILL. NOT A GOVERNMENT DOCUMENT.");
    expect(c.bannerSub).toBe("Not sent by the Pennsylvania Department of State. Filewell is a private filing service. Advertisement.");
    expect(text.indexOf(c.banner)).toBe(0);
    // The banner is the first element in the front's markup and repeats at the top of the back.
    expect(front.indexOf('<div class="band">')).toBeLessThan(front.indexOf("<h1>"));
    expect(back.indexOf('<div class="disc">')).toBeLessThan(back.indexOf('<div class="lead">'));
  });

  it("says 'may be due' and that the business can file directly with Pennsylvania for $7 instead of using Filewell", () => {
    expect(c.headline).toBe("Your 2026 Pennsylvania annual report may be due by December 31.");
    expect(c.directOption).toBe(
      "You can file directly with the Pennsylvania Department of State at file.dos.pa.gov for the $7.00 state fee ($0.00 for not-for-profit associations) instead of using Filewell.",
    );
    expect(front).toContain("instead of using Filewell");
    expect(back).toContain("instead of using Filewell");
    expect(text).toContain("$49.00 service fee + $7.00 state fee = $56.00");
    expect(text).toContain("Already filed? Please ignore this card.");
  });

  it("carries the solicitation statement, operator identity, return address and how to stop mail", () => {
    expect(text).toContain(SOLICITATION_STATEMENT);
    expect(text).toContain("operated by Amary Coulibaly, sole proprietor. It is not the Pennsylvania Department of State");
    expect(text).toContain("Filewell, PO Box 1, Allentown, PA 18101");
    expect(text).toContain("To stop mail from Filewell, email support@getfilewell.com.");
  });

  it("makes no legal-sufficiency claims and no threats", () => {
    expect(text).not.toMatch(/required by|federal law|word.for.word|verbatim|legally|compliant|dissol|penalt|final|urgent|immediately|must file/i);
  });

  it("is sized for a 4x6 card with bleed, and the back leaves the right side free for the address block", () => {
    expect(front).toContain("size:6.25in 4.25in");
    expect(back).toContain("width:2.6in");
    expect(back).toContain('src="https://www.getfilewell.com/m/3f2a9c10-7380992-abcdefghij/qr.png"');
    expect(front + back).not.toMatch(/<script/i);
  });

  it("escapes business names", () => {
    expect(postcardFrontHtml(postcardCopy({ ...{ periodYear: 2026, stateFeeCents: 700, nonprofitStateFeeCents: 0, serviceFeeCents: 4900, landingUrl: "https://x/m/y", operator: "o", returnAddress: null }, businessName: "<b>Evil</b> LP" }))).toContain(
      "For &lt;b&gt;Evil&lt;/b&gt; LP",
    );
  });
});

describe("pilot cohort rules", () => {
  const s = lp();
  const base = { entityType: "lp" as const, isForeign: false, address: addr, situation: s, isCustomer: false, sharedCount: 1, registerAddressCount: 1, legalName: "Example Partners LP" };

  it("accepts a clean domestic LP at a unique Pennsylvania street address", () => {
    expect(cohortExclusions(base)).toEqual([]);
  });

  it("excludes foreign, out-of-state, P.O. box, no street number, duplicate and over-long addresses", () => {
    expect(cohortExclusions({ ...base, isForeign: true })).toEqual(["foreign_entity"]);
    expect(cohortExclusions({ ...base, address: { ...addr, region: "NJ" } })).toEqual(["outside_pennsylvania"]);
    expect(cohortExclusions({ ...base, address: { ...addr, line1: "PO Box 12" } })).toEqual(["po_box"]);
    expect(cohortExclusions({ ...base, address: { ...addr, line1: "Rural Route Two" } })).toEqual(["no_street_number"]);
    expect(cohortExclusions({ ...base, registerAddressCount: 2 })).toEqual(["duplicate_address"]);
    expect(cohortExclusions({ ...base, address: { ...addr, line1: "1234 Exceptionally Long Boulevard Name Extension", line2: "Unit 5" } })).toContain("address_too_long");
  });

  it("excludes questionable names: type mismatch, public-body names, personal names, artifacts, too long", () => {
    expect(cohortExclusions({ ...base, legalName: "Hidalgo Llc." })).toEqual(["name_type_mismatch"]);
    expect(cohortExclusions({ ...base, legalName: "Allentown Mini Mart Corpor" })).toEqual(["name_type_mismatch"]);
    expect(cohortExclusions({ ...base, legalName: "Pa Fugitive Apperhension Task Force" })).toEqual(["government_like_name"]);
    expect(cohortExclusions({ ...base, legalName: "Jesse Jones" })).toEqual(["personal_name"]);
    expect(cohortExclusions({ ...base, legalName: "Florence J Lawson" })).toEqual(["personal_name"]);
    expect(cohortExclusions({ ...base, legalName: "Tt Nails & Spa_1" })).toEqual(["questionable_record"]);
    expect(cohortExclusions({ ...base, legalName: "The Extremely Long Family Investment Partners LP" })).toEqual(["name_too_long"]);
  });

  it("does not flag ordinary business names as personal names", () => {
    for (const n of ["Felino Shipping", "Matteos Pizzeria", "Club Moani", "Steeltown Plumbing", "Geigel Hill Peony Farm", "1629 Ellsworth LP"]) expect(looksLikePersonalName(n), n).toBe(false);
  });

  it("selects a stable, reproducible cohort and keeps every other row with its reasons", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ entityNumber: String(1000 + i).padStart(10, "0"), exclusions: (i % 3 === 0 ? ["po_box"] : []) as CohortExclusion[] }));
    const a = selectCohort(rows, 10);
    const b = selectCohort([...rows].reverse(), 10);
    expect(a.selected.map((r) => r.entityNumber)).toEqual(b.selected.map((r) => r.entityNumber));
    expect(a.selected).toHaveLength(10);
    expect(a.excluded).toHaveLength(20);
    expect(a.selected.every((r) => r.exclusions.length === 0)).toBe(true);
  });
});

describe("Lob adapter safeguards", () => {
  const to: LobAddress = { company: "Example Partners LP", address_line1: "12 Market St", address_city: "Harrisburg", address_state: "PA", address_zip: "17101", address_country: "US" };
  const from = lobFromAddress({ MAIL_FROM_LINE1: "PO Box 1", MAIL_FROM_CITY: "Allentown", MAIL_FROM_STATE: "PA", MAIL_FROM_ZIP: "18101" })!;
  const input = { idempotencyKey: "test-send-1", description: "pilot", to, from, front: "<html></html>", back: "<html></html>", metadata: { campaign: "3f2a9c10" } };

  it("identifies test and live keys", () => {
    expect(lobMode("test_abc")).toBe("test");
    expect(lobMode("live_abc")).toBe("live");
    expect(lobMode("sk_abc")).toBeNull();
    expect(lobMode(undefined)).toBeNull();
  });

  it("refuses a live key unless MAIL_SENDS_ENABLED=true, MAIL_VENDOR=lob and the campaign is approved, before any network call", async () => {
    const fetchImpl = vi.fn();
    await expect(createLobPostcard("live_x", input, { campaignApproved: true, env: { MAIL_VENDOR: "lob", MAIL_SENDS_ENABLED: "false" }, fetchImpl })).rejects.toBeInstanceOf(MailBlockedError);
    await expect(createLobPostcard("live_x", input, { campaignApproved: false, env: { MAIL_VENDOR: "lob", MAIL_SENDS_ENABLED: "true" }, fetchImpl })).rejects.toBeInstanceOf(MailBlockedError);
    await expect(createLobPostcard("live_x", input, { campaignApproved: true, env: { MAIL_SENDS_ENABLED: "true" }, fetchImpl })).rejects.toBeInstanceOf(MailBlockedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends a test postcard with basic auth, an idempotency key, 4x6, marketing use and First-Class", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "psc_test123" }), { status: 200 }));
    const r = await createLobPostcard("test_key", input, { campaignApproved: false, env: {}, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.id).toBe("psc_test123");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.lob.com/v1/postcards");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("test_key:").toString("base64")}`);
    expect(headers["Idempotency-Key"]).toBe("test-send-1");
    expect(JSON.parse(String(init.body))).toMatchObject({ size: "4x6", use_type: "marketing", mail_type: "usps_first_class", to, from: JSON.parse(JSON.stringify(from)) });
  });

  it("refuses without a return address", () => {
    expect(lobFromAddress({})).toBeNull();
    expect(mailBlockers({ mode: "test", vendor: undefined, sendsEnabled: undefined, campaignApproved: false, hasFromAddress: false })).toEqual([
      "No return address (MAIL_FROM_LINE1, MAIL_FROM_CITY, MAIL_FROM_STATE, MAIL_FROM_ZIP)",
    ]);
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
