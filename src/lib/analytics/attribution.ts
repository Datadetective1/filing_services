/**
 * First-touch / last-touch acquisition attribution. Pure functions (no I/O) so the
 * classification matrix is unit-testable; the proxy writes the cookie and the server
 * reads it.
 *
 * Privacy: first-party only. A touch keeps the source, medium, campaign, the referrer's
 * HOST (never the full referring URL), the landing path (no query string) and the date.
 * No personal data, no cross-site identifiers.
 */

export const ATTRIBUTION_COOKIE = "fw_attr";
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 180;

/** Sources the dashboard groups by. Anything else from a utm_source is kept as "other:<value>" -> "other". */
export const KNOWN_SOURCES = [
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "linkedin",
  "facebook",
  "reddit",
  "direct",
  "referral",
  "accountant_referral",
  "manual_outreach",
  "reminder",
  "future_postcard",
  "other",
] as const;
export type KnownSource = (typeof KNOWN_SOURCES)[number];

export interface Touch {
  /** Source, e.g. google, linkedin, accountant_referral, direct. */
  s: string;
  /** Medium, e.g. organic, social, email, referral, none. */
  m: string;
  /** Campaign or partner code. */
  c?: string;
  /** Referrer host only. */
  r?: string;
  /** Landing path, no query string. */
  lp: string;
  /** ISO date (YYYY-MM-DD). */
  t: string;
}

export interface Attribution {
  v: 1;
  ft: Touch;
  lt: Touch;
}

const clean = (v: string | null | undefined, max = 60) => {
  const s = (v ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return s ? s.slice(0, max) : undefined;
};

const SEARCH: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)search\.yahoo\.com$/, "yahoo"],
];
const SOCIAL: [RegExp, string][] = [
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)(reddit\.com|redd\.it)$/, "reddit"],
];

const SOURCE_ALIASES: Record<string, string> = {
  li: "linkedin",
  fb: "facebook",
  meta: "facebook",
  accountant: "accountant_referral",
  partner: "accountant_referral",
  outreach: "manual_outreach",
  postcard: "future_postcard",
  mail: "future_postcard",
};

const DEFAULT_MEDIUM: Record<string, string> = {
  google: "organic",
  bing: "organic",
  duckduckgo: "organic",
  yahoo: "organic",
  linkedin: "social",
  facebook: "social",
  reddit: "social",
  accountant_referral: "referral",
  manual_outreach: "outreach",
  reminder: "email",
  future_postcard: "mail",
  referral: "referral",
  direct: "none",
};

export function normalizeSource(raw: string | undefined): string {
  if (!raw) return "direct";
  const s = SOURCE_ALIASES[raw] ?? raw;
  return (KNOWN_SOURCES as readonly string[]).includes(s) ? s : "other";
}

export interface TouchInput {
  url: URL;
  /** The Referer header, if any. */
  referrer: string | null;
  /** Our own hosts (canonical and current), so internal navigation is ignored. */
  selfHosts: string[];
  today: string;
}

/**
 * Classify one page request. Returns null for internal navigation (referrer is our own
 * site and no campaign parameters), which never changes attribution.
 */
export function classifyTouch({ url, referrer, selfHosts, today }: TouchInput): Touch | null {
  const q = url.searchParams;
  const lp = url.pathname.slice(0, 200);
  let refHost: string | undefined;
  try {
    refHost = referrer ? new URL(referrer).hostname.toLowerCase() : undefined;
  } catch {
    refHost = undefined;
  }
  const internal = Boolean(refHost && selfHosts.includes(refHost));

  const utmSource = clean(q.get("utm_source"));
  const utmMedium = clean(q.get("utm_medium"));
  const utmCampaign = clean(q.get("utm_campaign"), 80);
  const partner = clean(q.get("ref"), 40);

  if (utmSource) {
    const s = normalizeSource(utmSource);
    return { s, m: utmMedium ?? DEFAULT_MEDIUM[s] ?? "other", c: utmCampaign ?? (s === "other" ? utmSource : undefined), r: internal ? undefined : refHost, lp, t: today };
  }
  if (partner) {
    return { s: "accountant_referral", m: "referral", c: partner, r: internal ? undefined : refHost, lp, t: today };
  }
  if (/^\/rs\/[^/]+$/.test(url.pathname)) {
    return { s: "reminder", m: "email", lp, t: today };
  }
  if (/^\/m\/[^/]+$/.test(url.pathname)) {
    return { s: "future_postcard", m: "mail", lp, t: today };
  }
  if (internal) return null;
  if (refHost) {
    for (const [re, s] of SEARCH) if (re.test(refHost)) return { s, m: "organic", r: refHost, lp, t: today };
    for (const [re, s] of SOCIAL) if (re.test(refHost)) return { s, m: "social", r: refHost, lp, t: today };
    return { s: "referral", m: "referral", r: refHost.slice(0, 100), lp, t: today };
  }
  return { s: "direct", m: "none", lp, t: today };
}

/**
 * Merge a new touch into existing attribution. First touch never changes. Last touch
 * follows the usual "last non-direct click": a direct visit doesn't overwrite a known
 * source.
 */
export function mergeTouch(existing: Attribution | null, touch: Touch | null): Attribution | null {
  if (!touch) return existing;
  if (!existing) return { v: 1, ft: touch, lt: touch };
  if (touch.s === "direct") return existing;
  return { ...existing, lt: touch };
}

function validTouch(t: unknown): t is Touch {
  if (!t || typeof t !== "object") return false;
  const o = t as Record<string, unknown>;
  const str = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;
  return (
    str(o.s, 60) &&
    str(o.m, 60) &&
    str(o.lp, 200) &&
    typeof o.t === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.t) &&
    (o.c === undefined || str(o.c, 80)) &&
    (o.r === undefined || str(o.r, 100))
  );
}

export function parseAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw || raw.length > 2000) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (v.v !== 1 || !validTouch(v.ft) || !validTouch(v.lt)) return null;
    return { v: 1, ft: v.ft, lt: v.lt };
  } catch {
    return null;
  }
}

export function serializeAttribution(a: Attribution): string {
  return JSON.stringify(a);
}

/** Flat properties stored on analytics events and summaries (no personal data). */
export function attributionProperties(a: Attribution | null): Record<string, string> {
  if (!a) return { ft_source: "unknown", lt_source: "unknown" };
  const out: Record<string, string> = {
    ft_source: a.ft.s,
    ft_medium: a.ft.m,
    lt_source: a.lt.s,
    lt_medium: a.lt.m,
    ft_landing: a.ft.lp,
  };
  if (a.ft.c) out.ft_campaign = a.ft.c;
  if (a.lt.c) out.lt_campaign = a.lt.c;
  if (a.lt.r) out.lt_referrer = a.lt.r;
  return out;
}

/** Paid media we might run later. Everything else is $0-paid-media acquisition. */
export const PAID_SOURCES = new Set(["future_postcard"]);
