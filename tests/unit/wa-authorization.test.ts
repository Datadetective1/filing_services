import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Washington authorization and operator path (rule v2): the customer confirms the exact
 * packet the filing agent certifies, a registered-agent change carries the new agent's
 * own consent, edits after signing force a new signature, the operator records a
 * packet-vs-portal checkpoint, and the $25 delinquency fee never follows from a date.
 */

const gte = vi.fn();
vi.mock("@/lib/supabase/admin", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "in", "not", "order", "limit"]) chain[m] = () => chain;
  chain.gte = (col: string, value: string) => {
    gte(col, value);
    return chain;
  };
  chain.maybeSingle = async () => ({ data: null, error: null });
  return { createAdminClient: () => chain };
});
vi.mock("server-only", () => ({}));

const { evaluateFees } = await import("@/lib/compliance/fees");
const { findRule, stateAuthorizationForState } = await import("@/lib/compliance/registry");
const { WA_CERTIFICATION_TEXT, WA_RA_CONSENT_TEXT } = await import("@/lib/compliance/states/washington");
const { authorizationText, changedSinceSigned } = await import("@/lib/filings/customer");
const { comparisonCheckpointBlocker, readyToFileBlockers } = await import("@/lib/filings/operations");
const { buildFilingPacket, packetSections, packetSha256, registeredAgentConsentRequired } = await import("@/lib/filings/packet");
const { validateAll } = await import("@/lib/intake/validate");
const { knownStateStatus, MAX_STATUS_AGE_DAYS } = await import("@/lib/registry/state-status");

afterEach(() => vi.unstubAllEnvs());

const rule = findRule("WA", "llc")!;
const schema = rule.intake;
const wa = stateAuthorizationForState("WA")!;

/** A complete Washington LLC answer set: nothing changes, noncommercial agent. */
function answers(over: Record<string, unknown> = {}) {
  return {
    legal_name: "Cascade Test Bakery LLC",
    entity_number: "604 111 222",
    jurisdiction_of_formation: "Washington",
    nature_of_business: "Retail bakery",
    registered_agent_change: "no",
    registered_agent_type: "noncommercial",
    registered_agent_name: "Dana Rivers",
    registered_office: { line1: "100 Pine St", city: "Seattle", region: "WA", postal_code: "98101" },
    registered_agent_email: "",
    principal_office: { line1: "100 Pine St", city: "Seattle", region: "WA", postal_code: "98101" },
    state_notice_email: "owner@example.com",
    governors: [{ name: "Dana Rivers", title: "Member" }],
    ci_owns_real_property: "no",
    ci_transfer_16: "no",
    ci_transfer_controlling: "",
    ci_return_filed: "",
    changes_since_last_report: "no",
    ...over,
  };
}

describe("Washington v2 intake follows the current form", () => {
  it("is version 2 with the state's certification and consent text, verbatim and sourced", () => {
    expect(rule.version).toBe(2);
    expect(wa.auth.certificationText).toBe(WA_CERTIFICATION_TEXT);
    expect(WA_CERTIFICATION_TEXT).toBe("This document is hereby executed under penalty of law and is to the best of my knowledge, true and correct.");
    expect(wa.auth.registeredAgentConsent?.consentText).toBe(WA_RA_CONSENT_TEXT);
    const keys = rule.sources.map((s) => s.factKey);
    for (const k of ["certification", "ra_consent", "ra_consent_rule", "ra_consent_text", "controlling_interest"]) expect(keys).toContain(k);
    expect(rule.sources.find((s) => s.factKey === "ra_consent")!.quote).toContain("required if any changes other than contact info is made");
  });

  it("a complete no-change answer set is valid; the UBI is required", () => {
    expect(validateAll(schema, answers()).ok).toBe(true);
    const r = validateAll(schema, answers({ entity_number: "" }));
    expect(r.ok).toBe(false);
    expect(r.errors.entity_number).toBeTruthy();
  });

  it("controlling-interest 2a and 3 are asked only when the form asks them, and stale answers are dropped", () => {
    expect(validateAll(schema, answers({ ci_transfer_16: "yes" })).errors.ci_transfer_controlling).toBeTruthy();
    const r = validateAll(schema, answers({ ci_transfer_16: "yes", ci_transfer_controlling: "yes", ci_owns_real_property: "yes" }));
    expect(r.errors.ci_return_filed).toBeTruthy();
    const stale = validateAll(schema, answers({ ci_transfer_16: "no", ci_transfer_controlling: "yes", ci_return_filed: "yes" }));
    expect(stale.ok).toBe(true);
    expect(stale.values.ci_transfer_controlling).toBe("");
    expect(stale.values.ci_return_filed).toBe("");
  });

  it("a commercial agent needs no address; a noncommercial one does, plus an email when its details change", () => {
    expect(validateAll(schema, answers({ registered_agent_type: "commercial", registered_office: undefined })).ok).toBe(true);
    expect(Object.keys(validateAll(schema, answers({ registered_office: undefined })).errors).some((k) => k.startsWith("registered_office"))).toBe(true);
    expect(validateAll(schema, answers({ registered_agent_change: "new" })).errors.registered_agent_email).toBeTruthy();
    expect(validateAll(schema, answers({ registered_agent_change: "new", registered_agent_email: "agent@example.com" })).ok).toBe(true);
  });
});

