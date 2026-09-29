import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import { CANONICAL_PRODUCTION_URL, absoluteUrl, isIndexable, siteUrl } from "@/config/site";

/** Every variable these helpers read, cleared so the host shell can't leak into a test. */
const VARS = [
  "VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_ENV",
  "NEXT_PUBLIC_ALLOW_INDEXING",
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_URL",
  "NEXT_PUBLIC_VERCEL_URL",
];

function env(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
}

beforeEach(() => {
  for (const k of VARS) vi.stubEnv(k, undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("indexing stays off unless production AND explicitly allowed", () => {
  it("is off with nothing set (local development)", () => {
    expect(isIndexable()).toBe(false);
  });

  it("is off on previews and development even when the allow flag is set", () => {
    env({ VERCEL_ENV: "preview", NEXT_PUBLIC_VERCEL_ENV: "preview", NEXT_PUBLIC_ALLOW_INDEXING: "true" });
    expect(isIndexable()).toBe(false);
    env({ VERCEL_ENV: "development", NEXT_PUBLIC_VERCEL_ENV: "development" });
    expect(isIndexable()).toBe(false);
  });

  it("is off in production until the allow flag is exactly 'true'", () => {
    env({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "production" });
    expect(isIndexable()).toBe(false);
    for (const flag of ["false", "1", "yes", "TRUE", " true"]) {
      vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", flag);
      expect(isIndexable()).toBe(false);
    }
  });

  it("is on only for production with NEXT_PUBLIC_ALLOW_INDEXING=true", () => {
    env({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "production", NEXT_PUBLIC_ALLOW_INDEXING: "true" });
    expect(isIndexable()).toBe(true);
  });
});

describe("robots.txt", () => {
  it("disallows everything and lists no sitemap while indexing is off", () => {
    env({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "production" });
    const r = robots();
    expect(r.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(r.sitemap).toBeUndefined();
  });

  it("allows public pages and points the sitemap at the canonical domain once indexing is on", () => {
    env({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_VERCEL_ENV: "production",
      NEXT_PUBLIC_ALLOW_INDEXING: "true",
      NEXT_PUBLIC_SITE_URL: "https://filewell.vercel.app",
    });
    const r = robots();
    expect(r.sitemap).toBe(`${CANONICAL_PRODUCTION_URL}/sitemap.xml`);
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(expect.arrayContaining(["/admin", "/dashboard", "/file", "/api/"]));
  });
});

describe("siteUrl in production is the canonical domain", () => {
  it("uses https://www.getfilewell.com", () => {
    expect(CANONICAL_PRODUCTION_URL).toBe("https://www.getfilewell.com");
  });

  it("falls back to the canonical domain when NEXT_PUBLIC_SITE_URL is unset", () => {
    env({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "production", VERCEL_URL: "filewell-abc123.vercel.app" });
    expect(siteUrl()).toBe(CANONICAL_PRODUCTION_URL);
    expect(absoluteUrl("/auth/confirm")).toBe("https://www.getfilewell.com/auth/confirm");
  });

  it("ignores a *.vercel.app or localhost NEXT_PUBLIC_SITE_URL", () => {
    env({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "production" });
    for (const url of ["https://filewell.vercel.app", "http://localhost:3000", "http://127.0.0.1:3000", "not a url"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", url);
      expect(siteUrl()).toBe(CANONICAL_PRODUCTION_URL);
    }
  });

  it("detects production from the server-only VERCEL_ENV too", () => {
    env({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://filewell.vercel.app" });
    expect(siteUrl()).toBe(CANONICAL_PRODUCTION_URL);
  });

  it("uses the configured canonical URL without a trailing slash", () => {
    env({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://www.getfilewell.com/" });
    expect(siteUrl()).toBe("https://www.getfilewell.com");
  });

  it("keeps preview and local hosts outside production", () => {
    env({ VERCEL_ENV: "preview", NEXT_PUBLIC_VERCEL_ENV: "preview", VERCEL_URL: "filewell-git-branch.vercel.app" });
    expect(siteUrl()).toBe("https://filewell-git-branch.vercel.app");
    env({ VERCEL_URL: undefined, VERCEL_ENV: undefined, NEXT_PUBLIC_VERCEL_ENV: undefined });
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
