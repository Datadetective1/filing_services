import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import { annualReportRows, cheapest, registeredAgentRows } from "@/lib/seo/best-of";
import { postalAddressJsonLd } from "@/lib/seo/json-ld";
import { PA_GUIDES } from "@/lib/seo/pa-guides";

const f = { raCents: 11900, reportTiers: [{ serviceCents: 4900, states: 6 }, { serviceCents: 9900, states: 27 }] };

describe("robots.txt for AI search", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("says search and AI answers are fine, training is not, and blocks no crawler by name", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ALLOW_INDEXING", "true");
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules).toHaveLength(1);
    expect(rules[0].userAgent).toBe("*");
    expect(rules[0].other).toEqual({ "Content-Signal": "search=yes, ai-input=yes, ai-train=no" });
  });

  it("points agents at llms.txt with a Link header", () => {
    const cfg = readFileSync("next.config.ts", "utf8");
    expect(cfg).toContain('</llms.txt>; rel="service-doc"');
  });
});

describe("Organization address", () => {
  it("splits the Coppell mailbox into a PostalAddress", () => {
    expect(postalAddressJsonLd("817 S MacArthur Blvd, Ste 115 #1040, Coppell, TX 75019")).toEqual({
      "@type": "PostalAddress",
      streetAddress: "817 S MacArthur Blvd, Ste 115 #1040",
      addressLocality: "Coppell",
      addressRegion: "TX",
      postalCode: "75019",
      addressCountry: "US",
    });
    expect(postalAddressJsonLd(null)).toBeNull();
  });
});

describe("best-of roundups", () => {
  it("annual reports: ordered by fee, unpriced last, every competitor present", () => {
    const rows = annualReportRows(f);
    expect(rows.map((r) => r.name)).toEqual(["Filewell", "LegalZoom", "ZenBusiness", "Northwest Registered Agent", "Harbor Compliance", "Bizee"]);
    expect(rows.at(-1)?.barCents).toBeNull();
    expect(cheapest(rows)).toEqual({ names: "Filewell", cents: 4900 });
  });

  it("registered agent: two-year totals from the listed prices", () => {
    const rows = registeredAgentRows(f);
    expect(rows[0]).toMatchObject({ name: "Filewell", barCents: 23800 });
    expect(cheapest(rows)?.names).toBe("Filewell");
  });

  it("pages never link to a state's filing site", () => {
    const src = readFileSync("src/components/marketing/best-of-page.tsx", "utf8") + readFileSync("src/lib/seo/best-of.ts", "utf8");
    expect(src).not.toMatch(/https?:\/\/[^"'\s]*\.(gov|us)\b/);
  });
});

describe("Pennsylvania: file it yourself or use a service", () => {
  it("gives the $56 total and cites no state filing site", () => {
    const g = PA_GUIDES.find((x) => x.slug === "file-yourself-or-use-a-service");
    expect(g).toBeDefined();
    expect(g!.answer.join(" ")).toContain("$56");
    expect(g!.sources.every((s) => s.url.includes("palegis.us"))).toBe(true);
  });
});
