import type { ComplianceRuleDef, JurisdictionDef } from "@/lib/compliance/types";
import { formatCents } from "@/lib/domain/money";

/**
 * Hand-written Google titles and descriptions for state annual report guides that rank near
 * page one but draw few clicks. The generic snippet lists every entity type's due date and
 * runs past 280 characters, so Google cuts it before the fee or the offer. These lead with
 * the searcher's words, the state fee and what Filewell does, in about 155 characters.
 *
 * Prices are never typed here: the state fee comes from the verified rules and Filewell's
 * prices from the active price rows, so the snippet can't drift from the page. A price that
 * isn't available is left out, not guessed.
 */
export interface SnippetOffer {
  /** Filewell's service fee where we file this state's report right now; undefined when we don't. */
  filingServiceCents?: number;
  /** Registered agent price per year, when the registered agent pages are live. */
  registeredAgentCents?: number;
}

export interface StateSnippet {
  title: string;
  description: string;
}

const money = (cents: number) => formatCents(cents, { trimZeros: true });

/** Google shows about this many characters of a description before cutting it. */
const MAX_DESCRIPTION = 160;

function feeFor(rules: ComplianceRuleDef[], entityType: ComplianceRuleDef["entityType"]): number | null {
  const r = rules.find((x) => x.entityType === entityType);
  return r && r.stateFeeCents > 0 ? r.stateFeeCents : null;
}

/** The one state fee every rule shares, or null when they differ. */
function singleFee(rules: ComplianceRuleDef[]): number | null {
  const fees = [...new Set(rules.map((r) => r.stateFeeCents))];
  return fees.length === 1 && fees[0] > 0 ? fees[0] : null;
}

function washington(rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  const fee = singleFee(rules);
  if (fee === null) return null;
  const due = `Due by the end of the month your business was formed, with a ${money(fee)} state fee.`;
  const pitch =
    offer.filingServiceCents !== undefined
      ? `Filewell files your Washington annual report for ${money(offer.filingServiceCents)} + the state fee.`
      : "Get free reminders before it's due.";
  const ra = offer.registeredAgentCents !== undefined ? ` Registered agent ${money(offer.registeredAgentCents)}/yr.` : "";
  const withRa = `${due} ${pitch}${ra}`;
  return {
    title: `Washington Annual Report: ${money(fee)} Fee, Due Date & Filing`,
    description: withRa.length <= MAX_DESCRIPTION ? withRa : `${due} ${pitch}`,
  };
}

function nevada(rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  const llc = feeFor(rules, "llc");
  const corp = feeFor(rules, "corporation");
  if (llc === null || corp === null) return null;
  // Nevada calls it the Annual List, filed with the State Business License renewal.
  const facts = `Nevada Annual List and Business License: ${money(llc)} for LLCs, from ${money(corp)} for corporations, due by the end of your anniversary month.`;
  const candidates =
    offer.filingServiceCents !== undefined
      ? [`${facts} We file it for ${money(offer.filingServiceCents)} + state fees.`]
      : [
          ...(offer.registeredAgentCents !== undefined ? [`${facts} Free reminders, registered agent ${money(offer.registeredAgentCents)}/yr.`] : []),
          `${facts} Free reminders.`,
        ];
  return {
    title: "Nevada Annual Report (Annual List): Due Date & Fees",
    description: candidates.find((d) => d.length <= MAX_DESCRIPTION) ?? facts,
  };
}

const SNIPPETS: Record<string, (rules: ComplianceRuleDef[], offer: SnippetOffer) => StateSnippet | null> = {
  WA: washington,
  NV: nevada,
};

/** A hand-written snippet for this state's annual report guide, or null to use the generic one. */
export function stateGuideSnippet(j: Pick<JurisdictionDef, "code">, rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  if (!rules.length) return null;
  return SNIPPETS[j.code]?.(rules, offer) ?? null;
}
