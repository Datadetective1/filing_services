import "server-only";
import { createHash } from "node:crypto";
import { absoluteUrl } from "@/config/site";
import { trackServer } from "@/lib/analytics/server";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { stableStringify } from "@/lib/compliance/hash";
import { findRule, getJurisdiction, isRuleSellable } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { todayInTimeZone } from "@/lib/domain/dates";
import { currentFilingPeriod, type FilingPeriod } from "@/lib/domain/deadlines";
import { CUSTOMER_EDITABLE_STATUSES, type FilingStatus } from "@/lib/domain/filing-status";
import { buildQuote, governmentFeeFor, resolveServicePrice, type Quote } from "@/lib/domain/pricing";
import type { EntityType } from "@/lib/domain/types";
import { validateAll, validateSection, type IntakeAnswers, type Person, type RegisteredOffice, type Address } from "@/lib/intake/validate";
import { getPaymentProvider } from "@/lib/payments";
import { afterPaymentSucceeded } from "@/lib/payments/process-event";
import { ensureRemindersForRequirement, rollForwardRequirement } from "@/lib/reminders/engine";
import { clientIpHash, userAgent } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRuleVersion, listActivePricesAdmin } from "./rules-db";

export class FilingError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "not_allowed" | "invalid" | "unavailable" = "invalid",
  ) {
    super(message);
  }
}

export const AUTHORIZATION_TERMS_VERSION = "2026-09-27.v1";

