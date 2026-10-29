import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Registered agent operations: sales fail closed, payment never activates service, billing
 * and the legal appointment stay separate, documents escalate on internal targets, and the
 * provider is only ever worked by hand.
 */

vi.mock("server-only", () => ({}));
const sales = await import("@/lib/registered-agent/sales");
const status = await import("@/lib/registered-agent/status");
const docs = await import("@/lib/registered-agent/documents");
const { RA_JURISDICTIONS, changeOfAgentFeeCents, formationFeeCents, getRaJurisdiction, raFactsComplete, raJurisdictionsWithPublicFacts } = await import(
  "@/lib/registered-agent/jurisdictions"
);
const { ManualFulfillmentRequired, ManualRegisteredAgentsIncProvider, providerEntrySheet } = await import("@/lib/registered-agent/manual-provider");
const { validateServiceCheckoutInput } = await import("@/lib/services/orders");

afterEach(() => vi.unstubAllEnvs());

describe("coverage", () => {
  it("has one record for each state, DC and Puerto Rico", () => {
    expect(RA_JURISDICTIONS).toHaveLength(52);
    expect(new Set(RA_JURISDICTIONS.map((j) => j.code)).size).toBe(52);
    expect(getRaJurisdiction("dc")?.code).toBe("DC");
  });

  it("every fact carries an official source, a quote and the date checked", () => {
    for (const j of RA_JURISDICTIONS) {
      const sources = [
        ...(j.changeOfAgent?.sources ?? []),
        ...j.appointmentSources,
        ...(j.formation?.sources ?? []),
        ...(j.providerSource ? [j.providerSource] : []),
      ];
      for (const s of sources) {
        expect(s.url).toMatch(/^https?:\/\//);
        expect(s.quote.length).toBeGreaterThan(0);
        expect(s.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      if (j.changeOfAgent)
        expect(j.changeOfAgent.sources.length).toBeGreaterThan(0);
      if (j.formation) expect(j.formation.sources.length).toBeGreaterThan(0);
      expect(j.fulfillmentReady).toBe(false);
      expect(j.providerCoverage).not.toBe("confirmed_by_provider");
    }
  });

  it("holds the verified fees from each state's own site", () => {
    expect(changeOfAgentFeeCents("TX", "llc")).toBe(1500);
    expect(changeOfAgentFeeCents("CO", "llc")).toBe(1000);
    expect(changeOfAgentFeeCents("MT", "llc")).toBe(0);
    expect(changeOfAgentFeeCents("FL", "corporation")).toBe(3500);
    expect(formationFeeCents("TX", "llc")).toBe(30000);
    expect(formationFeeCents("FL", "corporation")).toBe(7000);
  });

  it("never quotes a formation fee that depends on shares, publication or extra filings", () => {
    for (const [code, type] of [
      ["DE", "corporation"],
      ["NY", "llc"],
      ["NV", "llc"],
      ["MA", "corporation"],
    ] as const) {
      expect(formationFeeCents(code, type)).toBeNull();
      expect(getRaJurisdiction(code)!.unverified.length).toBeGreaterThan(0);
    }
  });

  it("the provider lists every jurisdiction on its own site", () => {
    for (const j of RA_JURISDICTIONS) {
      expect(j.providerSource?.url).toMatch(
        /^https:\/\/(www\.)?registeredagentsinc\.com\//,
      );
      expect(j.providerCoverage).toBe("listed_on_provider_site");
    }
  });

  it("Pennsylvania is open to the provider as a listed Commercial Registered Office Provider", () => {
    const pa = getRaJurisdiction("PA")!;
    expect(pa.researchNotes.join(" ")).toMatch(/Registered Agents Inc/);
    expect(raFactsComplete(pa)).toBe(true);
  });

  it("marks a jurisdiction verified only when every fact a sale needs is verified", () => {
    expect(raFactsComplete(getRaJurisdiction("TX")!)).toBe(true);
    for (const j of RA_JURISDICTIONS) {
      if (!raFactsComplete(j))
        expect(j.knownBlockers.length).toBeGreaterThan(0);
      else {
        expect(j.changeOfAgent?.governmentFeeCents.llc).toBeTypeOf("number");
        expect(j.changeOfAgent?.governmentFeeCents.corporation).toBeTypeOf(
          "number",
        );
        expect(j.appointmentProcess).toBeTruthy();
      }
    }
  });

  it("publishes pages only where there are verified facts", () => {
    const codes = raJurisdictionsWithPublicFacts().map((j) => j.code);
    expect(codes).toContain("TX");
    expect(codes).toContain("PA");
    for (const c of codes)
      expect(changeOfAgentFeeCents(c, "llc")).not.toBeNull();
  });

  it("asks for owner details where the provider needs them", () => {
    expect(getRaJurisdiction("WY")!.extraIntake.beneficialOwners).toBe(true);
    expect(getRaJurisdiction("TX")!.extraIntake.beneficialOwners).toBe(false);
  });
});

describe("sales fail closed", () => {
  it("never contracts with a person: the legal entity must be a company", () => {
    vi.stubEnv("NEXT_PUBLIC_LEGAL_ENTITY", "");
    expect(sales.contractingCompanyConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_LEGAL_ENTITY", "Amary Coulibaly, sole proprietor");
    expect(sales.contractingCompanyConfigured()).toBe(false);
    expect(sales.nationwideBlockers().join(" ")).toMatch(/contracting company/);
    for (const name of ["Harborlune LLC", "Harborlune, L.L.C.", "Filewell Inc.", "Example Corporation"]) {
      vi.stubEnv("NEXT_PUBLIC_LEGAL_ENTITY", name);
      expect(sales.contractingCompanyConfigured()).toBe(true);
    }
  });

  it("nothing is sold without its switch", () => {
    for (const j of RA_JURISDICTIONS)
      expect(sales.raSaleCheck(j.code, "llc", "switching").ok).toBe(false);
    expect(sales.formationSaleCheck("TX", "llc").ok).toBe(false);
    expect(
      sales.bundleSaleCheck(
        "CO",
        { entityType: "llc", isForeign: false, isNonprofit: false },
        "switching",
      ).ok,
    ).toBe(false);
  });

  it("outside real money, the switch and a verified fee are enough to test the journey", () => {
    vi.stubEnv("RA_SALES_TX", "true");
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "false");
    expect(sales.raSaleCheck("TX", "llc", "switching").ok).toBe(true);
    // A government fee is never guessed, even in a sandbox.
    const gap = RA_JURISDICTIONS.find(
      (j) => changeOfAgentFeeCents(j.code, "llc") === null,
    );
    if (gap) {
      vi.stubEnv(`RA_SALES_${gap.code}`, "true");
      expect(sales.raSaleCheck(gap.code, "llc", "switching").ok).toBe(false);
    }
  });

  it("one switch opens every verified jurisdiction and none with a missing fee", () => {
    vi.stubEnv("RA_SALES_ALL", "true");
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "false");
    for (const j of RA_JURISDICTIONS) {
      expect(sales.raSaleCheck(j.code, "llc", "switching").ok).toBe(
        changeOfAgentFeeCents(j.code, "llc") !== null,
      );
    }
  });

  it("where real money could be taken, every blocker must be cleared", () => {
    vi.stubEnv("RA_SALES_TX", "true");
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "true");
    expect(sales.raSaleCheck("TX", "llc", "switching").ok).toBe(false);
    vi.stubEnv("RA_PROVIDER_AGREEMENT_SIGNED", "true");
    expect(sales.raSaleCheck("TX", "llc", "switching").ok).toBe(false);
    expect(sales.raLiveBlockers("TX", "llc", "switching").join(" ")).toMatch(
      /test order/,
    );
    // One end-to-end provider test covers every jurisdiction: the workflow is the same everywhere.
    vi.stubEnv("RA_FULFILLMENT_TESTED", "true");
    // Still closed: no company to contract with and no alerts mailbox.
    expect(sales.raLiveBlockers("TX", "llc", "switching").join(" ")).toMatch(/contracting company/);
    expect(sales.raLiveBlockers("TX", "llc", "switching").join(" ")).toMatch(/alerts mailbox/);
    vi.stubEnv("NEXT_PUBLIC_LEGAL_ENTITY", "Harborlune LLC");
    vi.stubEnv("RA_ALERTS_MAILBOX", "alerts@example.com");
    expect(sales.raLiveBlockers("TX", "llc", "switching")).toEqual([]);
    expect(sales.raLiveBlockers("TX", "corporation", "new_entity")).toEqual([]);
    expect(sales.raSaleCheck("TX", "llc", "switching").ok).toBe(true);
    for (const j of RA_JURISDICTIONS) {
      if (!raFactsComplete(j))
        expect(
          sales.raLiveBlockers(j.code, "llc", "switching").length +
            sales.raLiveBlockers(j.code, "corporation", "new_entity").length +
            sales.raLiveBlockers(j.code, "corporation", "switching").length,
        ).toBeGreaterThan(0);
    }
  });

  it("formation opens only where the state's fee is verified and nothing else is owed", () => {
    vi.stubEnv("FORMATION_SALES_ALL", "true");
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "false");
    expect(sales.formationSaleCheck("TX", "llc").ok).toBe(true);
    expect(sales.formationSaleCheck("NY", "llc").ok).toBe(false);
    expect(sales.formationSaleCheck("TX", "lp").ok).toBe(false);
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "true");
    expect(sales.formationSaleCheck("TX", "llc").ok).toBe(false);
    vi.stubEnv("RA_PROVIDER_AGREEMENT_SIGNED", "true");
    vi.stubEnv("RA_FULFILLMENT_TESTED", "true");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_ENTITY", "Harborlune LLC");
    vi.stubEnv("RA_ALERTS_MAILBOX", "alerts@example.com");
    expect(sales.formationLiveBlockers("TX", "llc")).toEqual([]);
    expect(sales.formationSaleCheck("TX", "llc").ok).toBe(true);
  });

  it('only exactly "true" opens a switch', () => {
    vi.stubEnv("RA_SALES_TX", "TRUE");
    expect(sales.raSwitchOn("TX")).toBe(false);
    vi.stubEnv("RA_SALES_TX", "1");
    expect(sales.raSwitchOn("TX")).toBe(false);
  });

  it("offers the bundle only in the six annual report states", () => {
    vi.stubEnv("RA_BUNDLE_SALES", "true");
    vi.stubEnv("RA_SALES_TX", "true");
    expect([...sales.BUNDLE_STATES].sort()).toEqual([
      "CO",
      "FL",
      "MI",
      "MT",
      "PA",
      "SD",
    ]);
    expect(
      sales.bundleSaleCheck(
        "TX",
        { entityType: "llc", isForeign: false, isNonprofit: false },
        "switching",
      ).reason,
    ).toMatch(/don't file annual reports/);
  });

  it("keeps pages out of search until launched on production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    expect(sales.businessServicesPagesEnabled()).toBe(false);
    expect(sales.businessServicesIndexable()).toBe(false);
    vi.stubEnv("BUSINESS_SERVICES_PAGES", "true");
    expect(sales.businessServicesPagesEnabled()).toBe(true);
    expect(sales.businessServicesIndexable()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    expect(sales.businessServicesPagesEnabled()).toBe(true);
    expect(sales.businessServicesIndexable()).toBe(false);
  });
});

