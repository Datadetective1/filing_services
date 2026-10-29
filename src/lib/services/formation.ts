import "server-only";
import { absoluteUrl } from "@/config/site";
import { audit } from "@/lib/audit";
import { trackServer } from "@/lib/analytics/server";
import type { SessionUser } from "@/lib/auth/session";
import { resolveServicePrice, type ServicePrice } from "@/lib/domain/pricing";
import type { EntityType } from "@/lib/domain/types";
import { listActivePricesAdmin } from "@/lib/filings/rules-db";
import { getPaymentProvider, requiresApprovedPrice } from "@/lib/payments";
import {
  formationFeeCents,
  getRaJurisdiction,
  type RaJurisdiction,
} from "@/lib/registered-agent/jurisdictions";
import {
  formationSaleCheck,
  RA_ENTITY_TYPES,
  raSaleCheck,
  type SaleCheck,
} from "@/lib/registered-agent/sales";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SERVICES, STANDARD_PRICE_VARIANT, WHOLESALE } from "./catalog";
import { economicsFromLines } from "./economics";
import { applyVerified, ServiceOrderError } from "./orders";
import {
  formationQuote,
  QuoteError,
  type PriceInput,
  type ServiceQuote,
} from "./quote";

/**
 * Business formation: one service fee plus the state's verified filing fee, with registered
 * agent service only if the customer ticks it. The provider files the formation; an operator
 * places the order by hand, like every other provider order. The business is saved as
 * "forming" at checkout and becomes an existing business once the state approves it.
 */

export interface FormationPreview {
  jurisdiction: RaJurisdiction;
  entityType: EntityType;
  sale: SaleCheck;
  /** Whether registered agent service can be added here (the customer still chooses). */
  addOnSale: SaleCheck;
  quote: ServiceQuote | null;
  addOnQuote: ServiceQuote | null;
}

function priceInput(p: ServicePrice | null, what: string): PriceInput {
  if (!p)
    throw new ServiceOrderError(
      `Pricing isn't set up for ${what} yet.`,
      "unavailable",
    );
  return { id: p.id, serviceFeeCents: p.serviceFeeCents, approved: p.approved };
}

/** Quotes with and without the registered agent add-on, without creating anything. */
export async function previewFormation(input: {
  stateCode: string;
  entityType: EntityType;
}): Promise<FormationPreview | null> {
  const j = getRaJurisdiction(input.stateCode);
  if (!j || !RA_ENTITY_TYPES.includes(input.entityType)) return null;
  const sale = formationSaleCheck(j.code, input.entityType);
  const addOnSale = sale.ok
    ? raSaleCheck(j.code, input.entityType, "new_entity")
    : sale;
  const base: FormationPreview = {
    jurisdiction: j,
    entityType: input.entityType,
    sale,
    addOnSale,
    quote: null,
    addOnQuote: null,
  };
  if (!sale.ok) return base;
  const prices = await listActivePricesAdmin();
  const scope = {
    stateCode: j.code,
    entityType: input.entityType,
    variant: STANDARD_PRICE_VARIANT,
  };
  try {
    const formationPrice = priceInput(
      resolveServicePrice(prices, {
        filingTypeCode: SERVICES.formation.filingTypeCode,
        ...scope,
      }),
      "formation",
    );
    const fee = formationFeeCents(j.code, input.entityType);
    const quote = formationQuote({
      stateName: j.name,
      formationPrice,
      formationGovernmentFeeCents: fee,
    });
    const agentPrice = addOnSale.ok
      ? resolveServicePrice(prices, {
          filingTypeCode: SERVICES.registered_agent.filingTypeCode,
          ...scope,
        })
      : null;
    const addOnQuote = agentPrice
      ? formationQuote({
          stateName: j.name,
          formationPrice,
          formationGovernmentFeeCents: fee,
          registeredAgentAddOn: priceInput(
            agentPrice,
            "registered agent service",
          ),
        })
      : null;
    return {
      ...base,
      quote,
      addOnQuote,
      addOnSale: addOnQuote
        ? addOnSale
        : {
            ok: false,
            reason:
              addOnSale.reason ??
              "Registered agent service can't be added here yet.",
          },
    };
  } catch (e) {
    if (e instanceof QuoteError || e instanceof ServiceOrderError)
      return { ...base, sale: { ok: false, reason: e.message } };
    throw e;
  }
}

