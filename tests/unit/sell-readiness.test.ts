import { describe, expect, it } from "vitest";
import { sellReadinessRows, sellableStates, type SellReadinessInput } from "@/lib/admin/sell-readiness";
import { listJurisdictions, RULES, rulesForState } from "@/lib/compliance/registry";
import type { ServicePrice } from "@/lib/domain/pricing";

/** The admin "Ready to sell" rows, from plain inputs: no database, no env, no network. */

const PA_TYPES = rulesForState("PA").map((r) => r.entityType);

const price = (over: Partial<ServicePrice> = {}): ServicePrice => ({
  id: "price-pa",
  filingTypeCode: "annual_report",
  stateCode: "PA",
  entityType: null,
  serviceFeeCents: 4900,
  approved: true,
  active: true,
  ...over,
});

function input(over: Partial<SellReadinessInput> = {}): SellReadinessInput {
  return {
    payments: { mode: "live", provider: "stripe", reason: null },
    sellableStates: [{ code: "PA", name: "Pennsylvania", entityTypes: PA_TYPES }],
    prices: [price()],
    site: { legalEntity: "Filewell (operating company to be confirmed)", legalEntityConfigured: false, governingLaw: null, postalAddress: null },
    legalLastUpdated: "2026-10-01",
    indexable: false,
    ...over,
  };
}

const row = (rows: ReturnType<typeof sellReadinessRows>, key: string) => {
  const r = rows.find((x) => x.key === key);
  if (!r) throw new Error(`no row ${key}`);
  return r;
};

