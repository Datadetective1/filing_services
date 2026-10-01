import { afterEach, describe, expect, it, vi } from "vitest";
import { site } from "@/config/site";
import { formatLongDate } from "@/lib/domain/dates";
import { rulesForState } from "@/lib/compliance/registry";
import { AUTHORIZATION_TERMS_VERSION, authorizationBusinessName, authorizationText } from "@/lib/filings/customer";
import { stateFeeSentence } from "@/lib/seo/content";
import { LEGAL_LAST_UPDATED, legalEntityText, operatorName, postalAddressText } from "@/lib/seo/legal";

const input = { businessName: "Example Bakery LLC", stateName: "Pennsylvania", filingName: "Annual Report", brand: "Filewell" };

describe("authorization text", () => {
  const text = authorizationText(input);

  it("uses the v2 wording version", () => {
    expect(AUTHORIZATION_TERMS_VERSION).toBe(`${LEGAL_LAST_UPDATED}.v2`);
  });

  it("changes its version whenever the legal documents' date (named in the text) changes", () => {
    expect(AUTHORIZATION_TERMS_VERSION.startsWith(`${LEGAL_LAST_UPDATED}.v`)).toBe(true);
    expect(text).toContain(formatLongDate(AUTHORIZATION_TERMS_VERSION.split(".v")[0]));
  });

  it("pays the state fee from the order, not from a payment 'today'", () => {
    expect(text).toContain("from the amount I pay for this order.");
    expect(text).not.toMatch(/today/i);
  });

  it("records agreement to the Terms of Service and Refund Policy with their date", () => {
    expect(text).toContain(`I agree to Filewell's Terms of Service and Refund Policy, last updated ${formatLongDate(LEGAL_LAST_UPDATED)}.`);
  });

  it("keeps the limited scope and the private-service disclosure", () => {
    expect(text).toContain("I confirm that I am authorized to act on behalf of Example Bakery LLC.");
    expect(text).toContain("electronically signing and submitting the Pennsylvania Annual Report");
    expect(text).toContain("is a private filing service, is not a government agency, does not provide legal advice");
    expect(text).toContain("I could instead file directly with the state.");
  });

  it("is deterministic, so the text shown before signing is the text stored", () => {
    expect(authorizationText({ ...input })).toBe(text);
  });
});

describe("authorizationBusinessName", () => {
  it("names the legal name being filed, not the name typed at lookup", () => {
    expect(authorizationBusinessName({ legal_name: "Exmaple Bakery" }, { legal_name: "Example Bakery LLC" })).toBe("Example Bakery LLC");
  });

  it("falls back to the business record when the answer is missing or blank", () => {
    expect(authorizationBusinessName({ legal_name: "Example Bakery LLC" }, {})).toBe("Example Bakery LLC");
    expect(authorizationBusinessName({ legal_name: "Example Bakery LLC" }, { legal_name: "   " })).toBe("Example Bakery LLC");
    expect(authorizationBusinessName(null, {})).toBe("");
  });

  it("normalizes whitespace the way intake validation does", () => {
    expect(authorizationBusinessName(null, { legal_name: "  Example   Bakery LLC " })).toBe("Example Bakery LLC");
  });
});

describe("legal page values", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses a valid ISO last-updated date", () => {
    expect(LEGAL_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shows bracketed placeholders, never invented values, while the entity and address are unset", () => {
    if (site.legalEntityConfigured) return; // a developer shell with the real value set
    expect(legalEntityText()).toMatch(/^\[.*to be confirmed\]$/);
    expect(operatorName()).toBe(site.name);
    if (site.postalAddress === null) expect(postalAddressText()).toBe(`available on request from ${site.supportEmail}`);
  });

  it("uses the configured legal entity and postal address once set", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEGAL_ENTITY", "Example Operating Co LLC");
    vi.stubEnv("NEXT_PUBLIC_POSTAL_ADDRESS", "PO Box 1, Pittsburgh, PA 15201");
    vi.resetModules();
    const legal = await import("@/lib/seo/legal");
    expect(legal.legalEntityText()).toBe("Example Operating Co LLC");
    expect(legal.operatorName()).toBe("Example Operating Co LLC");
    expect(legal.postalAddressText()).toBe("PO Box 1, Pittsburgh, PA 15201");
  });

  it("omits the governing law (no placeholder, no guess) until the owner chooses it, then uses the chosen value", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOVERNING_LAW", "");
    vi.resetModules();
    expect((await import("@/lib/seo/legal")).governingLawText()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_GOVERNING_LAW", "the Commonwealth of Pennsylvania");
    vi.resetModules();
    expect((await import("@/lib/seo/legal")).governingLawText()).toBe("the Commonwealth of Pennsylvania");
  });
});

describe("stateFeeSentence", () => {
  const rules = rulesForState("PA");

  it("never reads 'State fee: No state fee.' for a zero-fee entity", () => {
    const zero = rules.find((r) => r.stateFeeCents === 0);
    expect(zero).toBeDefined();
    expect(stateFeeSentence(zero!)).toBe("No state filing fee.");
  });

  it("states the fee when there is one", () => {
    const paid = rules.find((r) => r.entityType === "llc");
    expect(paid).toBeDefined();
    expect(stateFeeSentence(paid!)).toMatch(/^State fee: \$7/);
  });
});
