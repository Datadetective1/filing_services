import { site } from "@/config/site";

/**
 * Date the legal drafts were last revised (ISO). Bump it whenever the text of any
 * legal page changes: it is shown on every legal page and recorded with each filing
 * authorization as the version of the Terms and Refund Policy the customer agreed to.
 */
export const LEGAL_LAST_UPDATED = "2026-09-29";

export const LEGAL_PAGES = [
  { path: "/legal/terms", title: "Terms of service" },
  { path: "/legal/privacy", title: "Privacy policy" },
  { path: "/legal/refunds", title: "Refund policy" },
  { path: "/legal/filing-authorization", title: "Filing authorization" },
  { path: "/legal/disclaimer", title: "Disclaimer" },
] as const;

/** The operating company's legal name for legal pages, or a bracketed placeholder until it is configured. */
export function legalEntityText(): string {
  return site.legalEntityConfigured ? site.legalEntity : "[legal name of the operating company, to be confirmed]";
}

/** Postal address for legal notices, or a bracketed placeholder until it is configured. */
export function postalAddressText(): string {
  return site.postalAddress ?? "[postal address to be confirmed]";
}

/** Who operates the service, for copyright lines: the legal entity once configured, otherwise the brand. */
export function operatorName(): string {
  return site.legalEntityConfigured ? site.legalEntity : site.name;
}