describe("sellReadinessRows", () => {
  it("has every row of the panel, in order", () => {
    expect(sellReadinessRows(input()).map((r) => r.term)).toEqual([
      "Live payments",
      "Approved price: Pennsylvania",
      "Legal entity",
      "Governing law",
      "Postal address",
      "Legal review",
      "Legal pages version",
      "Search indexing",
      "Sales tax on the service fee",
      "Production-only secrets",
    ]);
  });

  it("live payments: On with the provider when live, Off with the provider and reason otherwise", () => {
    expect(row(sellReadinessRows(input()), "payments")).toMatchObject({ text: "On (Stripe, live)", tone: "ready" });
    expect(row(sellReadinessRows(input({ payments: { mode: "sandbox", provider: "sandbox", reason: null } })), "payments")).toMatchObject({
      text: "Off (sandbox: no real money)",
      tone: "attention",
    });
    expect(row(sellReadinessRows(input({ payments: { mode: "test", provider: "stripe", reason: null } })), "payments").text).toBe(
      "Off (Stripe test mode: no real money)",
    );
    const off = row(
      sellReadinessRows(input({ payments: { mode: "disabled", provider: "stripe", reason: "Live Stripe key present but PAYMENTS_LIVE_ENABLED is not 'true'." } })),
      "payments",
    );
    expect(off).toMatchObject({ text: "Off (Stripe: checkout is disabled)", tone: "attention" });
    expect(off.note).toMatch(/PAYMENTS_LIVE_ENABLED/);
  });

  it("approved price: the approved active fee every sold entity type resolves to", () => {
    expect(row(sellReadinessRows(input()), "price:PA")).toMatchObject({ text: "$49.00 service fee, approved", tone: "ready" });
  });

  it("approved price: Missing when the price is unapproved, inactive or absent for any sold entity type", () => {
    const unapproved = row(sellReadinessRows(input({ prices: [price({ approved: false })] })), "price:PA");
    expect(unapproved).toMatchObject({ text: "Missing", tone: "attention" });
    expect(unapproved.note).toMatch(/Not approved/);

    expect(row(sellReadinessRows(input({ prices: [price({ active: false })] })), "price:PA").text).toBe("Missing");
    expect(row(sellReadinessRows(input({ prices: [] })), "price:PA").note).toMatch(/No active service price for: LLC/);

    // A more specific unapproved row wins over the approved state row, exactly as checkout resolves it.
    const lp = row(sellReadinessRows(input({ prices: [price(), price({ id: "lp", entityType: "lp", approved: false })] })), "price:PA");
    expect(lp.text).toBe("Missing");
    expect(lp.note).toBe("Not approved (live checkout refuses it): Limited partnership (LP / LLLP)");
  });

  it("approved price: a price for another state does not count", () => {
    expect(row(sellReadinessRows(input({ prices: [price({ stateCode: "WA" })] })), "price:PA").text).toBe("Missing");
  });

  it("approved price: says so when no state is open for sale", () => {
    expect(row(sellReadinessRows(input({ sellableStates: [] })), "price")).toMatchObject({ text: "No state is open for sale", tone: "attention" });
  });

  it("legal entity, governing law and postal address: the owner's settings, or what is missing", () => {
    const unset = sellReadinessRows(input());
    expect(row(unset, "legal_entity")).toMatchObject({ text: "Not configured", tone: "attention" });
    expect(row(unset, "governing_law")).toMatchObject({ text: "Not set: the terms omit the clause (owner decision)", tone: "attention" });
    expect(row(unset, "postal_address")).toMatchObject({
      text: "Not set: subscriber reminders are skipped and legal pages say available on request",
      tone: "attention",
    });

    const set = sellReadinessRows(
      input({
        site: {
          legalEntity: "TEST ONLY Example Operator",
          legalEntityConfigured: true,
          governingLaw: "the State of Testland",
          postalAddress: "TEST ONLY 1 Example Street, Nowhere, ZZ 00000",
        },
      }),
    );
    expect(row(set, "legal_entity")).toMatchObject({ text: "TEST ONLY Example Operator", tone: "ready" });
    expect(row(set, "governing_law")).toMatchObject({ text: "the State of Testland", tone: "ready" });
    // The address itself is not repeated on the panel.
    expect(row(set, "postal_address")).toMatchObject({ text: "Configured", tone: "ready" });
  });

  it("static rows: legal review, sales tax and production-only secrets stay owner items", () => {
    const rows = sellReadinessRows(input());
    expect(row(rows, "legal_review")).toMatchObject({ text: "Draft for legal review banner is showing (no attorney review recorded)", tone: "attention" });
    expect(row(rows, "sales_tax")).toMatchObject({ text: "Not determined (owner and counsel)", tone: "attention" });
    expect(row(rows, "production_secrets")).toMatchObject({
      text: "Owner to confirm in Vercel: APP_SIGNING_SECRET, IP_HASH_SALT, CRON_SECRET differ from Preview",
      tone: "attention",
    });
  });

  it("legal pages version and search indexing", () => {
    const rows = sellReadinessRows(input());
    expect(row(rows, "legal_version")).toMatchObject({ text: "October 1, 2026", tone: "info" });
    expect(row(rows, "legal_version").note).toContain("2026-10-01");
    expect(row(rows, "indexing").text).toBe("Off");
    expect(row(sellReadinessRows(input({ indexable: true })), "indexing").text).toBe("On");
  });

  it("never carries a secret value: only names and public settings", () => {
    const secretish = /(sk|rk)_(live|test)_|whsec_|sb_secret_|re_[A-Za-z0-9]{8,}|eyJ[A-Za-z0-9]/;
    const all = sellReadinessRows(input({ payments: { mode: "disabled", provider: "stripe", reason: "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required for Stripe" } }));
    for (const r of all) expect(`${r.text} ${r.note ?? ""}`).not.toMatch(secretish);
  });
});

describe("sellableStates", () => {
  it("lists only filingEnabled states with a sellable rule", () => {
    const states = sellableStates(listJurisdictions(), RULES, (r) => r.stateCode === "PA" || r.stateCode === "WA");
    // Washington has rules but is not filingEnabled in the directory, so it is not listed.
    expect(states.map((s) => s.code)).toEqual(["PA"]);
    expect(states[0]).toMatchObject({ name: "Pennsylvania" });
    expect([...states[0].entityTypes].sort()).toEqual([...PA_TYPES].sort());
  });

  it("drops a state whose rules are all closed to sale", () => {
    expect(sellableStates(listJurisdictions(), RULES, () => false)).toEqual([]);
  });
});