export interface FormationInput {
  stateCode: string;
  entityType: EntityType;
  businessName: string;
  principalAddress: string;
  owners: string;
  /** LLCs only. */
  management: "member" | "manager" | null;
  contactName: string;
  contactPhone: string;
  addRegisteredAgent: boolean;
}

const PO_BOX = /\bP\.?\s*O\.?\s*Box\b/i;

/** Only what the provider needs to file, plus a contact. Anything else an operator asks for after payment. */
export function validateFormationInput(
  raw: Record<string, unknown>,
): { ok: true; value: FormationInput } | { ok: false; error: string } {
  const s = (k: string) =>
    typeof raw[k] === "string" ? (raw[k] as string).trim() : "";
  const stateCode = s("stateCode").toUpperCase();
  if (!getRaJurisdiction(stateCode))
    return { ok: false, error: "Choose a state." };
  const entityType = s("entityType");
  if (entityType !== "llc" && entityType !== "corporation")
    return { ok: false, error: "Choose LLC or corporation." };
  const businessName = s("businessName").replace(/\s+/g, " ");
  if (businessName.length < 2 || businessName.length > 200)
    return { ok: false, error: "Enter the business name you want to file." };
  const principalAddress = s("principalAddress");
  if (principalAddress.length < 5 || principalAddress.length > 500)
    return { ok: false, error: "Enter the business's street address." };
  if (PO_BOX.test(principalAddress))
    return { ok: false, error: "Enter a street address, not a PO box." };
  const owners = s("owners");
  if (owners.length < 2 || owners.length > 2000)
    return {
      ok: false,
      error:
        entityType === "llc"
          ? "Enter the members' names."
          : "Enter the directors' names.",
    };
  const management =
    entityType === "llc"
      ? s("management") === "manager"
        ? "manager"
        : "member"
      : null;
  const contactName = s("contactName");
  const contactPhone = s("contactPhone");
  if (contactName.length < 2 || contactName.length > 200)
    return {
      ok: false,
      error: "Enter the name of the person we should contact.",
    };
  if (
    !/^[0-9+() .-]{7,30}$/.test(contactPhone) ||
    (contactPhone.match(/\d/g) ?? []).length < 7
  )
    return {
      ok: false,
      error: "Enter a phone number we can reach that person on.",
    };
  const addRegisteredAgent =
    raw.addRegisteredAgent === "on" || raw.addRegisteredAgent === true;
  if (
    addRegisteredAgent &&
    raw.acceptedTerms !== "on" &&
    raw.acceptedTerms !== true
  )
    return {
      ok: false,
      error: "Please confirm the yearly renewal to continue.",
    };
  return {
    ok: true,
    value: {
      stateCode,
      entityType,
      businessName,
      principalAddress,
      owners,
      management,
      contactName,
      contactPhone,
      addRegisteredAgent,
    },
  };
}

