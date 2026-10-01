import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  attributionProperties,
  classifyTouch,
  mergeTouch,
  normalizeSource,
  parseAttribution,
  serializeAttribution,
  type Attribution,
} from "@/lib/analytics/attribution";
import { findRule } from "@/lib/compliance/registry";
import {
  confirmationEmail,
  nextReminderDueDate,
  plannedSubscriberReminders,
  REMINDER_CONSENT_TEXT,
  reminderEmail,
} from "@/lib/reminders/subscriber-plan";
import { PA_GUIDES } from "@/lib/seo/pa-guides";

const SELF = ["www.getfilewell.com", "getfilewell.com"];
const touch = (url: string, referrer: string | null = null) =>
  classifyTouch({ url: new URL(url), referrer, selfHosts: SELF, today: "2026-10-01" });

describe("attribution: classifying a page load", () => {
  it("search engines are organic", () => {
    expect(touch("https://www.getfilewell.com/pennsylvania/annual-report-fee", "https://www.google.com/")).toMatchObject({
      s: "google",
      m: "organic",
      r: "www.google.com",
      lp: "/pennsylvania/annual-report-fee",
    });
    expect(touch("https://www.getfilewell.com/", "https://www.bing.com/search?q=x")).toMatchObject({ s: "bing", m: "organic" });
    expect(touch("https://www.getfilewell.com/", "https://duckduckgo.com/")).toMatchObject({ s: "duckduckgo" });
  });

  it("social sites are social", () => {
    expect(touch("https://www.getfilewell.com/", "https://www.linkedin.com/feed/")).toMatchObject({ s: "linkedin", m: "social" });
    expect(touch("https://www.getfilewell.com/", "https://lnkd.in/abc")).toMatchObject({ s: "linkedin" });
    expect(touch("https://www.getfilewell.com/", "https://m.facebook.com/")).toMatchObject({ s: "facebook" });
    expect(touch("https://www.getfilewell.com/", "https://old.reddit.com/r/smallbusiness")).toMatchObject({ s: "reddit", m: "social" });
  });

  it("utm tags win, with aliases normalized and unknown sources grouped", () => {
    expect(touch("https://www.getfilewell.com/?utm_source=LinkedIn&utm_medium=social&utm_campaign=Launch%20Post")).toMatchObject({
      s: "linkedin",
      m: "social",
      c: "launch_post",
    });
    expect(touch("https://www.getfilewell.com/?utm_source=outreach")).toMatchObject({ s: "manual_outreach", m: "outreach" });
    expect(touch("https://www.getfilewell.com/?utm_source=reminder&utm_medium=email")).toMatchObject({ s: "reminder", m: "email" });
    expect(touch("https://www.getfilewell.com/?utm_source=newsletter-xyz")).toMatchObject({ s: "other", c: "newsletter-xyz" });
    expect(normalizeSource("postcard")).toBe("future_postcard");
  });

  it("partner links, postcards and reminder links", () => {
    expect(touch("https://www.getfilewell.com/?ref=Smith-CPA")).toMatchObject({ s: "accountant_referral", m: "referral", c: "smith-cpa" });
    expect(touch("https://www.getfilewell.com/m/abcd1234-77-XXXX")).toMatchObject({ s: "future_postcard", m: "mail" });
    expect(touch("https://www.getfilewell.com/rs/token.sig")).toMatchObject({ s: "reminder", m: "email" });
  });

  it("other sites are referrals; no referrer is direct; internal navigation is ignored", () => {
    expect(touch("https://www.getfilewell.com/", "https://someblog.example.com/post")).toMatchObject({ s: "referral", r: "someblog.example.com" });
    expect(touch("https://www.getfilewell.com/pricing")).toMatchObject({ s: "direct", m: "none" });
    expect(touch("https://www.getfilewell.com/pricing", "https://www.getfilewell.com/")).toBeNull();
  });

  it("never keeps the referring URL's path or query, or the landing query", () => {
    const t = touch("https://www.getfilewell.com/find?email=a@b.com", "https://www.google.com/search?q=secret");
    expect(t?.r).toBe("www.google.com");
    expect(t?.lp).toBe("/find");
    expect(JSON.stringify(t)).not.toContain("secret");
    expect(JSON.stringify(t)).not.toContain("a@b.com");
  });
});

