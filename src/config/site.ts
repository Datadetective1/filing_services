/**
 * Brand, domain and contact configuration: the one place these live.
 *
 * Every value can be overridden per environment (Vercel env vars), so a rename or
 * a new domain is a configuration change, not a code change. NEXT_PUBLIC_* values
 * are read with static `process.env.X` access so Next can inline them into client
 * bundles.
 */

/** Canonical production origin. Production never builds links on a *.vercel.app host. */
export const CANONICAL_PRODUCTION_URL = "https://www.getfilewell.com";

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "Filewell";
const legalEntity = process.env.NEXT_PUBLIC_LEGAL_ENTITY?.trim() || null;

export const site = {
  name: brandName,
  /** Registrable domain, for sender addresses and copy ("getfilewell.com"). */
  domain: new URL(CANONICAL_PRODUCTION_URL).hostname.replace(/^www\./, ""),
  /** Legal entity that operates the service. Placeholder text until configured. */
  legalEntity: legalEntity ?? `${brandName} (operating company to be confirmed)`,
  legalEntityConfigured: legalEntity !== null,
  /** Physical postal address for email footers and legal pages; null until configured. */
  postalAddress: process.env.NEXT_PUBLIC_POSTAL_ADDRESS?.trim() || null,
  tagline: "Never miss a business filing.",
  description:
    "Know what your business needs to file, when it's due, and get it handled. A private filing service for U.S. annual reports.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@getfilewell.com",
  disclaimer: "Private filing service. Not affiliated with or endorsed by any government agency.",
};

/** True on the Vercel production deployment (server or client). */
export function isProductionEnvironment(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function isNonCanonicalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
  } catch {
    return true;
  }
}

/**
 * Base URL for absolute links (emails, auth redirects, payment returns, canonical
 * tags, sitemap). In production it is always the canonical domain: a missing or
 * non-canonical NEXT_PUBLIC_SITE_URL (a *.vercel.app alias or localhost) is ignored.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (isProductionEnvironment()) {
    return explicit && !isNonCanonicalHost(explicit) ? explicit : CANONICAL_PRODUCTION_URL;
  }
  if (explicit) return explicit;
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Only the production deployment may be indexed, and only when explicitly allowed. */
export function isIndexable(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
}
