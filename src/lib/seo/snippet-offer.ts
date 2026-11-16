import "server-only";
import { providerReportOffer } from "@/components/marketing/provider-report-band";
import { publicQuote } from "@/lib/compliance/public-quote";
import { isRuleSellable } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";
import type { SnippetOffer } from "./state-snippets";

/** Filewell's prices for a search snippet, read from the same sources the page shows. */
export async function snippetOffer(code: string, rules: ComplianceRuleDef[]): Promise<SnippetOffer> {
  const offer: SnippetOffer = {};
  const sellable = rules.find((r) => isRuleSellable(r));
  const quote = sellable ? await publicQuote(sellable) : null;
  if (quote) offer.filingServiceCents = quote.serviceFeeCents;
  else {
    const provider = await providerReportOffer(code);
    if (provider) offer.filingServiceCents = provider.serviceCents;
  }
  if (businessServicesPagesEnabled()) {
    const ra = (await publicServicePrices()).registered_agent;
    if (ra !== undefined) offer.registeredAgentCents = ra;
  }
  return offer;
}
