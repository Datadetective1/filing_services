import { site } from "@/config/site";

/**
 * Date the legal drafts were last revised (ISO). Bump it whenever the text of any
 * legal page changes: it is shown on every legal page and recorded with each filing
 * authorization as the version of the Terms and Refund Policy the customer agreed to.
 */
export const LEGAL_LAST_UPDATED = "2026-11-01";

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
 * Assumed name (DBA) on file. Harborlune LLC filed "Filewell" as an assumed name with the
 * Texas Secretary of State on Oct 31, 2026 (Form 503). The legal pages name the company with
 * its assumed name only while the configured entity and brand match this filing.
 */
export const ASSUMED_NAME_FILING = {
  entity: "Harborlune LLC",
  entityDescription: "a Texas limited liability company",
  assumedName: "Filewell",
  registry: "the Texas Secretary of State",
} as const;

function assumedNameOnFile(): boolean {
  return (
    site.legalEntityConfigured &&
    site.legalEntity === ASSUMED_NAME_FILING.entity &&
    site.name === ASSUMED_NAME_FILING.assumedName
  );
}

/**
 * The operator as legal pages introduce it: "Harborlune LLC, a Texas limited liability company
 * doing business as Filewell" while the assumed-name filing matches, otherwise legalEntityText().
 */
export function operatorIntroText(): string {
  if (!assumedNameOnFile()) return legalEntityText();
  return `${ASSUMED_NAME_FILING.entity}, ${ASSUMED_NAME_FILING.entityDescription} doing business as ${ASSUMED_NAME_FILING.assumedName}`;
}

/** One sentence naming the assumed-name registration, or null when no filing matches. */
export function assumedNameNoticeText(): string | null {
  if (!assumedNameOnFile()) return null;
  return `${ASSUMED_NAME_FILING.assumedName} is an assumed name of ${ASSUMED_NAME_FILING.entity}, registered with ${ASSUMED_NAME_FILING.registry}.`;
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
