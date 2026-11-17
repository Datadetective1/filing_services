import type { ComplianceRuleDef, JurisdictionDef } from "@/lib/compliance/types";
import { formatCents } from "@/lib/domain/money";
import { dueDayText } from "@/lib/seo/content";

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

function utah(rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  const fee = singleFee(rules);
  if (fee === null) return null;
  // Utah calls it the annual renewal: due by the end of the month the business was formed.
  const due = `Utah annual renewals are due by the end of your anniversary month. The state fee is ${money(fee)}.`;
  const candidates =
    offer.filingServiceCents !== undefined
      ? [`${due} Filewell files it for ${money(offer.filingServiceCents)} + the state fee.`]
      : [
          ...(offer.registeredAgentCents !== undefined ? [`${due} Free reminders, registered agent ${money(offer.registeredAgentCents)}/yr.`] : []),
          `${due} Get free reminders before it's due.`,
        ];
  return {
    title: `Utah Annual Report: ${money(fee)} Renewal Fee & Due Date`,
    description: candidates.find((d) => d.length <= MAX_DESCRIPTION) ?? due,
  };
}

function pennsylvania(rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  const fee = feeFor(rules, "llc");
  if (fee === null) return null;
  const due = "Due June 30 (corporations), Sept 30 (LLCs) or Dec 31 (others).";
  return {
    title: `Pennsylvania Annual Report: ${money(fee)} Fee, Due Dates & Filing`,
    // The all-in price leads: it is the phrase AI answers quote when someone asks who to use.
    description:
      offer.filingServiceCents !== undefined
        ? `${money(offer.filingServiceCents + fee)} total with Filewell, including Pennsylvania's ${money(fee)} state fee. ${due} A person checks every filing.`
        : `${due} The state fee is ${money(fee)}. Get a free email reminder before yours is due.`,
  };
}

function florida(rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  const llc = rules.find((r) => r.entityType === "llc");
  if (!llc || llc.stateFeeCents <= 0) return null;
  const due = dueDayText(llc);
  const late = llc.lateFeeCents ? ` A ${money(llc.lateFeeCents)} late fee applies after that.` : "";
  const pitch =
    offer.filingServiceCents !== undefined ? ` Filewell files yours for ${money(offer.filingServiceCents)} + the state fee.` : "";
  const description = `Florida LLC annual reports are due ${due}, with a ${money(llc.stateFeeCents)} state fee.${late}${pitch}`;
  return {
    title: `Florida Annual Report: Due ${due}, ${money(llc.stateFeeCents)} LLC Fee & Filing`,
    description: description.length <= MAX_DESCRIPTION ? description : `Florida LLC annual reports are due ${due}, with a ${money(llc.stateFeeCents)} state fee.${pitch || late}`,
  };
}

const SNIPPETS: Record<string, (rules: ComplianceRuleDef[], offer: SnippetOffer) => StateSnippet | null> = {
  PA: pennsylvania,
  FL: florida,
  WA: washington,
  NV: nevada,
  UT: utah,
};

/** A hand-written snippet for this state's annual report guide, or null to use the generic one. */
export function stateGuideSnippet(j: Pick<JurisdictionDef, "code">, rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  if (!rules.length) return null;
  return SNIPPETS[j.code]?.(rules, offer) ?? null;
}

/**
 * Hand-written snippets for the state guide articles (/pennsylvania/annual-report-deadline
 * and the like) that sit near page one with almost no clicks. Same rules as above: the
 * state fee comes from the rules, Filewell's price from the price rows, and a filing pitch
 * shows only where we file the report right now.
 */
const filePitch = (offer: SnippetOffer, fee: number) =>
  offer.filingServiceCents !== undefined
    ? `Filewell files yours for ${money(offer.filingServiceCents)} + the ${money(fee)} state fee.`
    : "Get a free email reminder before yours is due.";

function paDeadline(rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  const fee = feeFor(rules, "llc");
  if (fee === null) return null;
  return {
    title: "PA Annual Report Due Dates: June 30, Sept 30, Dec 31",
    description: `Corporations file by June 30, LLCs by Sept 30 and all others by Dec 31. ${filePitch(offer, fee)}`,
  };
}

function paAfterDeadline(rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  const fee = feeFor(rules, "llc");
  if (fee === null) return null;
  return {
    title: "Missed the PA Annual Report Deadline? What Happens",
    description: `No state late fee: a late report costs the same ${money(fee)}. From 2027, non-filers can be dissolved. ${filePitch(offer, fee)}`,
  };
}

function paFee(rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  const fee = feeFor(rules, "llc");
  if (fee === null) return null;
  return {
    title: `PA Annual Report Fee: ${money(fee)} ($0 for Nonprofits)`,
    description: `Pennsylvania charges ${money(fee)} to file an annual report, $0 for nonprofits, and no state late fee. ${filePitch(offer, fee)}`,
  };
}

function nvDeadline(rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  const llc = feeFor(rules, "llc");
  if (llc === null) return null;
  const facts = `Nevada's Annual List and Business License are due by the last day of the month your business was formed. LLCs pay ${money(llc)}.`;
  const pitch = offer.filingServiceCents !== undefined ? ` We file it for ${money(offer.filingServiceCents)} + state fees.` : " Free reminders.";
  const description = `${facts}${pitch}`;
  return {
    title: "Nevada Annual List Due Date: End of Your Anniversary Month",
    description: description.length <= MAX_DESCRIPTION ? description : facts,
  };
}

const GUIDE_SNIPPETS: Record<string, (rules: ComplianceRuleDef[], offer: SnippetOffer) => StateSnippet | null> = {
  "PA/annual-report-deadline": paDeadline,
  "PA/annual-report-after-deadline": paAfterDeadline,
  "PA/annual-report-fee": paFee,
  "NV/annual-list-deadline": nvDeadline,
};

/** A hand-written snippet for one state guide article, or null to keep the guide's own. */
export function guideArticleSnippet(stateCode: string, slug: string, rules: ComplianceRuleDef[], offer: SnippetOffer): StateSnippet | null {
  if (!rules.length) return null;
  return GUIDE_SNIPPETS[`${stateCode}/${slug}`]?.(rules, offer) ?? null;
}

/** Whether a guide article has a hand-written snippet (so its page fetches prices). */
export function hasGuideArticleSnippet(stateCode: string, slug: string): boolean {
  return `${stateCode}/${slug}` in GUIDE_SNIPPETS;
}
