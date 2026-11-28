/**
 * Rules for what Google Analytics (GA4) may record. Kept free of browser globals so it
 * can be unit tested; the client component passes in the URL, title and privacy signal.
 *
 * GA only loads when NEXT_PUBLIC_GA_MEASUREMENT_ID is set (Production only in Vercel),
 * and never for visitors who send a Global Privacy Control or Do Not Track signal.
 */

/** Paths that are never sent: staff console, test checkout, sign-in pages and callbacks. */
const SKIPPED_PREFIXES = ["/admin", "/sandbox", "/auth", "/login", "/signup", "/forgot-password", "/reset-password", "/check-email"];

/** Signed-in areas: page titles can hold a customer's business name, so they are replaced. */
const APP_PREFIXES = ["/dashboard", "/file"];

/** Query keys kept on a page view (campaign tags and Google's ad click ID). */
const KEPT_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid"];

const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;
const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{6,})$/i;

/** The configured GA4 Measurement ID, or null when GA is off or the value is malformed. */
export function gaMeasurementId(raw: string | undefined): string | null {
  const id = raw?.trim().toUpperCase();
  return id && MEASUREMENT_ID.test(id) ? id : null;
}

function matches(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export type GaPageView = { page_location: string; page_path: string; page_title: string };

/**
 * Returns the page view to send, or null to skip it. Drops every query parameter except
 * campaign tags and gclid, drops the hash, replaces record IDs in the path with ":id",
 * and replaces page titles in signed-in areas.
 */
export function gaPageView(rawUrl: string, title: string, privacySignal: boolean): GaPageView | null {
  if (privacySignal) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (matches(url.pathname, SKIPPED_PREFIXES)) return null;
  const path = url.pathname
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
  const kept = new URLSearchParams();
  for (const key of KEPT_PARAMS) {
    const value = url.searchParams.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return {
    page_location: `${url.origin}${path}${query ? `?${query}` : ""}`,
    page_path: path,
    page_title: matches(path, APP_PREFIXES) ? `Filewell app ${path}` : title,
  };
}