describe("provider order status", () => {
  it("payment confirms payment, never the appointment", () => {
    expect(status.PROVIDER_ORDER_TRANSITIONS.new_order).not.toContain("active");
    expect(status.PROVIDER_ORDER_TRANSITIONS.payment_confirmed).not.toContain("active");
    expect(status.providerTransitionAllowed("new_order", "payment_confirmed")).toBe(true);
  });

  it("requires a provider order number, then evidence to activate", () => {
    expect(status.transitionProblem("registered_agent", "ready_for_provider", "submitted_to_provider", {})).toMatch(/order number/);
    expect(status.transitionProblem("registered_agent", "ready_for_provider", "submitted_to_provider", { providerReference: "RAI-1" })).toBeNull();
    expect(status.transitionProblem("registered_agent", "processing", "active", { confirmedOn: "2026-11-04" })).toMatch(/Payment alone never activates/);
    expect(status.transitionProblem("registered_agent", "processing", "active", { confirmedOn: "2026-11-04", evidence: "Provider confirmation email" })).toBeNull();
  });

  it("appointments become active, filings become completed", () => {
    expect(status.doneStatusFor("registered_agent")).toBe("active");
    expect(status.doneStatusFor("change_of_agent")).toBe("completed");
    const ev = { confirmedOn: "2026-11-04", evidence: "State record" };
    expect(status.transitionProblem("change_of_agent", "processing", "active", ev)).toMatch(/Only a registered agent/);
    expect(status.transitionProblem("registered_agent", "processing", "completed", ev)).toMatch(/becomes active/);
  });

  it("termination needs the provider's confirmation and is the only way out of active", () => {
    expect(status.PROVIDER_ORDER_TRANSITIONS.active).toEqual(["cancellation_requested"]);
    expect(status.transitionProblem("registered_agent", "provider_termination_pending", "terminated", {})).toMatch(/confirmed the termination/);
  });

  it("every status has a label and only known targets", () => {
    for (const s of status.PROVIDER_ORDER_STATUSES) {
      expect(status.PROVIDER_ORDER_STATUS_LABELS[s]).toBeTruthy();
      for (const t of status.PROVIDER_ORDER_TRANSITIONS[s]) expect(status.PROVIDER_ORDER_STATUSES).toContain(t);
    }
  });

  it("the database transition function allows exactly the same moves", () => {
    const sql = readFileSync("supabase/migrations/20261029000015_business_services.sql", "utf8");
    const fn = sql.slice(sql.indexOf("function public.provider_order_transition_allowed"), sql.indexOf("else false"));
    const db: Record<string, string[]> = {};
    for (const [, from, list] of fn.matchAll(/when '([a-z_]+)' then p_to in \(([^)]*)\)/g)) {
      db[from] = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    }
    const ts = Object.fromEntries(
      Object.entries(status.PROVIDER_ORDER_TRANSITIONS)
        .filter(([, to]) => to.length > 0)
        .map(([from, to]) => [from, [...to].sort()]),
    );
    expect(db).toEqual(ts);
  });
});

