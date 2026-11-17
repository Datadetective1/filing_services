import type { FaqItem } from "@/lib/compliance/types";
import { formatCents } from "@/lib/domain/money";
import type { FormationOpenState } from "@/lib/registered-agent/sales";

/**
 * Copy for the one-page-per-state formation guides. Every number comes from the verified
 * formation facts (each with its official source) and the live service price, so a page
 * exists only where formation can be ordered today. Sales pages never link a state's own
 * filing site: sources are named, not linked.
 */

export const formationStatePath = (slug: string) => `/business-formation/${slug}`;

const money = (c: number) => formatCents(c, { trimZeros: true });

/** The entity type the page leads with: LLC where it is open, else corporation. */
export function leadType(s: FormationOpenState): "llc" | "corporation" {
  return s.feeCents.llc !== undefined ? "llc" : "corporation";
}

const TYPE_WORD = { llc: "LLC", corporation: "corporation" } as const;
const A_TYPE = { llc: "an LLC", corporation: "a corporation" } as const;

export function formationStateSnippet(s: FormationOpenState, serviceCents: number | undefined): { title: string; description: string } {
  const t = leadType(s);
  const fee = s.feeCents[t] as number;
  const title = `How to Start ${t === "llc" ? "an LLC" : "a Corporation"} in ${s.name}: ${money(fee)} State Fee`;
  const ours = serviceCents !== undefined ? ` Filewell files it for ${money(serviceCents)}, so ${money(serviceCents + fee)} in total.` : "";
  const other = t === "llc" && s.feeCents.corporation !== undefined ? ` A corporation costs ${money(s.feeCents.corporation)}.` : "";
  let description = `The ${s.name} state fee to form ${A_TYPE[t]} is ${money(fee)}.${ours}${other}`;
  if (description.length > 160) description = `The ${s.name} state fee to form ${A_TYPE[t]} is ${money(fee)}.${ours}`;
  return { title, description };
}

/** The first sentence of the page: the state fee, then our total. */
export function formationStateAnswer(s: FormationOpenState, serviceCents: number | undefined): string {
  const t = leadType(s);
  const fee = s.feeCents[t] as number;
  const ours = serviceCents !== undefined ? ` Filewell files it for ${money(serviceCents)}, so you pay ${money(serviceCents + fee)} in total, with each fee on its own line.` : "";
  return `The ${s.name} state fee to form ${A_TYPE[t]} is ${money(fee)}.${ours}`;
}

/** What the order asks for: the same fields checkout collects, nothing more. */
export function formationNeeds(s: FormationOpenState): string[] {
  const t = leadType(s);
  return [
    "A name for your business that no one else in the state is using.",
    "The business's principal address.",
    t === "llc" && s.feeCents.corporation === undefined
      ? "Who owns it (the members) and whether the members or managers run it."
      : "Who owns or runs it: members and managers for an LLC, directors for a corporation.",
    `A registered agent with a street address in ${s.name}. You can use ours or name anyone who qualifies.`,
    ...(s.code === "WY" ? ["Each owner's name and home address, which our provider must hold for Wyoming businesses."] : []),
    "A contact we can reach with questions about the filing.",
  ];
}

export function formationStateFaq(s: FormationOpenState, input: { serviceCents?: number; raCents?: number }): FaqItem[] {
  const t = leadType(s);
  const fee = s.feeCents[t] as number;
  const out: FaqItem[] = [
    {
      q: `How much does it cost to start ${A_TYPE[t]} in ${s.name}?`,
      a:
        `${s.name} charges ${money(fee)} to form ${A_TYPE[t]}.` +
        (input.serviceCents !== undefined ? ` With Filewell it's ${money(input.serviceCents + fee)} in total: our ${money(input.serviceCents)} fee plus the state's fee, passed through at cost.` : ""),
    },
  ];
  if (t === "llc" && s.feeCents.corporation !== undefined) {
    out.push({
      q: `What does a ${s.name} corporation cost to form?`,
      a: `The ${s.name} state fee for a corporation is ${money(s.feeCents.corporation)}.${input.serviceCents !== undefined ? ` With Filewell it's ${money(input.serviceCents + s.feeCents.corporation)} in total.` : ""}`,
    });
  }
  out.push(
    {
      q: `Do I need a registered agent in ${s.name}?`,
      a: `Yes. Every ${TYPE_WORD[t]} formed in ${s.name} names a registered agent with a street address in the state to receive legal papers. You can be your own agent if you have one, or use a service.${input.raCents !== undefined ? ` Ours is ${money(input.raCents)} a year, the same at renewal, and it's optional when you form with us.` : ""}`,
    },
    {
      q: "What does Filewell's fee cover?",
      a: "We prepare the filing from your answers, a person checks it against the state's rules, we submit it and pay the state's fee at cost, and you get the state's approval in your dashboard.",
    },
    {
      q: "What comes after forming?",
      a: `Most states, ${s.name} included, expect a report or tax filing on a schedule after formation. Our ${s.name} annual report guide shows what's due and when, and we can remind you for free.`,
    },
  );
  return out;
}
