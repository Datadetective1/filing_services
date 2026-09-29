import { CANONICAL_PRODUCTION_URL, site } from "./site";

/**
 * Known deployment targets, so tests and operator scripts can refuse to touch
 * production by accident. Project refs and hostnames are not secrets (they appear
 * in public URLs). Plain module: safe to import from scripts, tests and the proxy.
 */

export const PRODUCTION_SUPABASE_REF = "tnwpcprvetxtgyjuncrl";
export const STAGING_SUPABASE_REF = "iskphxoowsiuvvojswty";

/** Public hosts that serve the production app (canonical, apex, and the Vercel project alias). */
export const PRODUCTION_HOSTS: readonly string[] = [new URL(CANONICAL_PRODUCTION_URL).hostname, site.domain, "filewell.vercel.app"];

function hostnameOf(urlOrHost: string): string | null {
  const value = urlOrHost.trim();
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

/** The project ref of a hosted Supabase URL (https://<ref>.supabase.co), or null (local stack, other host, invalid). */
export function supabaseRefOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const host = hostnameOf(url);
  const match = host ? /^([a-z0-9]+)\.supabase\.(co|in)$/.exec(host) : null;
  return match ? match[1] : null;
}

/** True when the URL names the production Supabase project. Fails closed: any mention of the ref counts. */
export function isProductionSupabaseUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return supabaseRefOf(url) === PRODUCTION_SUPABASE_REF || url.toLowerCase().includes(PRODUCTION_SUPABASE_REF);
}

/** True when a URL or bare host is one of the public production hosts. */
export function isProductionHost(urlOrHost: string | null | undefined): boolean {
  if (!urlOrHost) return false;
  const host = hostnameOf(urlOrHost);
  return host !== null && PRODUCTION_HOSTS.includes(host);
}

export interface SupabaseTarget {
  ref: string | null;
  host: string;
  production: boolean;
  /** For logs, e.g. "iskphxoowsiuvvojswty (staging)". Never contains a secret. */
  label: string;
}

export function describeSupabaseTarget(url: string): SupabaseTarget {
  const ref = supabaseRefOf(url);
  const host = hostnameOf(url) ?? "unknown host";
  const production = isProductionSupabaseUrl(url);
  const kind = production
    ? "PRODUCTION"
    : ref === STAGING_SUPABASE_REF
      ? "staging"
      : host === "localhost" || host === "127.0.0.1"
        ? "local"
        : "unrecognized";
  return { ref, host, production, label: `${ref ?? host} (${kind})` };
}

/**
 * For operator scripts: the target project, or an error when it is production and
 * CONFIRM_PRODUCTION does not name the production ref exactly.
 */
export function assertSupabaseTargetAllowed(
  url: string,
  script: string,
  env: Record<string, string | undefined> = process.env,
): SupabaseTarget {
  const target = describeSupabaseTarget(url);
  if (target.production && env.CONFIRM_PRODUCTION !== PRODUCTION_SUPABASE_REF) {
    throw new Error(
      `${script} is pointed at the PRODUCTION Supabase project (${PRODUCTION_SUPABASE_REF}). Refusing to run. ` +
        `If this is intended, run it again with CONFIRM_PRODUCTION=${PRODUCTION_SUPABASE_REF}.`,
    );
  }
  return target;
}

/**
 * On the production deployment, a request that arrives on a *.vercel.app alias is
 * sent to the same path on the canonical domain (sessions, auth links and payment
 * returns all live there). API routes (cron, webhooks) are never redirected.
 */
export function canonicalRedirectUrl(input: { host: string | null; pathname: string; search: string; production: boolean }): string | null {
  if (!input.production || !input.host) return null;
  const host = hostnameOf(input.host);
  if (!host || !host.endsWith(".vercel.app")) return null;
  if (input.pathname === "/api" || input.pathname.startsWith("/api/")) return null;
  return `${CANONICAL_PRODUCTION_URL}${input.pathname}${input.search}`;
}
