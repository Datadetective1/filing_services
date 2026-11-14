import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Pick your state first": the state page lists only what checkout would sell there, with
 * real totals, and names what isn't open instead of implying it.
 */

vi.mock("@/lib/services/public-prices", () => ({
  publicServicePrices: vi.fn(async () => ({
    registered_agent: 11900,
    ra_annual_report_bundle: 16900,
    formation: 9900,
    change_registered_agent: 0,
    provider_annual_report: 9900,
  })),
}));

vi.mock("@/lib/compliance/public-quote", () => ({
  publicQuote: vi.fn(async (rule: { stateFeeCents: number }) => ({
    serviceFeeCents: 4900,
    governmentFeeCents: rule.stateFeeCents,
    totalCents: 4900 + rule.stateFeeCents,
  })),
}));

/** Production's switches as of Nov 14, 2026. */
function production() {
  const env: Record<string, string> = {
    VERCEL_ENV: "production",
    BUSINESS_SERVICES_PAGES: "true",
    RA_PROVIDER_AGREEMENT_SIGNED: "true",
    RA_FULFILLMENT_TESTED: "true",
    RA_SALES_ALL: "true",
    RA_ALERTS_MAILBOX: "support@getfilewell.com",
    RA_BUNDLE_SALES: "true",
    NEXT_PUBLIC_LEGAL_ENTITY: "Harborlune LLC",
    FORMATION_SALES_ALL: "true",
    CO_LIVE_FILING_SALES: "true",
    FL_LIVE_FILING_SALES: "true",
    MI_LIVE_FILING_SALES: "true",
    MT_LIVE_FILING_SALES: "true",
    SD_LIVE_FILING_SALES: "true",
    RAI_REPORT_SALES_CA: "true",
    RAI_REPORT_SALES_WA: "true",
    RAI_REPORT_SALES_NY: "true",
  };
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

async function load(code: string) {
  const { stateServices } = await import("@/lib/services/state-services");
  const view = await stateServices(code);
  if (!view) throw new Error(`no view for ${code}`);
  return view;
}

const keys = (v: { offered: { key: string }[] }) => v.offered.map((o) => o.key);

describe("state services in production", () => {
  beforeEach(production);

  it("lists formation, the agent and the change fee in Texas, and says annual reports aren't open", async () => {
    const v = await load("TX");
    expect(keys(v)).toEqual(["formation", "registered_agent"]);
    const formation = v.offered[0];
    expect(formation.options.map((o) => [o.label, o.totalCents, o.serviceCents, o.stateCents])).toEqual([
      ["LLC", 39900, 9900, 30000],
      ["Corporation", 39900, 9900, 30000],
    ]);
    expect(formation.options[0].href).toBe("/dashboard/services/formation?state=TX&type=llc");
    expect(v.offered[1].options[0]).toMatchObject({ totalCents: 11900, href: "/registered-agent/start?state=TX" });
    expect(v.offered[1].note).toBe("Switching agents? We file the Texas change for you. You pay only the $15 state fee.");
    expect(v.notOffered).toEqual([{ key: "annual_report", title: "Annual report", note: "Annual report filing isn't open in Texas yet." }]);
  });

  it("never offers formation in a held-back state, and says so", async () => {
    for (const code of ["AL", "AZ", "CA", "NE", "NJ", "NV", "NY", "WV"]) {
      const v = await load(code);
      expect(keys(v), code).not.toContain("formation");
      expect(v.notOffered.map((g) => g.key), code).toContain("formation");
      expect(v.notOffered.find((g) => g.key === "formation")?.note).toMatch(/^Forming a new business in .+ isn't open yet\.$/);
    }
  });

  it("offers only the open entity type and names the other", async () => {
    const tn = await load("TN");
    expect(tn.offered[0].options.map((o) => o.label)).toEqual(["Corporation"]);
    expect(tn.offered[0].note).toBe("We can't form LLCs in Tennessee yet.");
    const pa = await load("PA");
    expect(pa.offered[0].options.map((o) => o.label)).toEqual(["LLC"]);
    expect(pa.offered[0].note).toBe("We can't form corporations in Pennsylvania yet.");
  });

  it("shows all four in Pennsylvania, LLCs first in the annual report", async () => {
    const v = await load("PA");
    expect(keys(v)).toEqual(["formation", "registered_agent", "bundle", "annual_report"]);
    const report = v.offered[3];
    expect(report.options.slice(0, 2).map((o) => [o.label, o.totalCents])).toEqual([
      ["LLC", 5600],
      ["Corporation", 5600],
    ]);
    expect(report.options[0].href).toBe("/find?state=PA&entity=llc");
    expect(v.notOffered).toEqual([]);
  });

  it("sends partner-filed annual reports to the partner order with the state fee in the total", async () => {
    const v = await load("NY");
    const report = v.offered.find((o) => o.key === "annual_report");
    expect(report?.options.map((o) => o.href)).toEqual([
      "/dashboard/services/annual-report?state=NY&type=llc",
      "/dashboard/services/annual-report?state=NY&type=corporation",
    ]);
    for (const o of report?.options ?? []) expect(o.totalCents).toBe(o.serviceCents + (o.stateCents ?? 0));
  });

  it("hides the bundle when its switch is off, without calling it a gap outside bundle states", async () => {
    vi.stubEnv("RA_BUNDLE_SALES", "");
    expect(keys(await load("PA"))).not.toContain("bundle");
    expect((await load("TX")).notOffered.map((g) => g.key)).not.toContain("bundle");
  });

  it("covers Puerto Rico and every state", async () => {
    const { pickableStates } = await import("@/lib/services/state-services");
    const all = pickableStates();
    expect(all).toHaveLength(52);
    expect(all.map((s) => s.code)).toContain("PR");
    for (const s of all) {
      const v = await load(s.code);
      // Registered agent is open everywhere in production.
      expect(keys(v), s.code).toContain("registered_agent");
      for (const o of v.offered) for (const opt of o.options) expect(opt.totalCents, `${s.code} ${o.key}`).toBeGreaterThan(0);
    }
  });
});

describe("before business services are on", () => {
  it("shows no unpriced service", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BUSINESS_SERVICES_PAGES", "");
    const v = await load("TX");
    expect(v.offered).toEqual([]);
  });
});

describe("copy", () => {
  it("has no long dashes or double hyphens", async () => {
    const { readFileSync } = await import("node:fs");
    for (const p of [
      "src/lib/services/state-services.ts",
      "src/app/(marketing)/services/page.tsx",
      "src/app/(marketing)/services/[state]/page.tsx",
      "src/components/funnel/state-picker.tsx",
      "src/components/visual/state-tile-map.tsx",
    ]) {
      const text = readFileSync(p, "utf8");
      expect(text, p).not.toMatch(/[–—]/);
      expect(text.replace(/--[a-z-]+|\/\/.*$/gm, ""), p).not.toMatch(/ -- /);
    }
  });

  it("never links to a state's own filing site", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/app/(marketing)/services/[state]/page.tsx", "utf8");
    expect(page).not.toMatch(/target="_blank"|DirectoryListing|searchUrl|\.gov/);
  });
});
