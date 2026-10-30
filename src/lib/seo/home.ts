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
      ? `${site.name}: Annual Report Filing and Registered Agent Service`
      : `${site.name}: Annual Report Filing Service`,
    description: businessServicesLive
      ? "Annual report filing and registered agent service for LLCs and corporations. See what's due and what the state charges, then let us handle it."
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

/** The home FAQ answer to "Which states do you support?", from the states actually open for filing. */
export function supportedStatesAnswer(stateNames: string[]): string {
  const names = [...stateNames].sort((a, b) => a.localeCompare(b));
  const lead = names.length ? `We file annual reports in ${listNames(names)} today.` : "We're adding states now.";
  return `${lead} We add a state only after checking its requirements against official government sources. Until then, we list it as not yet verified and link to the state's own website.`;
}
