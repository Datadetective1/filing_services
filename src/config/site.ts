/**
 * Brand and public site configuration. "Filewell" is a working name — change it
 * here and nowhere else.
 */
export const site = {
  name: "Filewell",
  /** Legal entity that operates the service. Placeholder until the company is named. */
  legalEntity: "Filewell (operating company to be confirmed)",
  tagline: "Never miss a business filing.",
  description:
    "Know what your business needs to file, when it's due, and get it handled. A private filing service for U.S. annual reports.",
  supportEmail: "support@filewell.example",
  disclaimer: "Private filing service. Not affiliated with or endorsed by any government agency.",
} as const;

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Only the production deployment may be indexed. Previews/staging are noindex. */
export function isIndexable(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
}