export function authorizationText(input: { businessName: string; stateName: string; filingName: string; brand: string }) {
  return (
    `I confirm that I am authorized to act on behalf of ${input.businessName}. ` +
    `I authorize ${input.brand} and its personnel to act as the business's authorized representative for the limited purpose of preparing, electronically signing and submitting the ${input.stateName} ${input.filingName} described above, using the information I provided, and to pay the state filing fee on the business's behalf from the amount I pay today. ` +
    `I attest that the information I provided is true, correct and complete to the best of my knowledge. I understand that ${input.brand} is a private filing service, is not a government agency, does not provide legal advice, and that I could instead file directly with the state.`
  );
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

export function periodFor(rule: ComplianceRuleDef, input: { formationDate: string | null; alreadyFiledThisYear: boolean }, now = new Date()): FilingPeriod {
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

  // Pre-fill intake from what we know.
  const prefill: IntakeAnswers = {
    legal_name: business.legal_name,
    entity_number: business.state_entity_number ?? "",
    jurisdiction_of_formation: business.is_foreign ? (business.home_jurisdiction ?? "") : (getJurisdiction(business.state_code)?.name ?? ""),
  };
  const { data: addresses } = await userDb.from("business_addresses").select("*").eq("business_id", business.id);
  const { data: people } = await userDb.from("business_owners").select("*").eq("business_id", business.id).order("sort_order");
  const principal = addresses?.find((a) => a.kind === "principal_office");
  const registered = addresses?.find((a) => a.kind === "registered_office");
  if (principal) prefill.principal_office = pickAddress(principal);
  if (registered) {
    prefill.registered_office = registered.crop_name
      ? { mode: "crop", crop_name: registered.crop_name, county: registered.county ?? "" }
      : { mode: "address", ...pickAddress(registered), county: registered.county ?? "" };
  }
  if (people?.length) {
    prefill.governors = people.filter((p) => p.role_kind !== "officer").map((p) => ({ name: p.full_name, title: p.title }));
    prefill.principal_officers = people.filter((p) => p.role_kind !== "governor").map((p) => ({ name: p.full_name, title: p.title }));
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
  if (all.ok) {
    await trackServer("intake_completed", { userId: user.id, stateCode: loaded.filing.state_code, filingTypeCode: "annual_report", dedupeKey: `intake_completed:${filingId}` });
  }
  return { ok: true as const, isComplete: all.ok, nextIncomplete: all.incompleteSections[0] ?? null };
}

// ---------------------------------------------------------------------------
// Authorization (attestation + consent to file)
// ---------------------------------------------------------------------------

export async function authorizeFiling(
  user: SessionUser,
  filingId: string,
  input: { signerName: string; signerTitle: string; attest: boolean; authorize: boolean; brand: string },
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
  const text = authorizationText({
    businessName: loaded.business?.legal_name ?? String(snapshot.legal_name ?? ""),
    stateName,
    filingName: String((loaded.filing.rule_snapshot as Record<string, unknown>).filing_name ?? "Annual Report"),
    brand: input.brand,
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
      terms_version: AUTHORIZATION_TERMS_VERSION,
      authorization_text: text,
      answers_sha256: sha,
      answers_snapshot: snapshot,
      ip_hash: await clientIpHash(),
      user_agent: await userAgent(),
    })
    .select("id, created_at")
    .single();
  if (error || !auth) throw new FilingError(`Could not record authorization: ${error?.message}`);

  await syncBusinessProfile(user, loaded.filing.business_id, snapshot);
  await audit({
    actorUserId: user.id,
    actorType: "customer",
    action: "filing.authorized",
    entityType: "filing_authorization",
    entityId: auth.id,
    filingId,
    after: { answers_sha256: sha, terms_version: AUTHORIZATION_TERMS_VERSION, signer_title: signerTitle },
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

export async function quoteForFiling(filing: { state_code: string; rule_snapshot: unknown; business_id: string }, business: { entity_type: string; is_nonprofit: boolean }): Promise<Quote | null> {
  const snapshot = filing.rule_snapshot as { state_fee_cents: number; nonprofit_state_fee_cents: number | null; filing_name: string };
  const prices = await listActivePricesAdmin();
  const price = resolveServicePrice(prices, {
    filingTypeCode: "annual_report",
    stateCode: filing.state_code,
    entityType: business.entity_type as EntityType,
  });
  if (!price) return null;
  const gov = governmentFeeFor(
    { stateFeeCents: snapshot.state_fee_cents, nonprofitStateFeeCents: snapshot.nonprofit_state_fee_cents },
    { isNonprofit: business.is_nonprofit },
  );
  return buildQuote({
    stateName: getJurisdiction(filing.state_code)?.name ?? filing.state_code,
    filingName: snapshot.filing_name,
    governmentFeeCents: gov,
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

  const quote = await quoteForFiling(loaded.filing, loaded.business);
  if (!quote) throw new FilingError("Pricing isn't configured for this filing yet.", "unavailable");

  const provider = getPaymentProvider();
  if (provider.mode === "live" && !quote.servicePriceApproved) {
    throw new FilingError("This price has not been approved for live payments.", "unavailable");
  }

  // Reuse the pending order if one exists; expire any older open sessions so a
  // customer can never pay twice for the same filing.
  let orderId: string | null = loaded.order?.status === "pending_payment" || loaded.order?.status === "payment_failed" || loaded.order?.status === "expired" ? loaded.order.id : null;
  if (orderId && loaded.order && loaded.order.total_cents !== quote.totalCents) {
    await db.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", orderId);
    orderId = null;
  }
  if (orderId) {
    const { data: openPayments } = await db
      .from("payments")
      .select("id, provider_session_id")
      .eq("order_id", orderId)
      .eq("status", "pending");
    for (const p of openPayments ?? []) {
      if (p.provider_session_id) await provider.expireSession(p.provider_session_id);
      await db.rpc("apply_payment_failure", { p_payment_id: p.id, p_status: "expired", p_reason: "superseded by a new checkout", p_event_at: new Date().toISOString() });
    }
    await db.from("orders").update({ status: "pending_payment" }).eq("id", orderId);
  } else {
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

  const stateName = getJurisdiction(loaded.filing.state_code)?.name ?? loaded.filing.state_code;
  const session = await provider.createCheckoutSession({
    orderId: orderId!,
    paymentId: payment.id,
    lineItems: quote.lineItems.map((li) => ({ kind: li.kind, name: li.description, amountCents: li.amountCents })),
    totalCents: quote.totalCents,
    currency: "usd",
    customerEmail: user.email,
    description: `${stateName} Annual Report, ${loaded.business?.legal_name ?? ""}`.slice(0, 200),
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
  const provider = getPaymentProvider();
  if (provider.name !== payment.provider) return loaded;
  const session = await provider.retrieveSession(sessionId);
  if (session?.paid && session.paymentId === payment.id) {
    const { data } = await db.rpc("apply_payment_success", {
      p_payment_id: payment.id,
      p_provider_payment_id: session.providerPaymentId,
      p_receipt_url: null,
      p_amount_cents: session.amountCents,
      p_currency: session.currency,
      p_event_at: new Date().toISOString(),
    });
    const res = data as { applied?: boolean; filing_id?: string } | null;
    if (res?.applied) await afterPaymentSucceeded(res.filing_id ?? filingId, payment.order_id, user.id);
    return getCustomerFiling(filingId);
  }
  return loaded;
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
  const userDb = await createClient();
  const { data: filing } = await userDb
    .from("filings")
    .select("id, status, user_id")
    .eq("id", filingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!filing) throw new FilingError("Filing not found", "not_found");
  const { error } = await userDb.from("messages").insert({ filing_id: filingId, user_id: user.id, author_id: user.id, author_type: "customer", body: text });
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
}