export async function startFormationCheckout(
  u: SessionUser,
  input: FormationInput,
): Promise<{ url: string }> {
  const preview = await previewFormation({
    stateCode: input.stateCode,
    entityType: input.entityType,
  });
  if (!preview || !preview.sale.ok || !preview.quote)
    throw new ServiceOrderError(
      preview?.sale.reason ?? "Formation isn't open here yet.",
      "unavailable",
    );
  if (input.addRegisteredAgent && !preview.addOnQuote)
    throw new ServiceOrderError(
      preview.addOnSale.reason ??
        "Registered agent service can't be added here yet.",
      "unavailable",
    );
  const j = preview.jurisdiction;
  const quote = input.addRegisteredAgent ? preview.addOnQuote! : preview.quote;

  const provider = getPaymentProvider();
  if (requiresApprovedPrice(provider.mode) && !quote.pricesApproved) {
    throw new ServiceOrderError(
      "Online payment isn't open yet for formation. Nothing has been charged.",
      "unavailable",
    );
  }

  // The business being formed, owned by the customer (their own row, under their session).
  const userDb = await createClient();
  const { data: biz, error: bizError } = await userDb
    .from("businesses")
    .insert({
      owner_user_id: u.id,
      legal_name: input.businessName,
      state_code: j.code,
      entity_type: input.entityType,
      lifecycle: "forming",
      standing: "unknown",
      standing_source: "none",
    })
    .select("id")
    .single();
  if (bizError || !biz)
    throw new ServiceOrderError(
      `Could not save the business: ${bizError?.message ?? "unknown"}`,
    );
  const businessId = String(biz.id);

  const db = createAdminClient();
  const economics = economicsFromLines(quote.lines);
  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      user_id: u.id,
      business_id: businessId,
      status: "pending_payment",
      currency: "usd",
      order_type: "business_services",
      government_fee_cents: quote.governmentFeeCents,
      service_fee_cents: quote.serviceFeeCents,
      total_cents: quote.dueTodayCents,
      pricing_snapshot: {
        kind: "business_services",
        service: "formation",
        registered_agent_add_on: input.addRegisteredAgent,
        state_code: j.code,
        state_name: j.name,
        entity_type: input.entityType,
        price_variant: STANDARD_PRICE_VARIANT,
        quote,
        economics,
      },
      payment_mode: provider.mode,
    })
    .select("id")
    .single();
  if (orderError || !order)
    throw new ServiceOrderError(
      `Could not create the order: ${orderError?.message}`,
    );
  const orderId = order.id as string;

  const { error: itemsError } = await db
    .from("order_items")
    .insert(
      quote.lines.map((l) => ({
        order_id: orderId,
        kind: l.kind,
        description: l.description,
        amount_cents: l.amountCents,
        service_code: l.serviceCode,
        billing: l.billing,
      })),
    );
  if (itemsError)
    throw new ServiceOrderError(
      `Could not save the order: ${itemsError.message}`,
    );

  let subscriptionId: string | null = null;
  if (input.addRegisteredAgent) {
    const { data: sub, error: subError } = await db
      .from("ra_subscriptions")
      .insert({
        user_id: u.id,
        business_id: businessId,
        state_code: j.code,
        plan: "registered_agent",
        origin: "formation_add_on",
        order_id: orderId,
        renewal_price_cents: quote.renewal?.amountCents ?? 0,
        contact_name: input.contactName,
        contact_phone: input.contactPhone,
        contact_address: input.principalAddress,
      })
      .select("id")
      .single();
    if (subError || !sub)
      throw new ServiceOrderError(
        `Could not save the order: ${subError?.message}`,
      );
    subscriptionId = String(sub.id);
  }

  const details = {
    entity_type: input.entityType,
    legal_name: input.businessName,
    principal_address: input.principalAddress,
    owners: input.owners,
    management: input.management,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    registered_agent: input.addRegisteredAgent
      ? "Filewell's provider"
      : "Customer names their own agent",
  };
  const providerOrders: Record<string, unknown>[] = [
    {
      user_id: u.id,
      business_id: businessId,
      order_id: orderId,
      ra_subscription_id: subscriptionId,
      kind: "formation",
      state_code: j.code,
      government_fee_cents: quote.governmentFeeCents,
      wholesale_cost_cents: WHOLESALE.formation,
      details,
    },
  ];
  if (subscriptionId) {
    providerOrders.push({
      user_id: u.id,
      business_id: businessId,
      order_id: orderId,
      ra_subscription_id: subscriptionId,
      kind: "registered_agent",
      state_code: j.code,
      wholesale_cost_cents: WHOLESALE.registeredAgentPerYear,
      details: {
        situation: "formation_add_on",
        entity_type: input.entityType,
        legal_name: input.businessName,
        ...(j.extraIntake.beneficialOwners
          ? { beneficial_owners: input.owners }
          : {}),
      },
    });
  }
  const { error: poError } = await db
    .from("provider_orders")
    .insert(providerOrders);
  if (poError)
    throw new ServiceOrderError(`Could not save the order: ${poError.message}`);

  const { data: payment, error: payError } = await db
    .from("payments")
    .insert({
      order_id: orderId,
      user_id: u.id,
      provider: provider.name,
      mode: provider.mode,
      amount_cents: quote.dueTodayCents,
      currency: "usd",
      status: "pending",
    })
    .select("id")
    .single();
  if (payError || !payment)
    throw new ServiceOrderError(
      `Could not start payment: ${payError?.message}`,
    );

  const session = await provider.createCheckoutSession({
    orderId,
    paymentId: payment.id,
    lineItems: quote.lines
      .filter((l) => l.amountCents > 0)
      .map((l) => ({
        kind: l.kind,
        name: l.description,
        amountCents: l.amountCents,
        ...(l.billing === "annual"
          ? { recurring: { interval: "year" as const } }
          : {}),
      })),
    totalCents: quote.dueTodayCents,
    currency: "usd",
    customerEmail: u.email,
    description: `Formation of ${input.businessName} in ${j.name}`,
    successUrl: absoluteUrl(`/dashboard/services/formation/${orderId}`),
    cancelUrl: absoluteUrl(
      `/dashboard/services/formation?state=${j.code}&type=${input.entityType}&cancelled=1`,
    ),
    idempotencyKey: `formation-checkout:${payment.id}`,
  });
  await db
    .from("payments")
    .update({ provider_session_id: session.sessionId })
    .eq("id", payment.id);

  await audit({
    actorUserId: u.id,
    actorType: "customer",
    action: "service_checkout.started",
    entityType: "order",
    entityId: orderId,
    after: {
      service: "formation",
      registered_agent_add_on: input.addRegisteredAgent,
      total_cents: quote.dueTodayCents,
      mode: provider.mode,
      state_code: j.code,
    },
  });
  await trackServer("checkout_started", {
    userId: u.id,
    stateCode: j.code,
    filingTypeCode: SERVICES.formation.filingTypeCode,
    entityType: input.entityType,
    properties: {
      order_id: orderId,
      service_code: "formation",
      registered_agent_add_on: input.addRegisteredAgent,
      price_variant: STANDARD_PRICE_VARIANT,
    },
  });
  return { url: session.url };
}