describe("filing packet in CCFS order", () => {
  it("lists every CCFS section in the portal's order with the customer's values", () => {
    const rows = buildFilingPacket(wa.runbook, schema, validateAll(schema, answers()).values);
    expect(packetSections(rows).map((s) => s.section)).toEqual([
      "Business Information",
      "Registered Agent",
      "Principal Office",
      "Governors",
      "Nature of Business",
      "Effective Date",
      "Controlling Interest",
      "Return Address for this Filing",
      "Upload additional documents",
      "Authorized Person",
    ]);
    const byField = new Map(rows.map((r) => [r.stateField, r]));
    expect(byField.get("UBI number")!.value).toBe("604 111 222");
    expect(byField.get("Governors")!.value).toBe("Dana Rivers, Member");
    expect(byField.get("Effective date")!.value).toBe("Date of Filing");
    expect(byField.get("1. Owns real property in Washington")!.value).toBe("No");
    expect(byField.get("2a. Controlling-interest transfer in the past 36 months")!.notApplicable).toBe(true);
    expect(byField.get("Registered agent email")!.notApplicable).toBe(true);
  });

  it("the packet hash changes with any value, so a signed packet can't be silently altered", () => {
    const a = buildFilingPacket(wa.runbook, schema, validateAll(schema, answers()).values);
    const b = buildFilingPacket(wa.runbook, schema, validateAll(schema, answers({ nature_of_business: "Wholesale bakery" })).values);
    expect(packetSha256(a)).not.toBe(packetSha256(b));
    expect(packetSha256(a)).toBe(packetSha256(buildFilingPacket(wa.runbook, schema, validateAll(schema, answers()).values)));
  });
});

describe("registered agent consent", () => {
  it("is required only for a new agent or a new agent street address, never for contact-only changes", () => {
    expect(registeredAgentConsentRequired(wa.auth, answers())).toBe(false);
    expect(registeredAgentConsentRequired(wa.auth, answers({ registered_agent_change: "contact" }))).toBe(false);
    expect(registeredAgentConsentRequired(wa.auth, answers({ registered_agent_change: "new" }))).toBe(true);
    // Pennsylvania has no state-specific authorization.
    expect(stateAuthorizationForState("PA")).toBeNull();
  });
});

describe("authorization text", () => {
  const base = { businessName: "Cascade Test Bakery LLC", stateName: "Washington", filingName: "Annual Report", brand: "Filewell" };

  it("Washington names the filing agent and quotes the state's certification", () => {
    const t = authorizationText({ ...base, state: { filingAgent: "Amary Coulibaly, sole proprietor", certificationText: WA_CERTIFICATION_TEXT } });
    expect(t).toContain("I authorize Amary Coulibaly, sole proprietor, doing business as Filewell, and its personnel");
    expect(t).toContain("I have reviewed every item of the Washington filing information shown above");
    expect(t).toContain(`“${WA_CERTIFICATION_TEXT}”`);
    expect(t).toContain("I will review and sign again before it is filed");
  });

  it("Pennsylvania's wording is unchanged", () => {
    const t = authorizationText({ ...base, stateName: "Pennsylvania" });
    expect(t).toContain("I authorize Filewell and its personnel");
    expect(t).not.toContain("doing business as");
    expect(t).not.toContain("penalty of law");
  });
});

describe("changes after authorization", () => {
  it("lists exactly the fields that differ from what the customer signed", () => {
    const signed = validateAll(schema, answers()).values;
    expect(changedSinceSigned(schema, signed, signed)).toEqual([]);
    const now = validateAll(schema, answers({ registered_agent_name: "Lee Park", nature_of_business: "Cafe" })).values;
    expect(changedSinceSigned(schema, signed, now).sort()).toEqual(["nature_of_business", "registered_agent_name"]);
  });
});

