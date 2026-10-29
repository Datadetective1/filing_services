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
    a: "We add it to your dashboard and email you, usually within one business day after it reaches us. That isn't a guarantee, and documents that arrive on a weekend or holiday are handled the next business day. We may also call about a legal document. Please keep your email and phone number up to date: we send notices to the details on your account.",
  },
  {
    q: "Is regular mail included?",
    a: "Legal documents and government notices are always included. Regular mail that isn't junk is scanned for you. A few items a year are included; beyond that there may be a per-item charge, and we'll tell you the price before anything is charged. Packages and account verification cards from online services are not accepted.",
  },
  {
    q: "How does switching from my current agent work?",
    a: "The state has to be told. We file the change of registered agent with your state; you pay the state's fee, and our filing service is included. Your service becomes active once the state's record shows the change.",
  },
  {
    q: "When is my service active?",
    a: "Only after we confirm the appointment with our provider (and, when you switch, after the state records the change). Paying starts the order; it doesn't make the service active by itself.",
  },
  {
    q: "How does renewal work?",
    a: "Service renews every year at the same published price, charged to your card on file. We email you 30 and 7 days before each renewal. You can turn off renewal in your dashboard at any time before the renewal date.",
  },
  {
    q: "What happens if I cancel?",
    a: "Turning off renewal stops future charges, and your service stays in place until the end of the year you paid for. Before then, name a new registered agent with the state. If we are still listed after your service ends, our provider may resign as your agent, which can affect your good standing.",
  },
  {
    q: "Can I be my own registered agent?",
    a: "Usually, yes, if you have a physical address in the state and are there during business hours. Many owners use a service for privacy, and so legal documents go to an address that is staffed every business day.",
  },
  {
    q: "Is this legal advice?",
    a: "No. Filewell is not a law firm and doesn't give legal advice. If you receive a lawsuit, talk to a lawyer.",
  },
];
