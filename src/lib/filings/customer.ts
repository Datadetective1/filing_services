import "server-only";
import { businessNow } from "@/lib/domain/clock";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { absoluteUrl } from "@/config/site";
import { trackServer } from "@/lib/analytics/server";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { stableStringify } from "@/lib/compliance/hash";
import { findRule, getJurisdiction, isRuleSellable } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { todayInTimeZone } from "@/lib/domain/dates";
import { currentFilingPeriod, filingWindowOpensOn, isFilingWindowOpen, type FilingPeriod } from "@/lib/domain/deadlines";
import { formatLongDate } from "@/lib/domain/dates";
import { CUSTOMER_EDITABLE_STATUSES, FILED_STATUSES, type FilingStatus } from "@/lib/domain/filing-status";
import { buildQuote, resolveServicePrice, type Quote } from "@/lib/domain/pricing";
import { evaluateFees, feeSourceFromSnapshot, quoteGovernmentLines } from "@/lib/compliance/fees";
import { knownStateStatus } from "@/lib/registry/state-status";
import type { EntityType } from "@/lib/domain/types";
import { buildPrefill, sameValue } from "@/lib/intake/prefill";
import { loadStateRecord } from "@/lib/registry/state-records";
import { validateAll, validateSection, type IntakeAnswers, type Person, type RegisteredOffice, type Address } from "@/lib/intake/validate";
import { getPaymentProvider, requiresApprovedPrice } from "@/lib/payments";
import { checkoutDescription, checkoutLineItemName } from "@/lib/payments/checkout-text";
import type { PaymentProvider, SessionStatus } from "@/lib/payments/types";
import { LEGAL_LAST_UPDATED } from "@/lib/seo/legal";
import { afterPaymentSucceeded } from "@/lib/payments/process-event";
import { notifyStaffOfCustomerMessage } from "@/lib/notifications/staff";
import { ensureRemindersForRequirement, rollForwardRequirement } from "@/lib/reminders/engine";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash, userAgent } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildFilingPacket, packetSha256, registeredAgentConsentRequired, type PacketRow, type RegisteredAgentConsent } from "./packet";
import { getCurrentRuleVersion, listActivePricesAdmin } from "./rules-db";

export class FilingError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "not_allowed" | "invalid" | "unavailable" = "invalid",
  ) {
    super(message);
  }
}

/**
 * Version of the signed wording: `<legal documents date>.v<template revision>`. The text
 * names the Terms/Refund Policy date, so the date part follows LEGAL_LAST_UPDATED
 * automatically; bump the `.vN` suffix whenever the template wording below changes.
 * Stored rows keep their own text and version.
 */
export const AUTHORIZATION_TERMS_VERSION = `${LEGAL_LAST_UPDATED}.v2`;

/**
 * The business name the authorization names: the legal name being filed (the validated
 * intake answer), falling back to the business record. businesses.legal_name is only
 * updated after signing, so it can still hold the name typed at lookup. The Review page
 * must use this too, so the text shown before signing is the text stored.
 */
export function authorizationBusinessName(business: { legal_name?: unknown } | null | undefined, answers: IntakeAnswers): string {
  const answered = typeof answers.legal_name === "string" ? answers.legal_name.replace(/\s+/g, " ").trim() : "";
  if (answered) return answered;
  return typeof business?.legal_name === "string" ? business.legal_name.trim() : "";
}

export interface StateAuthorizationTextInput {
  /** Who files and certifies, e.g. "Amary Coulibaly, sole proprietor". */
  filingAgent: string;
  /** The state's own certification wording, verbatim. */
  certificationText: string;
}

/** Suffix on terms_version when the state-specific paragraph is part of the signed text. */
export const STATE_AUTHORIZATION_REVISION = "state1";

export function authorizationText(input: {
  businessName: string;
  stateName: string;
  filingName: string;
  brand: string;
  /** States that require the customer to confirm the full packet the agent will certify (Washington). */
  state?: StateAuthorizationTextInput;
}) {
  const who = input.state ? `${input.state.filingAgent}, doing business as ${input.brand},` : input.brand;
  const statePart = input.state
    ? `I have reviewed every item of the ${input.stateName} filing information shown above, in the order the state's form asks for it, and I confirm that each item is true, correct and complete. ` +
      `I understand that ${input.state.filingAgent} will sign the ${input.filingName} as the business's authorized person and, relying on my confirmation, will make the state's certification: “${input.state.certificationText}” ` +
      `If any of this information changes, I will review and sign again before it is filed. `
    : "";
  return (
    `I confirm that I am authorized to act on behalf of ${input.businessName}. ` +
    `I authorize ${who} and its personnel to act as the business's authorized representative for the limited purpose of preparing, electronically signing and submitting the ${input.stateName} ${input.filingName} described above, using the information I provided, and to pay the state filing fee on the business's behalf from the amount I pay for this order. ` +
    statePart +
    `I attest that the information I provided is true, correct and complete to the best of my knowledge. I understand that ${input.brand} is a private filing service, is not a government agency, does not provide legal advice, and that I could instead file directly with the state. ` +
    `I agree to ${input.brand}'s Terms of Service and Refund Policy, last updated ${formatLongDate(LEGAL_LAST_UPDATED)}.`
  );
}

/** The state-specific signing requirements for a filing, from the rule registry (null for most states). */
export function stateAuthorizationFor(stateCode: string, business: { entity_type?: unknown; is_foreign?: unknown }) {
  const rule = findRule(stateCode, business.entity_type as EntityType, "annual_report", Boolean(business.is_foreign));
  if (!rule?.stateAuthorization || !rule.operatorRunbook) return null;
  return { rule, auth: rule.stateAuthorization, runbook: rule.operatorRunbook };
}

/** The filing agent named in a state-specific authorization: the configured legal operator. */
export function filingAgentName(brand: string, legalEntity: string, configured: boolean): string {
  return configured ? legalEntity : `${brand} (operator to be confirmed)`;
}

// ---------------------------------------------------------------------------
// Business + requirement
// ---------------------------------------------------------------------------

