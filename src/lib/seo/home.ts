import type { Metadata } from "next";
import { site } from "@/config/site";
import { pageMetadata } from "./metadata";

/**
 * Home page title and description. The title leads with what people search for (annual
 * report filing, and registered agent service once those pages are live) and keeps the
 * brand first.
 */
export function homeMetadata(businessServicesLive: boolean): Metadata {
  return pageMetadata({
    title: businessServicesLive
      ? `${site.name}: Registered Agent Service and Annual Report Filing`
      : `${site.name}: Annual Report Filing Service`,
    description: businessServicesLive
      ? "Registered agent service in every state at one yearly price, and annual report filing for LLCs and corporations. See what's due, then let us handle it."
      : site.description,
    path: "/",
    absoluteTitle: true,
  });
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** What else is open, beyond the annual reports Filewell files itself. */
export interface MoreServices {
  /** States where a partner registered agent files the annual report for us. */
  partnerReportStates?: number;
  /** Registered agent service is sold in every state. */
  registeredAgentEverywhere?: boolean;
  /** Where we form LLCs and corporations, like "42 states, DC and Puerto Rico". */
  formationPlaces?: string;
}

/** The home FAQ answer to "Which states do you support?", from the states actually open for filing. */
export function supportedStatesAnswer(stateNames: string[], reminderOnlyNames: string[] = [], more: MoreServices = {}): string {
  const names = [...stateNames].sort((a, b) => a.localeCompare(b));
  const lead = names.length ? `We file annual reports in ${listNames(names)} today.` : "We're adding states now.";
  // Annual reports a partner registered agent files for us, so this answer agrees with the
  // state count on the plan cards.
  const partner =
    more.partnerReportStates && more.partnerReportStates > 0
      ? ` In ${more.partnerReportStates} more ${more.partnerReportStates === 1 ? "state" : "states"}, our partner registered agent files it for us.`
      : "";
  // States a visitor can pick in the search but where we don't file yet, so the picker and
  // this answer never seem to disagree.
  const reminders = [...reminderOnlyNames].sort((a, b) => a.localeCompare(b));
  const also = reminders.length
    ? ` In ${listNames(reminders)}, you can look up your due date and get free reminders.`
    : "";
  const agent = more.registeredAgentEverywhere ? " Our registered agent service covers every state." : "";
  const formation = more.formationPlaces ? ` We form LLCs and corporations in ${more.formationPlaces}.` : "";
  return `${lead}${partner}${also}${agent}${formation} We add a state only after checking its requirements against official government sources. Until then, we list it as not yet verified.`;
}