describe("attribution: first and last touch", () => {
  const g = touch("https://www.getfilewell.com/", "https://www.google.com/")!;
  const li = touch("https://www.getfilewell.com/", "https://www.linkedin.com/")!;
  const direct = touch("https://www.getfilewell.com/")!;

  it("first touch never changes; last touch is the last non-direct visit", () => {
    const a = mergeTouch(null, g)!;
    expect(a.ft.s).toBe("google");
    const b = mergeTouch(a, li)!;
    expect(b.ft.s).toBe("google");
    expect(b.lt.s).toBe("linkedin");
    expect(mergeTouch(b, direct)).toBe(b);
    expect(mergeTouch(b, null)).toBe(b);
  });

  it("round-trips through the cookie and rejects tampered or oversized values", () => {
    const a = mergeTouch(null, li) as Attribution;
    expect(parseAttribution(serializeAttribution(a))).toEqual(a);
    expect(parseAttribution("{")).toBeNull();
    expect(parseAttribution(JSON.stringify({ v: 2, ft: a.ft, lt: a.lt }))).toBeNull();
    expect(parseAttribution(JSON.stringify({ v: 1, ft: { ...a.ft, s: "x".repeat(500) }, lt: a.lt }))).toBeNull();
    expect(parseAttribution("x".repeat(3000))).toBeNull();
  });

  it("flattens to event properties without personal data", () => {
    const a = mergeTouch(mergeTouch(null, g), touch("https://www.getfilewell.com/?ref=smith-cpa"))!;
    expect(attributionProperties(a)).toMatchObject({ ft_source: "google", lt_source: "accountant_referral", lt_campaign: "smith-cpa" });
    expect(attributionProperties(null)).toEqual({ ft_source: "unknown", lt_source: "unknown" });
  });
});

describe("free reminder subscriptions: schedule and wording", () => {
  const lp = findRule("PA", "lp")!;
  const llc = findRule("PA", "llc")!;

  it("reminds about the next due date that hasn't passed", () => {
    expect(nextReminderDueDate(lp, "2020-05-01", "2026-10-01")).toEqual({ periodYear: 2026, dueDate: "2026-12-31" });
    // The LLC deadline (September 30) has passed: we never chase it, we remind about next year's.
    expect(nextReminderDueDate(llc, "2020-05-01", "2026-10-01")).toEqual({ periodYear: 2027, dueDate: "2027-09-30" });
    // Formed this year: the first report is next year.
    expect(nextReminderDueDate(lp, "2026-03-01", "2026-10-01")?.dueDate).toBe("2027-12-31");
  });

  it("plans at most three reminders (60, 30, 7 days before), dropping past dates", () => {
    expect(plannedSubscriberReminders("2026-12-31", "2026-10-01").map((r) => r.scheduledFor)).toEqual(["2026-11-01", "2026-12-01", "2026-12-24"]);
    expect(plannedSubscriberReminders("2026-12-31", "2026-12-10").map((r) => r.offsetDays)).toEqual([-7]);
  });

  it("consent text is explicit about what is sent and how to stop", () => {
    expect(REMINDER_CONSENT_TEXT).toMatch(/confirmation email/);
    expect(REMINDER_CONSENT_TEXT).toMatch(/up to three reminders a year/);
    expect(REMINDER_CONSENT_TEXT).toMatch(/unsubscribe at any time/);
  });

  it("emails say 'may be due', separate the fees, offer direct filing and never claim a status", () => {
    const vars = { businessName: "Daff Partners LP", dueDate: "2026-12-31", stateFeeCents: 700, nonprofitFeeCents: 0, serviceFeeCents: 4900 };
    const r = reminderEmail(vars, -30);
    const c = confirmationEmail(vars);
    expect(r.subject).toContain("may be due by December 31, 2026");
    expect(r.body).toContain("file.dos.pa.gov for the $7.00 state fee");
    expect(r.body).toContain("$49.00 service fee plus the $7.00 state fee");
    expect(r.body).toContain("not the Pennsylvania Department of State");
    expect(c.body).toContain("ignore this email");
    for (const text of [r.subject, r.body, c.subject, c.body]) {
      expect(text).not.toMatch(/\b(overdue|delinquent|unfiled|not filed|penalt\w*|late fee|final notice|urgent|act now|compliant)\b/i);
    }
  });
});