describe("operator gates", () => {
  const ready = {
    schema,
    answers: answers(),
    intakeComplete: true,
    authorizationSha256: "x".repeat(64),
    order: { status: "paid", payment_mode: "live" },
    ruleVerificationStatus: "verified",
    production: true,
  };
  const sa = { factsCertified: true, consentRequired: false, consentMode: null, consentDocumentOnFile: false };

  it("refuses to file when the customer's answers changed after signing", () => {
    const blockers = readyToFileBlockers({ ...ready, stateAuthorization: sa });
    expect(blockers.some((b) => b.includes("changed after they signed"))).toBe(true);
  });

  it("refuses without the packet confirmation", () => {
    const b = readyToFileBlockers({ ...ready, authorizationSha256: null, stateAuthorization: { ...sa, factsCertified: false } });
    expect(b.some((x) => x.includes("No customer authorization"))).toBe(true);
    // With an authorization on record but no packet confirmation (older wording):
    const withAuth = readyToFileBlockers({ ...ready, stateAuthorization: { ...sa, factsCertified: false } });
    expect(withAuth.some((x) => x.includes("full filing packet"))).toBe(true);
  });

  it("a new registered agent blocks filing until the consent is on file; it is never assumed", () => {
    const need = { ...sa, consentRequired: true };
    const pending = readyToFileBlockers({ ...ready, stateAuthorization: { ...need, consentMode: "agent_to_sign" } });
    expect(pending.some((x) => x.includes("signed consent isn't on file"))).toBe(true);
    const none = readyToFileBlockers({ ...ready, stateAuthorization: { ...need, consentMode: null } });
    expect(none.some((x) => x.includes("signed consent isn't on file"))).toBe(true);
    const uploaded = readyToFileBlockers({ ...ready, stateAuthorization: { ...need, consentMode: "agent_to_sign", consentDocumentOnFile: true } });
    expect(uploaded.some((x) => x.includes("consent"))).toBe(false);
    const self = readyToFileBlockers({ ...ready, stateAuthorization: { ...need, consentMode: "signer_is_agent" } });
    expect(self.some((x) => x.includes("consent"))).toBe(false);
  });

  it("Mark submitted needs a comparison checkpoint recorded after the latest signature, for the same answers", () => {
    const auth = { answers_sha256: "a".repeat(64), created_at: "2026-10-05T10:00:00Z" };
    expect(comparisonCheckpointBlocker({ required: false, authorization: auth, checkpoint: null })).toBeNull();
    expect(comparisonCheckpointBlocker({ required: true, authorization: auth, checkpoint: null })).toMatch(/comparison checkpoint/);
    expect(
      comparisonCheckpointBlocker({ required: true, authorization: auth, checkpoint: { answers_sha256: auth.answers_sha256, created_at: "2026-10-05T09:00:00Z" } }),
    ).toMatch(/comparison checkpoint/);
    expect(
      comparisonCheckpointBlocker({ required: true, authorization: auth, checkpoint: { answers_sha256: "b".repeat(64), created_at: "2026-10-05T11:00:00Z" } }),
    ).toMatch(/comparison checkpoint/);
    expect(
      comparisonCheckpointBlocker({ required: true, authorization: auth, checkpoint: { answers_sha256: auth.answers_sha256, created_at: "2026-10-05T11:00:00Z" } }),
    ).toBeNull();
  });
});

describe("timely vs delinquent: the $25 never follows from Filewell's date", () => {
  const ctx = { isNonprofit: false, dueDate: "2026-10-31" };
  const status = (value: string) => ({ value, source: "wa_ccfs_export", checkedAt: "2026-11-10T12:00:00Z" });

  it("timely: $70, the $25 only listed as possible while the status is unknown", () => {
    const e = evaluateFees(rule, { ...ctx, filingDate: "2026-10-20", status: null });
    expect(e.totalCents).toBe(7000);
    expect(e.due.some((l) => l.kind === "government_late_fee")).toBe(false);
  });

  it("past the date by Filewell's clock, status unknown or Active: still $70", () => {
    expect(evaluateFees(rule, { ...ctx, filingDate: "2026-11-15", status: null }).totalCents).toBe(7000);
    const active = evaluateFees(rule, { ...ctx, filingDate: "2026-11-15", status: status("Active") });
    expect(active.totalCents).toBe(7000);
    expect(active.due.some((l) => l.kind === "government_late_fee")).toBe(false);
  });

  it("delinquent per Washington's own dated record: $70 + $25", () => {
    const e = evaluateFees(rule, { ...ctx, filingDate: "2026-11-15", status: status("Delinquent") });
    expect(e.totalCents).toBe(9500);
  });

  it("a status older than the freshness window is never read (it could have changed)", async () => {
    const now = new Date("2026-11-15T12:00:00Z");
    await knownStateStatus("WA", "604111222", now);
    expect(gte).toHaveBeenCalledWith("status_checked_at", new Date(now.getTime() - MAX_STATUS_AGE_DAYS * 86_400_000).toISOString());
    expect(MAX_STATUS_AGE_DAYS).toBe(14);
  });
});
