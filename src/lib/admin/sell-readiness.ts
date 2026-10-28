import { formatLongDate } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import { resolveServicePrice, type ServicePrice } from "@/lib/domain/pricing";
import { ENTITY_TYPE_LABELS, type EntityType } from "@/lib/domain/types";

/**
 * The admin "Ready to sell" panel: every gate between this deployment and selling, one
 * row each. Pure (no database, no env reads) so it is unit tested; the admin page passes
 * in what it already loaded. Read only, and it never receives or shows a secret value:
 * only configuration names, modes and the public NEXT_PUBLIC_* values.
 */

export type SellReadinessTone = "ready" | "attention" | "info";

export interface SellReadinessRow {
  key: string;
  term: string;
  text: string;
  /** ready: done. attention: a gate still open (often an owner decision). info: a fact to know. */
  tone: SellReadinessTone;
  note?: string | null;
}

export interface SellableState {
  code: string;
  name: string;
  /** Entity types Filewell sells in this state on this deployment. */
  entityTypes: readonly EntityType[];
}

export interface SellReadinessInput {
  payments: {
    mode: "disabled" | "sandbox" | "test" | "live";
    /** The configured provider (PAYMENTS_PROVIDER), or null when the server environment is invalid. */
    provider: "stripe" | "sandbox" | null;
    reason: string | null;
  };
  sellableStates: SellableState[];
  /** Active service_prices rows. */
  prices: ServicePrice[];
  site: { legalEntity: string; legalEntityConfigured: boolean; governingLaw: string | null; postalAddress: string | null };
  legalLastUpdated: string;
  indexable: boolean;
}

/** States open for sale: filingEnabled in the jurisdiction directory and at least one sellable rule. */
export function sellableStates<R extends { stateCode: string; entityType: EntityType }>(
  jurisdictions: readonly { code: string; name: string; filingEnabled: boolean }[],
  rules: readonly R[],
  isSellable: (rule: R) => boolean,
): SellableState[] {
  return jurisdictions
    .filter((j) => j.filingEnabled)
    .map((j) => ({
      code: j.code,
      name: j.name,
      entityTypes: [...new Set(rules.filter((r) => r.stateCode === j.code && isSellable(r)).map((r) => r.entityType))],
    }))
    .filter((s) => s.entityTypes.length > 0);
}

const PROVIDER_LABEL = { stripe: "Stripe", sandbox: "sandbox" } as const;

function paymentsRow(p: SellReadinessInput["payments"]): SellReadinessRow {
  const provider = p.provider ? PROVIDER_LABEL[p.provider] : "provider unknown";
  if (p.mode === "live") return { key: "payments", term: "Live payments", text: "On (Stripe, live)", tone: "ready" };
  const detail =
    p.mode === "test" ? "Stripe test mode: no real money" : p.mode === "sandbox" ? "sandbox: no real money" : `${provider}: checkout is disabled`;
  return { key: "payments", term: "Live payments", text: `Off (${detail})`, tone: "attention", note: p.reason };
}

/** The approved active fee every sold entity type resolves to, as checkout would resolve it, or "Missing". */
function priceRow(state: SellableState, prices: ServicePrice[]): SellReadinessRow {
  const approvedFees = new Set<number>();
  const missing: string[] = [];
  const unapproved: string[] = [];
  for (const entityType of state.entityTypes) {
    const price = resolveServicePrice(prices, { filingTypeCode: "annual_report", stateCode: state.code, entityType });
    if (!price) missing.push(ENTITY_TYPE_LABELS[entityType]);
    else if (!price.approved) unapproved.push(ENTITY_TYPE_LABELS[entityType]);
    else approvedFees.add(price.serviceFeeCents);
  }
  const term = `Approved price: ${state.name}`;
  if (missing.length || unapproved.length) {
    const note = [
      missing.length ? `No active service price for: ${missing.join(", ")}` : null,
      unapproved.length ? `Not approved (live checkout refuses it): ${unapproved.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(". ");
    return { key: `price:${state.code}`, term, text: "Missing", tone: "attention", note };
  }
  const fees = [...approvedFees].sort((a, b) => a - b).map((c) => formatCents(c));
  return { key: `price:${state.code}`, term, text: `${fees.join(" or ")} service fee, approved`, tone: "ready" };
}

export function sellReadinessRows(input: SellReadinessInput): SellReadinessRow[] {
  const { site } = input;
  const prices: SellReadinessRow[] = input.sellableStates.length
    ? input.sellableStates.map((s) => priceRow(s, input.prices))
    : [{ key: "price", term: "Approved price", text: "No state is open for sale", tone: "attention" }];

  return [
    paymentsRow(input.payments),
    ...prices,
    site.legalEntityConfigured
      ? { key: "legal_entity", term: "Legal entity", text: site.legalEntity, tone: "ready" }
      : { key: "legal_entity", term: "Legal entity", text: "Not configured", tone: "attention", note: "Legal pages show a bracketed placeholder (NEXT_PUBLIC_LEGAL_ENTITY)." },
    site.governingLaw
      ? { key: "governing_law", term: "Governing law", text: site.governingLaw, tone: "ready" }
      : { key: "governing_law", term: "Governing law", text: "Not set: the terms omit the clause (owner decision)", tone: "attention" },
    site.postalAddress
      ? { key: "postal_address", term: "Postal address", text: "Configured", tone: "ready" }
      : {
          key: "postal_address",
          term: "Postal address",
          text: "Not set: subscriber reminders are skipped and legal pages say available on request",
          tone: "attention",
        },
    { key: "legal_review", term: "Legal review", text: "Draft for legal review banner is showing (no attorney review recorded)", tone: "attention" },
    {
      key: "legal_version",
      term: "Legal pages version",
      text: formatLongDate(input.legalLastUpdated),
      tone: "info",
      note: `LEGAL_LAST_UPDATED ${input.legalLastUpdated}, recorded with each filing authorization.`,
    },
    { key: "indexing", term: "Search indexing", text: input.indexable ? "On" : "Off", tone: "info" },
    { key: "sales_tax", term: "Sales tax on the service fee", text: "Not determined (owner and counsel)", tone: "attention" },
    {
      key: "production_secrets",
      term: "Production-only secrets",
      text: "Owner to confirm in Vercel: APP_SIGNING_SECRET, IP_HASH_SALT, CRON_SECRET differ from Preview",
      tone: "attention",
    },
  ];
}