export interface AddBusinessInput {
  legalName: string;
  stateCode: string;
  entityType: EntityType;
  isForeign: boolean;
  isNonprofit: boolean;
  formationDate: string | null;
  entityNumber: string | null;
  homeJurisdiction: string | null;
  alreadyFiledThisYear: boolean;
}

export function periodFor(rule: ComplianceRuleDef, input: { formationDate: string | null; alreadyFiledThisYear: boolean }, now = businessNow()): FilingPeriod {
  const tz = getJurisdiction(rule.stateCode)?.timezone ?? "America/New_York";
  const today = todayInTimeZone(tz, now);
  const todayYear = Number(today.slice(0, 4));
  return currentFilingPeriod(rule, {
    today,
    formationDate: input.formationDate,
    lastFiledYear: input.alreadyFiledThisYear ? todayYear : null,
  });
}

/** Add a business to the user's account and open its current filing requirement (+ reminders). */
export async function addBusiness(user: SessionUser, input: AddBusinessInput) {
  const rule = findRule(input.stateCode, input.entityType, "annual_report", input.isForeign);
  if (!rule || rule.verificationStatus !== "verified") {
    throw new FilingError("We don't support filings for this state and entity type yet.", "unavailable");
  }
  const current = await getCurrentRuleVersion(rule.ruleKey);
  if (!current) throw new FilingError("Filing rules are not available right now.", "unavailable");

  const userDb = await createClient();
  const { data: business, error } = await userDb
    .from("businesses")
    .insert({
      owner_user_id: user.id,
      legal_name: input.legalName,
      state_code: input.stateCode,
      entity_type: input.entityType,
      is_foreign: input.isForeign,
      is_nonprofit: input.isNonprofit,
      formation_date: input.formationDate,
      state_entity_number: input.entityNumber,
      home_jurisdiction: input.homeJurisdiction,
      standing: "unknown",
      standing_source: "none",
    })
    .select("id")
    .single();
  if (error || !business) throw new FilingError(`Could not save the business: ${error?.message ?? "unknown"}`);

  const period = periodFor(rule, input);
  const db = createAdminClient();

  if (input.alreadyFiledThisYear) {
    // Record the current year as filed elsewhere so reminders start with next year's report.
    await db.from("filing_requirements").insert({
      business_id: business.id,
      owner_user_id: user.id,
      rule_id: current.ruleId,
      period_year: period.periodYear - 1,
      due_date: `${period.periodYear - 1}${period.dueDate.slice(4)}`,
      status: "filed_elsewhere",
      resolved_at: new Date().toISOString(),
    });
  }

  const { data: requirement, error: reqError } = await db
    .from("filing_requirements")
    .insert({
      business_id: business.id,
      owner_user_id: user.id,
      rule_id: current.ruleId,
      period_year: period.periodYear,
      due_date: period.dueDate,
      status: "open",
    })
    .select("id")
    .single();
  if (reqError || !requirement) throw new FilingError(`Could not create the requirement: ${reqError?.message}`);

  await ensureRemindersForRequirement(requirement.id);
  await audit({
    actorUserId: user.id,
    actorType: "customer",
    action: "business.created",
    entityType: "business",
    entityId: business.id,
    after: { state_code: input.stateCode, entity_type: input.entityType, period_year: period.periodYear },
  });

  return { businessId: business.id as string, requirementId: requirement.id as string, period, rule };
}

// ---------------------------------------------------------------------------
// Filing draft
// ---------------------------------------------------------------------------

