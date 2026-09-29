import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertSupabaseTargetAllowed,
  canonicalRedirectUrl,
  describeSupabaseTarget,
  isProductionHost,
  isProductionSupabaseUrl,
  PRODUCTION_SUPABASE_REF,
  STAGING_SUPABASE_REF,
  supabaseRefOf,
} from "@/config/environments";
import { absoluteUrl, CANONICAL_PRODUCTION_URL, siteUrl } from "@/config/site";

const PROD_DB = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;
const STAGING_DB = `https://${STAGING_SUPABASE_REF}.supabase.co`;

describe("supabase project guards", () => {
  it("reads the project ref from a hosted URL only", () => {
    expect(supabaseRefOf(PROD_DB)).toBe(PRODUCTION_SUPABASE_REF);
    expect(supabaseRefOf(`${STAGING_DB}/rest/v1`)).toBe(STAGING_SUPABASE_REF);
    expect(supabaseRefOf("http://127.0.0.1:54321")).toBeNull();
    expect(supabaseRefOf("not a url")).toBeNull();
    expect(supabaseRefOf(undefined)).toBeNull();
  });

  it("recognizes the production project, and fails closed on any mention of its ref", () => {
    expect(isProductionSupabaseUrl(PROD_DB)).toBe(true);
    expect(isProductionSupabaseUrl(`https://${PRODUCTION_SUPABASE_REF.toUpperCase()}.supabase.co/`)).toBe(true);
    expect(isProductionSupabaseUrl(`https://proxy.example.com/${PRODUCTION_SUPABASE_REF}`)).toBe(true);
    expect(isProductionSupabaseUrl(STAGING_DB)).toBe(false);
    expect(isProductionSupabaseUrl("http://127.0.0.1:54321")).toBe(false);
    expect(isProductionSupabaseUrl(undefined)).toBe(false);
  });

  it("labels targets for script output without secrets", () => {
    expect(describeSupabaseTarget(PROD_DB)).toMatchObject({ production: true, label: `${PRODUCTION_SUPABASE_REF} (PRODUCTION)` });
    expect(describeSupabaseTarget(STAGING_DB).label).toBe(`${STAGING_SUPABASE_REF} (staging)`);
    expect(describeSupabaseTarget("http://127.0.0.1:54321").label).toBe("127.0.0.1 (local)");
  });

  it("lets scripts touch production only with CONFIRM_PRODUCTION naming the production ref", () => {
    expect(() => assertSupabaseTargetAllowed(PROD_DB, "seed", {})).toThrow(/PRODUCTION/);
    expect(() => assertSupabaseTargetAllowed(PROD_DB, "seed", { CONFIRM_PRODUCTION: "yes" })).toThrow(/CONFIRM_PRODUCTION/);
    expect(() => assertSupabaseTargetAllowed(PROD_DB, "seed", { CONFIRM_PRODUCTION: STAGING_SUPABASE_REF })).toThrow();
    expect(assertSupabaseTargetAllowed(PROD_DB, "seed", { CONFIRM_PRODUCTION: PRODUCTION_SUPABASE_REF }).production).toBe(true);
    expect(assertSupabaseTargetAllowed(STAGING_DB, "seed", {}).production).toBe(false);
  });
});

describe("production hosts", () => {
  it("matches the public production hosts, as URLs or bare hosts", () => {
    expect(isProductionHost("https://www.getfilewell.com")).toBe(true);
    expect(isProductionHost("https://getfilewell.com/pricing")).toBe(true);
    expect(isProductionHost("filewell.vercel.app")).toBe(true);
    expect(isProductionHost("https://filewell-git-staging-team.vercel.app")).toBe(false);
    expect(isProductionHost("http://localhost:3000")).toBe(false);
    expect(isProductionHost(undefined)).toBe(false);
  });
});

describe("canonical redirect for *.vercel.app on production", () => {
  const base = { pathname: "/pricing", search: "?a=1", production: true };

  it("sends the public alias and deployment URLs to the same path on the canonical domain", () => {
    expect(canonicalRedirectUrl({ ...base, host: "filewell.vercel.app" })).toBe(`${CANONICAL_PRODUCTION_URL}/pricing?a=1`);
    expect(canonicalRedirectUrl({ ...base, host: "filewell-abc123-team.vercel.app:443" })).toBe(`${CANONICAL_PRODUCTION_URL}/pricing?a=1`);
  });

  it("never redirects API routes (cron, webhooks)", () => {
    expect(canonicalRedirectUrl({ ...base, host: "filewell.vercel.app", pathname: "/api/cron/reminders", search: "" })).toBeNull();
    expect(canonicalRedirectUrl({ ...base, host: "filewell.vercel.app", pathname: "/api", search: "" })).toBeNull();
  });

  it("leaves the canonical domain, previews and unknown hosts alone", () => {
    expect(canonicalRedirectUrl({ ...base, host: "www.getfilewell.com" })).toBeNull();
    expect(canonicalRedirectUrl({ ...base, host: "filewell-git-x-team.vercel.app", production: false })).toBeNull();
    expect(canonicalRedirectUrl({ ...base, host: null })).toBeNull();
  });
});

describe("siteUrl", () => {
  const KEYS = ["VERCEL_ENV", "NEXT_PUBLIC_VERCEL_ENV", "NEXT_PUBLIC_SITE_URL", "VERCEL_URL", "NEXT_PUBLIC_VERCEL_URL"] as const;
  let saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("uses the canonical domain on production, ignoring *.vercel.app and localhost", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://filewell-team.vercel.app";
    expect(siteUrl()).toBe(CANONICAL_PRODUCTION_URL);
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(absoluteUrl("/file/x/confirmation")).toBe(`${CANONICAL_PRODUCTION_URL}/file/x/confirmation`);
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe(CANONICAL_PRODUCTION_URL);
  });

  it("uses the configured URL on previews and locally", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.test/";
    expect(siteUrl()).toBe("https://staging.example.test");
  });
});
