import { site } from "@/config/site";

/**
 * Date the legal drafts were last revised (ISO). Bump it whenever the text of any
 * legal page changes: it is shown on every legal page and recorded with each filing
 * authorization as the version of the Terms and Refund Policy the customer agreed to.
 */
export const LEGAL_LAST_UPDATED = "2026-10-01";

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

/**
 * Postal address for legal notices. Until a public address is approved we point to support
 * email rather than publish a private (e.g. residential) address.
 */
export function postalAddressText(): string {
  return site.postalAddress ?? `available on request from ${site.supportEmail}`;
}

/**
 * Governing-law jurisdiction for the terms, or null until the owner chooses one. The
 * terms omit the clause entirely while it is null: never a placeholder, never a guess.
 */
export function governingLawText(): string | null {
  return site.governingLaw;
}

/** Who operates the service, for copyright lines: the legal entity once configured, otherwise the brand. */
export function operatorName(): string {
  return site.legalEntityConfigured ? site.legalEntity : site.name;
}