export interface FormationStatus {
  orderId: string;
  businessId: string;
  businessName: string;
  stateName: string;
  paid: boolean;
  filingStatus: string;
  subscriptionId: string | null;
}

/** The customer's own formation order, reconciling a paid return from hosted checkout first. */
export async function loadFormationStatus(
  u: SessionUser,
  orderId: string,
  sessionId: string | null,
): Promise<FormationStatus | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, user_id, business_id, status, order_type, pricing_snapshot")
    .eq("id", orderId)
    .maybeSingle();
  if (
    !order ||
    order.user_id !== u.id ||
    order.order_type !== "business_services" ||
    (order.pricing_snapshot as { service?: string } | null)?.service !==
      "formation"
  )
    return null;
  if (sessionId && order.status === "pending_payment") {
    const { data: payment } = await db
      .from("payments")
      .select("id, order_id, user_id, provider")
      .eq("provider_session_id", sessionId)
      .maybeSingle();
    if (payment && payment.user_id === u.id && payment.order_id === order.id) {
      try {
        const provider = getPaymentProvider();
        const session =
          provider.name === payment.provider
            ? await provider.retrieveSession(sessionId)
            : null;
        if (session?.paid && session.paymentId === payment.id) {
          await applyVerified(
            payment,
            session.amountCents,
            session.currency,
            session.providerPaymentId,
            session.subscriptionId ?? null,
            session.invoiceId ?? null,
          );
        }
      } catch (e) {
        console.error("[formation] reconcile failed", e);
      }
    }
  }
  const [{ data: fresh }, { data: biz }, { data: po }, { data: sub }] =
    await Promise.all([
      db.from("orders").select("status").eq("id", order.id).maybeSingle(),
      db
        .from("businesses")
        .select("legal_name, state_code")
        .eq("id", order.business_id)
        .maybeSingle(),
      db
        .from("provider_orders")
        .select("status")
        .eq("order_id", order.id)
        .eq("kind", "formation")
        .maybeSingle(),
      db
        .from("ra_subscriptions")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle(),
    ]);
  return {
    orderId: order.id,
    businessId: order.business_id,
    businessName: biz?.legal_name ?? "",
    stateName:
      getRaJurisdiction(biz?.state_code ?? "")?.name ?? biz?.state_code ?? "",
    paid: fresh?.status === "paid" || fresh?.status === "fulfilled",
    filingStatus: po?.status ?? "new_order",
    subscriptionId: sub?.id ?? null,
  };
}