describe("billing never ends the appointment", () => {
  it("failed payments notify, and review after three attempts or unpaid", () => {
    expect(status.billingAction({ previous: "active", next: "past_due", failedAttempts: 1 })).toEqual({ kind: "notify_payment_failed", operatorReview: false });
    expect(status.billingAction({ previous: "past_due", next: "past_due", failedAttempts: 3 })).toEqual({ kind: "notify_payment_failed", operatorReview: true });
    expect(status.billingAction({ previous: "past_due", next: "unpaid", failedAttempts: 1 })).toEqual({ kind: "notify_payment_failed", operatorReview: true });
  });

  it("a cancelled subscription only queues a review, once", () => {
    expect(status.billingAction({ previous: "active", next: "canceled", failedAttempts: 0 })).toEqual({ kind: "billing_ended_operator_review" });
    expect(status.billingAction({ previous: "canceled", next: "canceled", failedAttempts: 0 })).toEqual({ kind: "none" });
  });

  it("maps Stripe statuses", () => {
    expect(status.billingStatusFromStripe("trialing")).toBe("active");
    expect(status.billingStatusFromStripe("incomplete_expired")).toBe("canceled");
    expect(status.billingStatusFromStripe("paused")).toBe("incomplete");
  });

  it("sends each renewal reminder once, closest first, and none after cancelling", () => {
    const base = { periodEnd: "2027-11-01", cancelAtPeriodEnd: false, billingStatus: "active" as const, sent: [] as string[] };
    expect(status.renewalReminderDue({ ...base, today: "2027-09-15" })).toBeNull();
    expect(status.renewalReminderDue({ ...base, today: "2027-10-02" })).toEqual({ days: 30, key: "2027-11-01:30" });
    expect(status.renewalReminderDue({ ...base, today: "2027-10-02", sent: ["2027-11-01:30"] })).toBeNull();
    expect(status.renewalReminderDue({ ...base, today: "2027-10-26" })).toEqual({ days: 7, key: "2027-11-01:7" });
    expect(status.renewalReminderDue({ ...base, today: "2027-10-26", cancelAtPeriodEnd: true })).toBeNull();
    expect(status.renewalReminderDue({ ...base, today: "2027-10-26", billingStatus: "past_due" })).toBeNull();
  });

  it("flags unpaid entities for cancellation with the provider 40 days out, late under 30", () => {
    const base = { providerRenewalDate: "2027-03-01", providerCancelledAt: null, today: "2027-01-01" };
    expect(status.providerCancellationDue({ ...base, billingStatus: "active" }).due).toBe(false);
    expect(status.providerCancellationDue({ ...base, billingStatus: "unpaid" })).toEqual({ due: false, daysLeft: 59, late: false });
    expect(status.providerCancellationDue({ ...base, billingStatus: "canceled", today: "2027-01-25" })).toEqual({ due: true, daysLeft: 35, late: false });
    expect(status.providerCancellationDue({ ...base, billingStatus: "past_due", today: "2027-02-05" })).toEqual({ due: true, daysLeft: 24, late: true });
    expect(status.providerCancellationDue({ ...base, billingStatus: "unpaid", providerCancelledAt: "2027-01-20" }).due).toBe(false);
    expect(status.providerCancellationDue({ ...base, billingStatus: "unpaid", providerRenewalDate: null }).due).toBe(false);
  });
});