/** Create (or return the existing) filing draft for a business's open requirement. */
export async function startFiling(user: SessionUser, businessId: string): Promise<string> {
  const userDb = await createClient();
  const { data: business } = await userDb
    .from("businesses")
    .select("id, legal_name, state_code, entity_type, is_foreign, is_nonprofit, state_entity_number, home_jurisdiction")
    .eq("id", businessId)
    .eq("owner_user_id", user.id) // RLS also admits staff; customer actions act only on the caller's own rows
    .maybeSingle();
  if (!business) throw new FilingError("Business not found", "not_found");

  const rule = findRule(business.state_code, business.entity_type as EntityType, "annual_report", business.is_foreign);
  if (!rule || !isRuleSellable(rule)) throw new FilingError("We can't file this yet.", "unavailable");
  const current = await getCurrentRuleVersion(rule.ruleKey);
  if (!current) throw new FilingError("Filing rules are not available right now.", "unavailable");

  const { data: requirement } = await userDb
    .from("filing_requirements")
    .select("id, period_year, due_date, status")
    .eq("business_id", businessId)
    .eq("owner_user_id", user.id)
    .eq("rule_id", current.ruleId)
    .eq("status", "open")
    .order("period_year", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!requirement) throw new FilingError("There's no open filing for this business right now.", "not_allowed");

  // Never take payment for a report the state won't accept yet.
  const today = todayInTimeZone(getJurisdiction(business.state_code)?.timezone ?? "America/New_York");
  if (!isFilingWindowOpen(rule, requirement.period_year, requirement.due_date, today)) {
    const opens = formatLongDate(filingWindowOpensOn(rule, requirement.period_year, requirement.due_date));
    throw new FilingError(`Filing for the ${requirement.period_year} report opens ${opens}. We'll remind you before it's due.`, "not_allowed");
  }

  const { data: existing } = await userDb
    .from("filings")
    .select("id, status")
    .eq("requirement_id", requirement.id)
    .eq("user_id", user.id)
    .not("status", "in", "(cancelled,refunded)")
    .maybeSingle();
  if (existing) return existing.id;

  const db = createAdminClient();
  const { data: filing, error } = await db
    .from("filings")
    .insert({
      user_id: user.id,
      business_id: business.id,
      requirement_id: requirement.id,
      state_code: business.state_code,
      filing_type_code: "annual_report",
      rule_version_id: current.version.id,
      rule_snapshot: current.version,
      period_year: requirement.period_year,
      due_date: requirement.due_date,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !filing) throw new FilingError(`Could not start the filing: ${error?.message}`);

  // Pre-fill intake from what we know: the previous filing, the saved profile, then the
  // state's register (server-fetched records only). Every prefilled field gets a provenance row.
  const { data: addresses } = await userDb.from("business_addresses").select("*").eq("business_id", business.id);
  const { data: people } = await userDb.from("business_owners").select("*").eq("business_id", business.id).order("sort_order");
  const principal = addresses?.find((a) => a.kind === "principal_office");
  const registered = addresses?.find((a) => a.kind === "registered_office");
  const { data: prevFiling } = await db
    .from("filings")
    .select("id, updated_at, filing_answers(answers)")
    .eq("business_id", business.id)
    .eq("user_id", user.id)
    .in("status", [...FILED_STATUSES])
    .neq("id", filing.id)
    .order("period_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevAnswers = (Array.isArray(prevFiling?.filing_answers) ? prevFiling?.filing_answers[0] : prevFiling?.filing_answers) as { answers?: IntakeAnswers } | null | undefined;
  const registry = await loadStateRecord(business.state_code, business.state_entity_number);
  const built = buildPrefill({
    business: {
      legalName: business.legal_name,
      entityNumber: business.state_entity_number ?? null,
      isForeign: business.is_foreign,
      homeJurisdiction: business.home_jurisdiction ?? null,
      stateName: getJurisdiction(business.state_code)?.name ?? "",
    },
    profile: {
      principalOffice: principal ? { ...pickAddress(principal) } : null,
      registeredOffice: registered
        ? registered.crop_name
          ? { mode: "crop", crop_name: registered.crop_name, county: registered.county ?? "" }
          : { mode: "address", ...pickAddress(registered), county: registered.county ?? "" }
        : null,
      governors: (people ?? []).filter((p) => p.role_kind !== "officer").map((p) => ({ name: p.full_name, title: p.title })),
      officers: (people ?? []).filter((p) => p.role_kind !== "governor").map((p) => ({ name: p.full_name, title: p.title })),
    },
    registry,
    previous: prevAnswers?.answers ? { answers: prevAnswers.answers, at: String(prevFiling?.updated_at ?? new Date().toISOString()) } : null,
    now: new Date().toISOString(),
  });
  const prefill: IntakeAnswers = built.answers;
  if (built.provenance.length) {
    await db.from("filing_prefill").insert(built.provenance.map((p) => ({ ...p, filing_id: filing.id, user_id: user.id })));
    await trackServer("prefill_applied", {
      userId: user.id,
      stateCode: business.state_code,
      filingTypeCode: "annual_report",
      entityType: business.entity_type,
      properties: {
        fields: built.provenance.length,
        from_registry: built.provenance.filter((p) => p.source === "state_registry").length,
        from_previous: built.provenance.filter((p) => p.source === "previous_filing").length,
      },
      dedupeKey: `prefill_applied:${filing.id}`,
    });
  }

  await userDb.from("filing_answers").insert({ filing_id: filing.id, user_id: user.id, answers: prefill });

  await audit({ actorUserId: user.id, actorType: "customer", action: "filing.draft_created", entityType: "filing", entityId: filing.id, filingId: filing.id });
  await trackServer("intake_started", { userId: user.id, stateCode: business.state_code, filingTypeCode: "annual_report", entityType: business.entity_type, dedupeKey: `intake_started:${filing.id}` });
  return filing.id as string;
}

function pickAddress(a: Record<string, unknown>): Address {
  return {
    line1: String(a.line1 ?? ""),
    line2: String(a.line2 ?? ""),
    city: String(a.city ?? ""),
    region: String(a.region ?? ""),
    postal_code: String(a.postal_code ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Loading a filing for the customer (RLS-scoped)
// ---------------------------------------------------------------------------

export async function getCustomerFiling(filingId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(filingId)) return null;
  const userDb = await createClient();
  const { data: filing } = await userDb
    .from("filings")
    .select("*, businesses(*), filing_answers(*), orders(*)")
    .eq("id", filingId)
    .maybeSingle();
  if (!filing) return null;
  const snapshot = filing.rule_snapshot as { intake_schema: ComplianceRuleDef["intake"]; filing_name: string } & Record<string, unknown>;
  const answersRow = Array.isArray(filing.filing_answers) ? filing.filing_answers[0] : filing.filing_answers;
  return {
    filing,
    business: Array.isArray(filing.businesses) ? filing.businesses[0] : filing.businesses,
    order: Array.isArray(filing.orders) ? filing.orders[0] : filing.orders,
    schema: snapshot.intake_schema,
    answers: ((answersRow?.answers ?? {}) as IntakeAnswers) ?? {},
    completedSteps: (answersRow?.completed_steps ?? []) as string[],
    isComplete: Boolean(answersRow?.is_complete),
  };
}

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

export async function saveIntakeSection(user: SessionUser, filingId: string, sectionKey: string, raw: IntakeAnswers) {
  const loaded = await getCustomerFiling(filingId);
  if (!loaded || loaded.filing.user_id !== user.id) throw new FilingError("Filing not found", "not_found");
  if (!CUSTOMER_EDITABLE_STATUSES.includes(loaded.filing.status as FilingStatus)) {
    throw new FilingError("This filing can no longer be edited.", "not_allowed");
  }
  const section = loaded.schema.sections.find((s) => s.key === sectionKey);
  if (!section) throw new FilingError("Unknown section", "invalid");

  const result = validateSection(section, raw);
  if (!result.ok) return { ok: false as const, errors: result.errors };

  const answers = { ...loaded.answers, ...result.values };
  const all = validateAll(loaded.schema, answers);
  const completed = Array.from(new Set([...loaded.completedSteps, sectionKey]));
  const userDb = await createClient();
  const { error } = await userDb
    .from("filing_answers")
    .update({ answers, completed_steps: completed })
    .eq("filing_id", filingId)
    .eq("user_id", user.id);
  if (error) throw new FilingError(`Could not save: ${error.message}`);
  // Completeness is derived by the server, never accepted from the client (no column grant).
  await createAdminClient().from("filing_answers").update({ is_complete: all.ok }).eq("filing_id", filingId).eq("user_id", user.id);
  await recordChangesAfterAuthorization(user, filingId, loaded.schema, answers);
  if (all.ok) {
    await trackServer("intake_completed", { userId: user.id, stateCode: loaded.filing.state_code, filingTypeCode: "annual_report", dedupeKey: `intake_completed:${filingId}` });
  }
  return { ok: true as const, isComplete: all.ok, nextIncomplete: all.incompleteSections[0] ?? null };
}

/**
 * "Nothing has changed": keep the prefilled answers, record the customer's answer to the
 * changes question, and mark every section that is already complete as done. Sections
 * with missing required details stay open. Nothing is signed or submitted here.
 */
export async function acceptPrefill(user: SessionUser, filingId: string) {
  const loaded = await getCustomerFiling(filingId);
  if (!loaded || loaded.filing.user_id !== user.id) throw new FilingError("Filing not found", "not_found");
  if (!CUSTOMER_EDITABLE_STATUSES.includes(loaded.filing.status as FilingStatus)) throw new FilingError("This filing can no longer be edited.", "not_allowed");
  const answers: IntakeAnswers = { ...loaded.answers };
  const hasChangesQuestion = loaded.schema.sections.some((sec) => sec.fields.some((f) => f.key === "changes_since_last_report"));
  if (hasChangesQuestion && !answers.changes_since_last_report) answers.changes_since_last_report = "no";
  const done = loaded.schema.sections.filter((sec) => validateSection(sec, answers).ok).map((sec) => sec.key);
  const all = validateAll(loaded.schema, answers);
  const userDb = await createClient();
  const { error } = await userDb
    .from("filing_answers")
    .update({ answers, completed_steps: Array.from(new Set([...loaded.completedSteps, ...done])) })
    .eq("filing_id", filingId)
    .eq("user_id", user.id);
  if (error) throw new FilingError(`Could not save: ${error.message}`);
  await createAdminClient().from("filing_answers").update({ is_complete: all.ok }).eq("filing_id", filingId).eq("user_id", user.id);
  await recordChangesAfterAuthorization(user, filingId, loaded.schema, answers);
  if (all.ok) {
    await trackServer("intake_completed", { userId: user.id, stateCode: loaded.filing.state_code, filingTypeCode: "annual_report", dedupeKey: `intake_completed:${filingId}` });
  }
  return { isComplete: all.ok, nextIncomplete: all.incompleteSections[0] ?? null };
}

/**
 * Answer keys whose current value differs from what the customer signed. Pure: shared by
 * the audit trail below and the operator screens.
 */
export function changedSinceSigned(schema: { sections: { fields: { key: string }[] }[] }, signed: IntakeAnswers, current: IntakeAnswers): string[] {
  const keys = schema.sections.flatMap((s) => s.fields.map((f) => f.key));
  return keys.filter((k) => !sameValue(signed[k], current[k]));
}

/**
 * After a customer signs, every later edit is kept in the append-only audit log (which
 * fields, what was signed, what it is now). The signed record itself never changes, and
 * checkout and filing both refuse until the customer signs the new values.
 */
async function recordChangesAfterAuthorization(user: SessionUser, filingId: string, schema: Parameters<typeof validateAll>[0], answers: IntakeAnswers) {
  const db = createAdminClient();
  const { data: latest } = await db
    .from("filing_authorizations")
    .select("id, answers_snapshot")
    .eq("filing_id", filingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return;
  const signed = (latest.answers_snapshot ?? {}) as IntakeAnswers;
  const current = validateAll(schema, answers).values;
  const changed = changedSinceSigned(schema, signed, current);
  if (!changed.length) return;
  await audit({
    actorUserId: user.id,
    actorType: "customer",
    action: "filing.answers_changed_after_authorization",
    entityType: "filing",
    entityId: filingId,
    filingId,
    before: Object.fromEntries(changed.map((k) => [k, signed[k] ?? null])),
    after: { ...Object.fromEntries(changed.map((k) => [k, current[k] ?? null])), authorization_id: latest.id },
  });
}

/** Provenance rows for a customer's own filing (RLS-scoped read). */
export async function getFilingPrefill(filingId: string) {
  const userDb = await createClient();
  const { data } = await userDb.from("filing_prefill").select("field_key, source, retrieved_at, edited").eq("filing_id", filingId);
  return (data ?? []) as { field_key: string; source: "state_registry" | "previous_filing" | "business_profile"; retrieved_at: string; edited: boolean | null }[];
}

// ---------------------------------------------------------------------------
// Authorization (attestation + consent to file)
// ---------------------------------------------------------------------------

/**
 * At signing, record what the customer confirmed for each prefilled field and whether
 * they changed it. Never touches the answers themselves. Re-signing updates the record.
 */
async function confirmPrefill(user: SessionUser, stateCode: string, filingId: string, snapshot: IntakeAnswers, signedAt: string) {
  const db = createAdminClient();
  const { data: rows } = await db.from("filing_prefill").select("id, field_key, original_value, created_at").eq("filing_id", filingId);
  if (!rows?.length) return;
  let edited = 0;
  for (const r of rows) {
    const confirmed = snapshot[r.field_key] ?? null;
    const changed = !sameValue(r.original_value, confirmed);
    if (changed) edited++;
    await db.from("filing_prefill").update({ confirmed_value: confirmed, edited: changed, confirmed_at: signedAt }).eq("id", r.id);
  }
  const startedAt = rows.reduce((min, r) => (String(r.created_at) < min ? String(r.created_at) : min), String(rows[0].created_at));
  await trackServer("prefill_confirmed", {
    userId: user.id,
    stateCode,
    filingTypeCode: "annual_report",
    properties: { fields: rows.length, edited, seconds_to_sign: Math.max(0, Math.round((Date.parse(signedAt) - Date.parse(startedAt)) / 1000)) },
  });
}

export async function authorizeFiling(
  user: SessionUser,
  filingId: string,
  input: {
    signerName: string;
    signerTitle: string;
    attest: boolean;
    authorize: boolean;
    brand: string;
    /** States with a state-specific authorization: the customer confirmed the full packet. */
    certifyFacts?: boolean;
    /** When the registered agent changes: how the new agent consents. */
    agentConsent?: { mode: "signer_is_agent" | "agent_to_sign" | ""; consent: boolean };
    /** Legal operator named as the filing agent (site.legalEntity) and whether it is configured. */
    legalEntity?: { name: string; configured: boolean };
  },
) {
  const loaded = await getCustomerFiling(filingId);
  if (!loaded || loaded.filing.user_id !== user.id) throw new FilingError("Filing not found", "not_found");
  const status = loaded.filing.status as FilingStatus;
  if (!CUSTOMER_EDITABLE_STATUSES.includes(status)) throw new FilingError("This filing can no longer be changed.", "not_allowed");
  if (!input.attest || !input.authorize) throw new FilingError("Please confirm both statements to continue.", "invalid");
  const signerName = input.signerName.replace(/\s+/g, " ").trim();
  const signerTitle = input.signerTitle.replace(/\s+/g, " ").trim();
  if (signerName.length < 2 || signerName.length > 200) throw new FilingError("Enter your full name.", "invalid");
  if (signerTitle.length < 2 || signerTitle.length > 100) throw new FilingError("Enter your title or role.", "invalid");

  const all = validateAll(loaded.schema, loaded.answers);
  if (!all.ok) throw new FilingError("Some required details are missing. Review your information first.", "invalid");

  const stateName = getJurisdiction(loaded.filing.state_code)?.name ?? loaded.filing.state_code;
  const snapshot = all.values;
  const sha = createHash("sha256").update(stableStringify(snapshot)).digest("hex");

  // State-specific signing (Washington): the customer confirms the exact packet the filing
  // agent will certify, and a registered-agent change carries the new agent's consent.
  const stateAuth = stateAuthorizationFor(loaded.filing.state_code, loaded.business);
  const agent = input.legalEntity ? filingAgentName(input.brand, input.legalEntity.name, input.legalEntity.configured) : input.brand;
  let packet: PacketRow[] | null = null;
  let agentConsent: RegisteredAgentConsent | null = null;
  const signedAt = new Date().toISOString();
  if (stateAuth) {
    if (!input.certifyFacts) throw new FilingError("Confirm that you reviewed every item and that it is true and correct.", "invalid");
    packet = buildFilingPacket(stateAuth.runbook, loaded.schema, snapshot);
    if (registeredAgentConsentRequired(stateAuth.auth, snapshot)) {
      const ra = stateAuth.auth.registeredAgentConsent!;
      const agentName = String(snapshot[ra.agentNameKey] ?? "").trim();
      const mode = input.agentConsent?.mode ?? "";
      if (mode === "signer_is_agent") {
        if (!input.agentConsent?.consent) throw new FilingError("Tick the consent to serve as registered agent, or choose that someone else is the agent.", "invalid");
        agentConsent = { mode, agentName, signerName, signerTitle, consentText: ra.consentText, signedAt };
      } else if (mode === "agent_to_sign") {
        agentConsent = { mode, agentName };
      } else {
        throw new FilingError("Tell us how the new registered agent consents to serve.", "invalid");
      }
    }
  }
  const filingName = String((loaded.filing.rule_snapshot as Record<string, unknown>).filing_name ?? "Annual Report");
  const text = authorizationText({
    businessName: authorizationBusinessName(loaded.business, snapshot),
    stateName,
    filingName,
    brand: input.brand,
    state: stateAuth ? { filingAgent: agent, certificationText: stateAuth.auth.certificationText } : undefined,
  });

  const db = createAdminClient();
  const { data: auth, error } = await db
    .from("filing_authorizations")
    .insert({
      filing_id: filingId,
      user_id: user.id,
      signer_name: signerName,
      signer_title: signerTitle,
      attested_accurate: true,
      authorized_submission: true,
      terms_version: stateAuth ? `${AUTHORIZATION_TERMS_VERSION}.${STATE_AUTHORIZATION_REVISION}` : AUTHORIZATION_TERMS_VERSION,
      authorization_text: text,
      answers_sha256: sha,
      answers_snapshot: snapshot,
      rule_version_id: loaded.filing.rule_version_id ?? null,
      packet_snapshot: packet,
      packet_sha256: packet ? packetSha256(packet) : null,
      facts_certified: stateAuth ? true : null,
      certification_text: stateAuth?.auth.certificationText ?? null,
      filing_agent_name: stateAuth ? agent : null,
      registered_agent_consent: agentConsent,
      ip_hash: await clientIpHash(),
      user_agent: await userAgent(),
    })
    .select("id, created_at")
    .single();
  if (error || !auth) throw new FilingError(`Could not record authorization: ${error?.message}`);

  await syncBusinessProfile(user, loaded.filing.business_id, snapshot);
  await confirmPrefill(user, loaded.filing.state_code, filingId, snapshot, auth.created_at as string);
  await audit({
    actorUserId: user.id,
    actorType: "customer",
    action: "filing.authorized",
    entityType: "filing_authorization",
    entityId: auth.id,
    filingId,
    after: {
      answers_sha256: sha,
      packet_sha256: packet ? packetSha256(packet) : null,
      registered_agent_consent: agentConsent?.mode ?? null,
      terms_version: stateAuth ? `${AUTHORIZATION_TERMS_VERSION}.${STATE_AUTHORIZATION_REVISION}` : AUTHORIZATION_TERMS_VERSION,
      // Terms of Service and Refund Policy version the customer agreed to (also named in the stored text).
      legal_documents_version: LEGAL_LAST_UPDATED,
      signer_title: signerTitle,
    },
  });

  // If already paid and waiting on the customer, put it back in the review queue.
  if (status === "needs_information" || status === "needs_customer_action") {
    await db.rpc("transition_filing", {
      p_filing_id: filingId,
      p_to_status: "ready_for_review",
      p_actor_user_id: user.id,
      p_actor_type: "customer",
      p_note: "Customer completed their information",
      p_customer_visible: true,
      p_patch: {},
      p_expected_from: status,
    });
  }
  return { authorizationId: auth.id as string };
}

/** Keep the business profile current so next year's filing is pre-filled. */
async function syncBusinessProfile(user: SessionUser, businessId: string, answers: IntakeAnswers) {
  const userDb = await createClient();
  const entityNumber = String(answers.entity_number ?? "").trim();
  await userDb
    .from("businesses")
    .update({ legal_name: String(answers.legal_name), state_entity_number: entityNumber || null })
    .eq("id", businessId);

  const principal = answers.principal_office as Address | undefined;
  const registered = answers.registered_office as RegisteredOffice | undefined;
  const rows = [];
  if (principal) rows.push({ business_id: businessId, kind: "principal_office", ...addressCols(principal), county: principal.county ?? null, crop_name: null });
  if (registered) {
    rows.push(
      registered.mode === "crop"
        ? { business_id: businessId, kind: "registered_office", line1: null, line2: null, city: null, region: "PA", postal_code: null, county: registered.county, crop_name: registered.crop_name }
        : { business_id: businessId, kind: "registered_office", ...addressCols(registered), county: registered.county, crop_name: null },
    );
  }
  if (rows.length) await userDb.from("business_addresses").upsert(rows, { onConflict: "business_id,kind" });

  const governors = (answers.governors as Person[] | undefined) ?? [];
  const officers = (answers.principal_officers as Person[] | undefined) ?? [];
  await userDb.from("business_owners").delete().eq("business_id", businessId);
  const people = [
    ...governors.map((p, i) => ({ business_id: businessId, full_name: p.name, title: p.title, role_kind: "governor", sort_order: i })),
    ...officers.map((p, i) => ({ business_id: businessId, full_name: p.name, title: p.title, role_kind: "officer", sort_order: 100 + i })),
  ];
  if (people.length) await userDb.from("business_owners").insert(people);
  void user;
}

function addressCols(a: Address) {
  return { line1: a.line1, line2: a.line2 || null, city: a.city, region: a.region, postal_code: a.postal_code };
}

// ---------------------------------------------------------------------------
// Pricing + checkout
// ---------------------------------------------------------------------------

/** The full government fee evaluation for a filing (due, possible and avoidable charges). */
export async function governmentFeeDetails(
  filing: { state_code: string; rule_snapshot: unknown; due_date?: string | null },
  business: { is_nonprofit: boolean; state_entity_number?: string | null },
) {
  const tz = getJurisdiction(filing.state_code)?.timezone ?? "America/New_York";
  const status = await knownStateStatus(filing.state_code, business.state_entity_number ?? null);
  return {
    status,
    evaluation: evaluateFees(feeSourceFromSnapshot((filing.rule_snapshot ?? {}) as Record<string, unknown>), {
      isNonprofit: business.is_nonprofit,
      dueDate: filing.due_date ?? null,
      filingDate: todayInTimeZone(tz),
      status,
    }),
  };
}

export async function quoteForFiling(
  filing: { state_code: string; rule_snapshot: unknown; business_id: string; due_date?: string | null },
  business: { entity_type: string; is_nonprofit: boolean; state_entity_number?: string | null },
): Promise<Quote | null> {
  const snapshot = (filing.rule_snapshot ?? {}) as Record<string, unknown>;
  const prices = await listActivePricesAdmin();
  const price = resolveServicePrice(prices, {
    filingTypeCode: "annual_report",
    stateCode: filing.state_code,
    entityType: business.entity_type as EntityType,
  });
  if (!price) return null;
  const tz = getJurisdiction(filing.state_code)?.timezone ?? "America/New_York";
  // A status-based state charge (e.g. Washington's delinquency fee) is applied only from a
  // dated official record of this entity; otherwise it is "possible" and not charged.
  const status = await knownStateStatus(filing.state_code, business.state_entity_number ?? null);
  const gov = quoteGovernmentLines(
    evaluateFees(feeSourceFromSnapshot(snapshot), {
      isNonprofit: business.is_nonprofit,
      dueDate: filing.due_date ?? null,
      filingDate: todayInTimeZone(tz),
      status,
    }),
  );
  return buildQuote({
    stateName: getJurisdiction(filing.state_code)?.name ?? filing.state_code,
    filingName: String(snapshot.filing_name ?? "Annual Report"),
    governmentFeeCents: gov.totalCents,
    governmentLines: gov.lines,
    price,
  });
}

export async function startCheckout(user: SessionUser, filingId: string): Promise<{ url: string }> {
  const loaded = await getCustomerFiling(filingId);
  if (!loaded || loaded.filing.user_id !== user.id) throw new FilingError("Filing not found", "not_found");
  if (loaded.filing.status !== "draft") throw new FilingError("This filing has already been ordered.", "not_allowed");
  if (!validateAll(loaded.schema, loaded.answers).ok) throw new FilingError("Finish your details before checkout.", "invalid");

  const db = createAdminClient();
  const { data: latestAuth } = await db
    .from("filing_authorizations")
    .select("answers_sha256")
    .eq("filing_id", filingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latestAuth) throw new FilingError("Review and authorize the filing before checkout.", "invalid");
  const currentSha = createHash("sha256").update(stableStringify(validateAll(loaded.schema, loaded.answers).values)).digest("hex");
  if (currentSha !== latestAuth.answers_sha256) {
    throw new FilingError("Your details changed after you signed. Review and sign again.", "invalid");
  }

  const sellRule = findRule(loaded.filing.state_code, loaded.business.entity_type as EntityType, "annual_report", Boolean(loaded.business.is_foreign));
  if (!sellRule || !isRuleSellable(sellRule)) throw new FilingError("We can't file this right now.", "unavailable");

  const quote = await quoteForFiling(loaded.filing, loaded.business);
  if (!quote) throw new FilingError("Pricing isn't configured for this filing yet.", "unavailable");

  const provider = getPaymentProvider();
  if (requiresApprovedPrice(provider.mode) && !quote.servicePriceApproved) {
    throw new FilingError("Online payment isn't open yet for this filing. Nothing has been charged, and your details are saved.", "unavailable");
  }

  // Reuse the pending order if one exists. Older checkout sessions are settled first
  // so a customer can never pay twice for the same filing: one already paid (the
  // webhook hasn't landed yet) is applied instead of replaced, and open ones are
  // expired. The order is replaced when its total or payment mode no longer matches
  // (e.g. created under the sandbox, paid live), so a real charge is never recorded
  // as a test.
  let orderId: string | null = loaded.order?.status === "pending_payment" || loaded.order?.status === "payment_failed" || loaded.order?.status === "expired" ? loaded.order.id : null;
  if (orderId) {
    const { data: openPayments } = await db
      .from("payments")
      .select("id, order_id, provider, mode, provider_session_id, created_at")
      .eq("order_id", orderId)
      .eq("status", "pending");
    let paidSessionId: string | null = null;
    for (const p of (openPayments ?? []) as OpenPayment[]) {
      const settled = await settleSupersededPayment(db, provider, p, filingId, user.id);
      if (settled.paid) paidSessionId = settled.sessionId;
    }
    if (paidSessionId) {
      // Already paid: show the confirmation instead of opening a second checkout.
      return { url: absoluteUrl(`/file/${filingId}/confirmation?session_id=${encodeURIComponent(paidSessionId)}`) };
    }
    if (loaded.order && (loaded.order.total_cents !== quote.totalCents || loaded.order.payment_mode !== provider.mode)) {
      await db.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", orderId);
      orderId = null;
    } else {
      await db.from("orders").update({ status: "pending_payment" }).eq("id", orderId);
    }
  }
  if (!orderId) {
    const { data: order, error } = await db
      .from("orders")
      .insert({
        user_id: user.id,
        business_id: loaded.filing.business_id,
        status: "pending_payment",
        currency: "usd",
        government_fee_cents: quote.governmentFeeCents,
        service_fee_cents: quote.serviceFeeCents,
        total_cents: quote.totalCents,
        pricing_snapshot: { ...quote, rule_version_id: loaded.filing.rule_version_id },
        payment_mode: provider.mode,
      })
      .select("id")
      .single();
    if (error || !order) throw new FilingError(`Could not create the order: ${error?.message}`);
    orderId = order.id as string;
    await db.from("order_items").insert(
      quote.lineItems.map((li) => ({ order_id: orderId, filing_id: filingId, kind: li.kind, description: li.description, amount_cents: li.amountCents })),
    );
    await db.from("filings").update({ order_id: orderId }).eq("id", filingId);
  }

  const { data: payment, error: payError } = await db
    .from("payments")
    .insert({ order_id: orderId, user_id: user.id, provider: provider.name, mode: provider.mode, amount_cents: quote.totalCents, currency: "usd", status: "pending" })
    .select("id")
    .single();
  if (payError || !payment) throw new FilingError(`Could not start payment: ${payError?.message}`);

  const jurisdiction = getJurisdiction(loaded.filing.state_code);
  const stateName = jurisdiction?.name ?? loaded.filing.state_code;
  const agencyName = jurisdiction?.agency.name.split(" - ")[0] ?? `${stateName} state`;
  const filingName = String((loaded.filing.rule_snapshot as Record<string, unknown> | null)?.filing_name ?? "Annual Report");
  const session = await provider.createCheckoutSession({
    orderId: orderId!,
    paymentId: payment.id,
    lineItems: quote.lineItems.map((li) => ({
      kind: li.kind,
      name: checkoutLineItemName(li.kind, agencyName, quote.lineItems.filter((x) => x.kind !== "service_fee").length > 1 || li.kind === "government_late_fee" ? li.description.replace(`${stateName} `, "").replace(/, paid to the state$/, "") : undefined),
      amountCents: li.amountCents,
    })),
    totalCents: quote.totalCents,
    currency: "usd",
    customerEmail: user.email,
    description: checkoutDescription({ stateName, filingName, businessName: String(loaded.business?.legal_name ?? "") }),
    successUrl: absoluteUrl(`/file/${filingId}/confirmation`),
    cancelUrl: absoluteUrl(`/file/${filingId}/checkout?cancelled=1`),
    idempotencyKey: `checkout:${payment.id}`,
  });
  await db.from("payments").update({ provider_session_id: session.sessionId }).eq("id", payment.id);

  await audit({ actorUserId: user.id, actorType: "customer", action: "checkout.started", entityType: "order", entityId: orderId, filingId, after: { total_cents: quote.totalCents, mode: provider.mode } });
  await trackServer("checkout_started", { userId: user.id, stateCode: loaded.filing.state_code, filingTypeCode: "annual_report", properties: { order_id: orderId } });
  return { url: session.url };
}

/**
 * On return from hosted checkout, verify the session server-side with the provider
 * (never trust the redirect alone). If the provider says it's paid and the webhook
 * hasn't landed yet, apply it now — the same idempotent path the webhook uses.
 */
export async function reconcileCheckoutReturn(user: SessionUser, filingId: string, sessionId: string | null) {
  const loaded = await getCustomerFiling(filingId);
  if (!loaded || loaded.filing.user_id !== user.id) return null;
  if (!sessionId || loaded.filing.status !== "draft") return loaded;
  const db = createAdminClient();
  const { data: payment } = await db
    .from("payments")
    .select("id, order_id, user_id, status, provider")
    .eq("provider_session_id", sessionId)
    .maybeSingle();
  if (!payment || payment.user_id !== user.id || payment.order_id !== loaded.filing.order_id) return loaded;
  let provider;
  try {
    provider = getPaymentProvider();
  } catch {
    return loaded; // Payments switched off since checkout started: the webhook remains the source of truth.
  }
  if (provider.name !== payment.provider) return loaded;
  const session = await provider.retrieveSession(sessionId);
  if (session?.paid && session.paymentId === payment.id) {
    await applyVerifiedPayment(db, payment, session, filingId, user.id);
    return getCustomerFiling(filingId);
  }
  return loaded;
}

/**
 * Apply a session the provider reports as paid, through the same idempotent
 * apply_payment_success path the webhook uses, so a later webhook is harmless.
 */
async function applyVerifiedPayment(
  db: SupabaseClient,
  payment: { id: string; order_id: string },
  session: SessionStatus,
  filingId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await db.rpc("apply_payment_success", {
    p_payment_id: payment.id,
    p_provider_payment_id: session.providerPaymentId,
    p_receipt_url: null,
    p_amount_cents: session.amountCents,
    p_currency: session.currency,
    p_event_at: new Date().toISOString(),
  });
  if (error) throw new Error(`apply_payment_success: ${error.message}`);
  const res = data as { applied?: boolean; filing_id?: string } | null;
  if (res?.applied) await afterPaymentSucceeded(res.filing_id ?? filingId, payment.order_id, userId);
}

interface OpenPayment {
  id: string;
  order_id: string;
  provider: string;
  mode: string;
  provider_session_id: string | null;
  created_at: string;
}

/** No hosted checkout session stays payable longer than this (Stripe's maximum lifetime). */
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Settle an older pending payment before a new checkout replaces it. The provider is
 * asked, never assumed: a session the customer already paid is applied instead of
 * expired, so a second click on Pay can't charge them twice. An open session is
 * expired and then checked again, in case it was paid in between. When its state
 * can't be confirmed, no new checkout is opened.
 */
async function settleSupersededPayment(
  db: SupabaseClient,
  provider: PaymentProvider,
  p: OpenPayment,
  filingId: string,
  userId: string,
): Promise<{ paid: true; sessionId: string } | { paid: false }> {
  const release = async (): Promise<{ paid: false }> => {
    await db.rpc("apply_payment_failure", { p_payment_id: p.id, p_status: "expired", p_reason: "superseded by a new checkout", p_event_at: new Date().toISOString() });
    return { paid: false };
  };
  // No session was ever created, or the current provider can't reach it (another
  // provider or mode; the sandbox and test mode move no real money).
  if (!p.provider_session_id || p.provider !== provider.name || p.mode !== provider.mode) return release();

  const sessionId = p.provider_session_id;
  let session = await provider.retrieveSession(sessionId);
  if (session?.status === "open" && !session.paid) {
    await provider.expireSession(sessionId);
    session = await provider.retrieveSession(sessionId);
  }
  if (session?.paid && session.paymentId === p.id) {
    await applyVerifiedPayment(db, p, session, filingId, userId);
    return { paid: true, sessionId };
  }
  if (session && !session.paid && session.status === "expired") return release();
  if (!session && Date.now() - new Date(p.created_at).getTime() > SESSION_MAX_AGE_MS) return release();
  // Still open, paid under another reference, complete but not yet paid, or unreachable:
  // it might still take money, so don't open a second checkout.
  throw new FilingError(
    "We couldn't confirm the status of your earlier checkout, so we haven't opened a new one. Nothing new has been charged. Please try again in a few minutes.",
    "unavailable",
  );
}

// ---------------------------------------------------------------------------
// Customer self-service
// ---------------------------------------------------------------------------

export async function markFiledElsewhere(user: SessionUser, requirementId: string) {
  const userDb = await createClient();
  const { data: req } = await userDb
    .from("filing_requirements")
    .select("id, status")
    .eq("id", requirementId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!req) throw new FilingError("Not found", "not_found");
  if (req.status !== "open") return;
  const { data: activeFiling } = await userDb
    .from("filings")
    .select("id, status")
    .eq("requirement_id", requirementId)
    .not("status", "in", "(draft,cancelled,refunded)")
    .maybeSingle();
  if (activeFiling) throw new FilingError("We're already handling this filing for you.", "not_allowed");

  const db = createAdminClient();
  const { data: draft } = await userDb
    .from("filings")
    .select("id")
    .eq("requirement_id", requirementId)
    .eq("user_id", user.id)
    .eq("status", "draft")
    .maybeSingle();
  if (draft) {
    await db.rpc("transition_filing", {
      p_filing_id: draft.id,
      p_to_status: "cancelled",
      p_actor_user_id: user.id,
      p_actor_type: "customer",
      p_note: "Filed elsewhere by the customer",
      p_customer_visible: true,
      p_patch: {},
      p_expected_from: "draft",
    });
  }
  await db.from("filing_requirements").update({ status: "filed_elsewhere", resolved_at: new Date().toISOString() }).eq("id", requirementId).eq("status", "open");
  await db.from("reminders").update({ status: "cancelled", skip_reason: "filed_elsewhere", processed_at: new Date().toISOString() }).eq("requirement_id", requirementId).eq("status", "scheduled");
  await audit({ actorUserId: user.id, actorType: "customer", action: "requirement.filed_elsewhere", entityType: "filing_requirement", entityId: requirementId });
  await rollForwardRequirement(requirementId);
}

export async function customerReply(user: SessionUser, filingId: string, body: string) {
  const text = body.trim();
  if (!text || text.length > 5000) throw new FilingError("Messages must be 1 to 5000 characters.", "invalid");
  if (!(await rateLimit(`message:${user.id}`, 20, 600))) {
    throw new FilingError("You've sent a lot of messages. Wait a few minutes and try again.", "not_allowed");
  }
  const userDb = await createClient();
  const { data: filing } = await userDb
    .from("filings")
    .select("id, status, user_id")
    .eq("id", filingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!filing) throw new FilingError("Filing not found", "not_found");
  const { data: message, error } = await userDb
    .from("messages")
    .insert({ filing_id: filingId, user_id: user.id, author_id: user.id, author_type: "customer", body: text })
    .select("id")
    .single();
  if (error) throw new FilingError(`Could not send: ${error.message}`);
  await audit({ actorUserId: user.id, actorType: "customer", action: "message.sent", entityType: "filing", entityId: filingId, filingId });
  if (filing.status === "needs_customer_action") {
    await createAdminClient().rpc("transition_filing", {
      p_filing_id: filingId,
      p_to_status: "ready_for_review",
      p_actor_user_id: user.id,
      p_actor_type: "customer",
      p_note: "Customer replied",
      p_customer_visible: true,
      p_patch: {},
      p_expected_from: "needs_customer_action",
    });
  }
  // Staff alert (at most one per filing per hour); never throws, so it cannot fail the customer's reply.
  if (message?.id) await notifyStaffOfCustomerMessage(filingId, message.id as string);
}
