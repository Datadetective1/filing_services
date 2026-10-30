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