describe("documents", () => {
  it("service of process is urgent and escalates at 2 and 4 hours", () => {
    const at = "2026-11-01T10:00:00Z";
    const lvl = (now: string, notified: string | null = null) =>
      docs.escalationLevel({ kind: "service_of_process", availableAt: at, customerNotifiedAt: notified, now });
    expect(docs.urgencyFor("service_of_process")).toBe("urgent");
    expect(lvl("2026-11-01T11:59:00Z")).toBe("pending");
    expect(lvl("2026-11-01T12:00:00Z")).toBe("backup_operator");
    expect(lvl("2026-11-01T14:00:00Z")).toBe("owner");
    expect(lvl("2026-11-01T14:00:00Z", "2026-11-01T10:30:00Z")).toBe("none");
  });

  it("government notices escalate at 24 and 48 hours; regular mail never does", () => {
    const at = "2026-11-01T10:00:00Z";
    expect(docs.escalationLevel({ kind: "government_notice", availableAt: at, customerNotifiedAt: null, now: "2026-11-02T10:00:00Z" })).toBe("backup_operator");
    expect(docs.escalationLevel({ kind: "government_notice", availableAt: at, customerNotifiedAt: null, now: "2026-11-03T10:00:00Z" })).toBe("owner");
    expect(docs.escalationLevel({ kind: "regular_mail", availableAt: at, customerNotifiedAt: null, now: "2026-12-01T10:00:00Z" })).toBe("none");
  });

  it("charges only regular mail beyond the three included items", () => {
    expect(docs.INCLUDED_REGULAR_MAIL_PER_YEAR).toBe(3);
    expect(docs.mailItemBillable("regular_mail", 3)).toBe(false);
    expect(docs.mailItemBillable("regular_mail", 4)).toBe(true);
    expect(docs.mailItemBillable("service_of_process", 10)).toBe(false);
    expect(docs.mailItemBillable("government_notice", 10)).toBe(false);
  });

  it("measures minutes between timestamps", () => {
    expect(docs.minutesBetween("2026-11-01T10:00:00Z", "2026-11-01T12:30:00Z")).toBe(150);
    expect(docs.minutesBetween(null, "2026-11-01T12:30:00Z")).toBeNull();
  });
});

