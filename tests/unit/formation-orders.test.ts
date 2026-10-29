import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Formation and registered agent orders for businesses not formed yet: only what the filing
 * needs is asked before payment, the add-on is never assumed, and the operator's entry sheet
 * shows every detail the provider needs.
 */

vi.mock("server-only", () => ({}));
const { validateFormationInput } = await import("@/lib/services/formation");
const { validateServiceCheckoutInput } = await import("@/lib/services/orders");
const { providerEntrySheet } =
  await import("@/lib/registered-agent/manual-provider");

afterEach(() => vi.unstubAllEnvs());

const good = {
  stateCode: "tx",
  entityType: "llc",
  businessName: "Acme  Widgets LLC",
  principalAddress: "1 Main St, Austin, TX 78701",
  owners: "Jo Smith",
  contactName: "Jo Smith",
  contactPhone: "(512) 555-0100",
};

describe("formation order details", () => {
  it("accepts the few details a filing needs, member-managed by default", () => {
    const r = validateFormationInput(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      stateCode: "TX",
      entityType: "llc",
      businessName: "Acme Widgets LLC",
      management: "member",
      addRegisteredAgent: false,
    });
  });

  it("refuses a PO box, a missing owner and an unknown state or type", () => {
    expect(
      validateFormationInput({
        ...good,
        principalAddress: "PO Box 9, Austin TX",
      }),
    ).toEqual({ ok: false, error: "Enter a street address, not a PO box." });
    expect(validateFormationInput({ ...good, owners: "" }).ok).toBe(false);
    expect(validateFormationInput({ ...good, stateCode: "ZZ" }).ok).toBe(false);
    expect(validateFormationInput({ ...good, entityType: "lp" }).ok).toBe(
      false,
    );
  });

  it("corporations have no management choice", () => {
    const r = validateFormationInput({
      ...good,
      entityType: "corporation",
      management: "manager",
    });
    expect(r.ok && r.value.management).toBeNull();
  });

  it("the registered agent add-on needs its own renewal consent", () => {
    expect(
      validateFormationInput({ ...good, addRegisteredAgent: "on" }),
    ).toEqual({
      ok: false,
      error: "Please confirm the yearly renewal to continue.",
    });
    const r = validateFormationInput({
      ...good,
      addRegisteredAgent: "on",
      acceptedTerms: "on",
    });
    expect(r.ok && r.value.addRegisteredAgent).toBe(true);
  });
});

describe("registered agent order details", () => {
  it("keeps owner details only when given", () => {
    const base = {
      businessId: "x",
      service: "registered_agent",
      contactName: "Jo",
      contactPhone: "512 555 0100",
      contactAddress: "1 Main St, Cheyenne",
      acceptedTerms: "on",
    };
    const without = validateServiceCheckoutInput(base);
    expect(without.ok && without.value.beneficialOwners).toBeNull();
    const withOwners = validateServiceCheckoutInput({
      ...base,
      beneficialOwners: "Jo Smith, 2 Elm St, Cheyenne WY",
    });
    expect(withOwners.ok && withOwners.value.beneficialOwners).toBe(
      "Jo Smith, 2 Elm St, Cheyenne WY",
    );
  });
});

describe("operator entry sheet", () => {
  const common = {
    legalName: "Acme LLC",
    stateName: "Texas",
    entityTypeLabel: "LLC",
    entityNumber: null,
    contactName: "Jo",
    contactPhone: "512 555 0100",
    contactAddress: "1 Main St",
    currentAgentName: null,
  };

  it("shows the formation details and flags missing ones", () => {
    const sheet = providerEntrySheet({
      ...common,
      kind: "formation",
      details: {
        principal_address: "1 Main St",
        owners: "Jo Smith",
        management: "manager",
        registered_agent: "Customer names their own agent",
      },
    });
    expect(sheet.missing).toEqual([]);
    expect(sheet.rows).toContainEqual({ label: "Members", value: "Jo Smith" });
    expect(sheet.rows).toContainEqual({
      label: "Management",
      value: "Manager-managed",
    });
    expect(
      providerEntrySheet({ ...common, kind: "formation", details: {} }).missing,
    ).toEqual(["Principal address", "Members"]);
  });

  it("shows owner details for the provider where it needs them", () => {
    const sheet = providerEntrySheet({
      ...common,
      kind: "registered_agent",
      details: { beneficial_owners: "Jo Smith, 2 Elm St" },
    });
    expect(sheet.rows).toContainEqual({
      label: "Beneficial owners",
      value: "Jo Smith, 2 Elm St",
    });
  });
});
