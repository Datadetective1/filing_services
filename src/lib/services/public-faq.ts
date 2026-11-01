import type { FaqItem } from "@/lib/compliance/types";
import { PROVIDER_LEGAL_NAME } from "./catalog";

/**
 * Registered agent FAQ. Every answer describes what Filewell does; nothing promises a delivery
 * time, and nothing is legal advice. Provider terms that are not yet signed are stated as
 * how the service works today, not as guarantees.
 */
export const REGISTERED_AGENT_FAQ: FaqItem[] = [
  {
    q: "What does a registered agent do?",
    a: "A registered agent is the person or company your state lists to receive lawsuits (service of process) and official government notices for your business. Most states require every LLC and corporation to have one, with a physical address in the state.",
  },
  {
    q: "Who is the registered agent on the state's record?",
    a: `${PROVIDER_LEGAL_NAME}, our registered agent provider. Its name and address appear on the state's record as your agent. Filewell is your point of contact: we receive what arrives, add it to your dashboard and email you.`,
  },
  {
    q: "How will I know when something arrives?",
    a: "We scan it to your secure dashboard and email you, so you can read it from anywhere. Keep your email up to date so nothing gets missed.",
  },
  {
    q: "Is regular mail included?",
    a: "Legal documents and government notices are always included. Regular mail is scanned too, with a few items a year included. Junk mail is filtered out.",
  },
  {
    q: "How does switching from my current agent work?",
    a: "The state has to be told. We file the change of registered agent with your state; you pay the state's fee, and our filing service is included. Your service becomes active once the state's record shows the change.",
  },
  {
    q: "When is my service active?",
    a: "As soon as we confirm your appointment, and for a switch, once the state shows the change. We email you when it's active.",
  },
  {
    q: "How does renewal work?",
    a: "Service renews every year at the same published price, charged to your card on file. We email you 30 and 7 days before each renewal. You can turn off renewal in your dashboard at any time before the renewal date.",
  },
  {
    q: "What happens if I cancel?",
    a: "Turn off renewal in your dashboard and your service runs to the end of the year you paid for. Before it ends, name your new agent with the state so your business stays in good standing.",
  },
  {
    q: "Can I be my own registered agent?",
    a: "Usually, yes, if you have a physical address in the state and are there during business hours. Many owners use a service for privacy, and so legal documents go to an address that is staffed every business day.",
  },
];

/**
 * A short FAQ for one jurisdiction's registered agent page. Only verified facts are used: the
 * state's change-of-agent form, how a new business names its agent and Filewell's own terms.
 */
export function stateRegisteredAgentFaq(input: {
  stateName: string;
  priceText: string | null;
  changeFormName: string;
  appointmentProcess: string | null;
}): FaqItem[] {
  const { stateName, priceText, changeFormName, appointmentProcess } = input;
  const out: FaqItem[] = [
    {
      q: `Do I need a registered agent in ${stateName}?`,
      a: `Yes, if your LLC or corporation is formed in ${stateName} or registered to do business there. The state lists a registered agent with an address in ${stateName} to receive lawsuits and official notices for your business. Using a service keeps your home address off that public record.`,
    },
  ];
  if (appointmentProcess) {
    out.push({
      q: `How do I name a registered agent when I form a new LLC in ${stateName}?`,
      a: `${appointmentProcess} Order your registered agent first and we give you the details to put in your filing.`,
    });
  }
  out.push(
    {
      q: `How do I change my registered agent in ${stateName}?`,
      a: `The state's filing is the ${changeFormName}. We file it for you; you pay only the state's fee, shown before you pay.`,
    },
    {
      q: `How much does registered agent service in ${stateName} cost with Filewell?`,
      a: `${priceText ? `${priceText} a year per business, and the same price when it renews. ` : ""}Legal documents and government notices are scanned to your dashboard and emailed to you. Turn off renewal any time.`,
    },
  );
  return out;
}