describe("manual provider", () => {
  it("never places, cancels or receives anything by itself", async () => {
    const p = new ManualRegisteredAgentsIncProvider();
    await expect(Promise.resolve().then(() => p.parseWebhook())).rejects.toBeInstanceOf(ManualFulfillmentRequired);
    const src = readFileSync("src/lib/registered-agent/manual-provider.ts", "utf8");
    expect(src).not.toMatch(/fetch\(/);
  });

  it("the entry sheet calls out what is missing before an order is placed", () => {
    const sheet = providerEntrySheet({
      kind: "change_of_agent",
      legalName: "Acme LLC",
      stateName: "Texas",
      entityTypeLabel: "LLC",
      entityNumber: null,
      contactName: "Jo Smith",
      contactPhone: "",
      contactAddress: "1 Main St, Austin, TX",
      currentAgentName: null,
    });
    // The current agent is read from the state record, so it is never a blocker.
    expect(sheet.missing).toEqual(["State entity number", "Contact phone"]);
    expect(sheet.rows.find((r) => r.label === "Current registered agent")?.value).toMatch(/state record/);
    const ra = providerEntrySheet({ ...{ kind: "registered_agent" as const }, legalName: "Acme LLC", stateName: "Texas", entityTypeLabel: "LLC", entityNumber: null, contactName: "Jo", contactPhone: "512 555 0100", contactAddress: "1 Main St", currentAgentName: null });
    expect(ra.missing).toEqual([]);
    expect(ra.rows.map((r) => r.label)).not.toContain("Current registered agent");
  });
});

describe("checkout input", () => {
  const good = {
    businessId: "b1",
    service: "registered_agent",
    situation: "switching",
    currentAgentName: "Old Agent Co",
    contactName: "Jo Smith",
    contactPhone: "(512) 555-0100",
    contactAddress: "100 Congress Ave, Austin, TX 78701",
    acceptedTerms: "on",
  };

  it("accepts a complete switch", () => {
    const r = validateServiceCheckoutInput(good);
    expect(r.ok).toBe(true);
  });

  it("collects the communications contact the provider can ask for", () => {
    expect(validateServiceCheckoutInput({ ...good, contactName: "" }).ok).toBe(false);
    expect(validateServiceCheckoutInput({ ...good, contactPhone: "call me" }).ok).toBe(false);
    expect(validateServiceCheckoutInput({ ...good, contactAddress: "PO Box 12, Austin TX" })).toEqual({ ok: false, error: "Enter a street address, not a PO box." });
    expect(validateServiceCheckoutInput({ ...good, contactAddress: "P.O. Box 12, Austin TX" }).ok).toBe(false);
  });

  it("doesn't ask whether this is a switch, makes the current agent optional, and always needs renewal consent", () => {
    const r = validateServiceCheckoutInput({ ...good, situation: undefined, currentAgentName: "" });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.currentAgentName).toBeNull();
    expect(r.ok && "situation" in r.value).toBe(false);
    expect(validateServiceCheckoutInput({ ...good, currentAgentName: "x".repeat(201) }).ok).toBe(false);
    expect(validateServiceCheckoutInput({ ...good, acceptedTerms: undefined })).toEqual({ ok: false, error: "Please agree to the terms to continue." });
  });

  it("refuses services that aren't orderable", () => {
    expect(validateServiceCheckoutInput({ ...good, service: "ein_assistance" }).ok).toBe(false);
    expect(validateServiceCheckoutInput({ ...good, service: "formation" }).ok).toBe(false);
  });
});
