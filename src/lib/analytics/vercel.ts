/**
 * Rules for what Vercel Web Analytics may record. Kept free of browser globals so it
 * can be unit tested; the client component passes in the privacy signal.
 */

/** Paths that are never sent: staff console, test checkout, sign-in callbacks. */
const SKIPPED_PREFIXES = ["/admin", "/sandbox", "/auth"];

/** Query keys kept on a page view. Everything else (tokens, emails, ids) is dropped. */
const KEPT_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/**
 * Returns the URL to record, or null to skip the page view. Strips every query
 * parameter except campaign tags and drops the hash.
 */
export function sanitizeAnalyticsUrl(rawUrl: string, privacySignal: boolean): string | null {
  if (privacySignal) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const path = url.pathname;
  if (SKIPPED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null;
  const kept = new URLSearchParams();
  for (const key of KEPT_PARAMS) {
    const value = url.searchParams.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return `${url.origin}${path}${query ? `?${query}` : ""}`;
}
