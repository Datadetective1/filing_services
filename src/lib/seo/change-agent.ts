import { formatCents } from "@/lib/domain/money";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import type { FaqItem } from "@/lib/compliance/types";
import type { RaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import { RA_ENTITY_TYPES } from "@/lib/registered-agent/sales";

/**
 * The "how to change your registered agent in {state}" guide, built only from the facts we
 * verified on the state's own site (form name, fee, consent). Nothing here is a guess: a fact
 * that isn't verified is left out, not filled in.
 */
export interface ChangeAgentGuide {
  /** One line per entity type, e.g. "LLC: $5.00". Unverified fees say so. */
  fees: { label: string; text: string }[];
  /** The lowest verified fee, for the intro sentence. null when none is verified. */
  lowestFeeText: string | null;
  steps: { title: string; body: string }[];
  faq: FaqItem[];
}

export function changeAgentGuide(j: Pick<RaJurisdiction, "name" | "changeOfAgent">, priceText: string | null): ChangeAgentGuide | null {
  const change = j.changeOfAgent;
  if (!change) return null;
  const fees = RA_ENTITY_TYPES.map((t) => {
    const fee = change.governmentFeeCents[t];
    return {
      label: ENTITY_TYPE_LABELS[t],
      text: typeof fee === "number" ? (fee === 0 ? "No state fee" : formatCents(fee)) : "Not verified yet",
    };
  });
  const verified = RA_ENTITY_TYPES.map((t) => change.governmentFeeCents[t]).filter((f): f is number => typeof f === "number");
  const lowest = verified.length ? Math.min(...verified) : null;
  const lowestFeeText = lowest === null ? null : lowest === 0 ? "no state fee" : formatCents(lowest);

  const steps = [
    {
      title: "Choose your new registered agent",
      body: `The agent needs a street address in ${j.name} where lawsuits and official notices can be delivered.`,
    },
    ...(change.newAgentConsentRequired
      ? [{ title: "Get the new agent's consent", body: `${j.name} requires the new agent to consent to the appointment. A registered agent service handles this for you.` }]
      : []),
    {
      title: `File the ${change.formName}`,
      body: `Submit it to the state with the fee shown above. The official source is linked below.`,
    },
    {
      title: "Check the state's record",
      body: `Once ${j.name} accepts the filing, its business search shows the new agent. Legal papers go to the new agent from then on.`,
    },
  ];

  const faq: FaqItem[] = [
    {
      q: `What form changes a registered agent in ${j.name}?`,
      a: `The ${change.formName}.`,
    },
    ...(lowestFeeText
      ? [
          {
            q: `How much does it cost to change a registered agent in ${j.name}?`,
            a: `The state's fee is ${feeSentence(j.name, change.governmentFeeCents)}. With Filewell, our filing of the change is included in registered agent service${priceText ? ` at ${priceText} a year` : ""}.`,
          },
        ]
      : []),
    {
      q: `Can I change my ${j.name} registered agent myself?`,
      a: `Yes. You can file the ${change.formName} with the state yourself and pay only the state fee. Or we file it for you when you switch to Filewell.`,
    },
  ];
  return { fees, lowestFeeText, steps, faq };
}

const ARTICLE: Record<string, string> = { llc: "an LLC", corporation: "a corporation" };

/** "$5.00 for an LLC and $25.00 for a corporation", verified fees only. */
function feeSentence(stateName: string, feeCents: Partial<Record<string, number>>): string {
  const parts = RA_ENTITY_TYPES.flatMap((t) => {
    const fee = feeCents[t];
    if (typeof fee !== "number") return [];
    return [`${fee === 0 ? "nothing" : formatCents(fee)} for ${ARTICLE[t] ?? ENTITY_TYPE_LABELS[t]}`];
  });
  return parts.length ? parts.join(" and ") : `not yet verified for ${stateName}`;
}