describe("Pennsylvania guide pages", () => {
  it("cover the requested high-intent topics", () => {
    expect(PA_GUIDES.map((g) => g.slug)).toEqual([
      "annual-report-deadline",
      "annual-report-fee",
      "how-to-file-annual-report",
      "annual-report-after-deadline",
      "business-search",
    ]);
  });

  it("cite official sources, stay calm and never claim anyone's filing status", () => {
    for (const g of PA_GUIDES) {
      expect(g.sources.length).toBeGreaterThan(0);
      expect(g.sources.every((s) => /^https:\/\/(www\.pa\.gov|www\.palegis\.us|file\.dos\.pa\.gov|data\.pa\.gov)\//.test(s.url))).toBe(true);
      const text = JSON.stringify(g);
      expect(text).not.toMatch(/\b(penalt\w*|final notice|act now|urgent|overdue|unfiled|delinquent)\b/i);
      expect(g.title.length).toBeLessThanOrEqual(80);
      expect(g.description.length).toBeLessThanOrEqual(200);
    }
  });

  it("the shared template shows the fee split, direct filing and the last-checked date", () => {
    const src = readFileSync("src/app/(marketing)/pennsylvania/[topic]/page.tsx", "utf8");
    expect(src).toContain("PriceBreakdown");
    expect(src).toContain("You don&apos;t need a filing service");
    expect(src).toContain("Checked against official Pennsylvania sources on");
  });
});

describe("indexing: robots.txt and sitemap", () => {
  beforeEach(() => {
    for (const k of ["VERCEL_ENV", "NEXT_PUBLIC_VERCEL_ENV", "NEXT_PUBLIC_ALLOW_INDEXING", "NEXT_PUBLIC_SITE_URL"]) vi.stubEnv(k, undefined);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("keeps private, signed and per-person URLs out of crawlers' reach", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).toEqual(
      expect.arrayContaining(["/admin", "/dashboard", "/file", "/api/", "/sandbox", "/auth/", "/r/", "/rs/", "/m/", "/unsubscribe", "/outreach/", "/reminders/", "/find/result"]),
    );
  });

  it("lists the public guides and no private URLs", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    for (const g of PA_GUIDES) expect(urls).toContain(`/pennsylvania/${g.slug}`);
    for (const u of urls) expect(u).not.toMatch(/^\/(admin|dashboard|file|api|sandbox|auth|r|rs|m|reminders|outreach|unsubscribe|find|login|signup)(\/|$)/);
  });

  it("sends a noindex header on signed and private paths whatever the build", () => {
    const cfg = readFileSync("next.config.ts", "utf8");
    expect(cfg).toContain('"/(m|rs|r|reminders|outreach|unsubscribe|auth)/:path*"');
    expect(cfg).toContain('source: "/find/result"');
    expect(cfg).toContain('"/(dashboard|admin|file|sandbox)/:path*"');
  });
});

describe("no cold outreach is possible from the acquisition tools", () => {
  it("the founder and partner CRM modules contain no sending code", () => {
    for (const f of ["src/lib/acquisition/founder.ts", "src/lib/acquisition/partners.ts", "src/lib/acquisition/dashboard.ts", "src/app/admin/acquisition/actions.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/email\/provider|getEmailProvider|resend|sendNotification|outreach\/lob|createLobPostcard|fetch\(/i);
    }
  });

  it("reminder subscriptions are only created from the visitor's own form submission with explicit consent", () => {
    const src = readFileSync("src/app/(marketing)/find/reminder-actions.ts", "utf8");
    expect(src).toContain('z.literal("yes"');
    expect(src).toContain("readPendingLookup()");
    const lib = readFileSync("src/lib/reminders/subscribers.ts", "utf8");
    expect(lib).not.toMatch(/state_entity_records|prospects|contact_points/);
  });
});
