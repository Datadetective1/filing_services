import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { siteNav, SITE_NAV } from "@/components/layout/site-nav";
import { businessServiceJsonLd, organizationJsonLd } from "@/lib/seo/json-ld";
import { homeMetadata, listNames, supportedStatesAnswer } from "@/lib/seo/home";

beforeEach(() => {
  for (const k of ["NEXT_PUBLIC_LEGAL_ENTITY", "VERCEL_ENV", "NEXT_PUBLIC_VERCEL_ENV", "NEXT_PUBLIC_SITE_URL"]) vi.stubEnv(k, undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("main navigation", () => {
  it("is unchanged while the business services pages are off", () => {
    expect(siteNav(false)).toEqual([...SITE_NAV]);
  });

  it("adds Registered agent right after Annual reports once they are live", () => {
    expect(siteNav(true).map((i) => i.href)).toEqual(["/annual-report", "/registered-agent", "/states", "/pricing", "/help"]);
  });
});

describe("home metadata", () => {
  it("leads with the service people search for", () => {
    const m = homeMetadata(false);
    expect(m.title).toEqual({ absolute: "Filewell: Annual Report Filing Service" });
    expect(m.alternates?.canonical).toBe("/");
  });

  it("names registered agent service once those pages are live, within search result lengths", () => {
    const m = homeMetadata(true);
    const title = (m.title as { absolute: string }).absolute;
    expect(title).toBe("Filewell: Registered Agent Service and Annual Report Filing");
    expect(title.length).toBeLessThanOrEqual(60);
    expect(String(m.description).length).toBeLessThanOrEqual(160);
    expect(String(m.description)).toMatch(/registered agent/i);
  });
});

describe("supported states answer", () => {
  it("lists the open states in order", () => {
    expect(listNames(["A"])).toBe("A");
    expect(listNames(["A", "B"])).toBe("A and B");
    expect(supportedStatesAnswer(["Pennsylvania", "Florida", "Colorado"])).toMatch(/^We file annual reports in Colorado, Florida and Pennsylvania today\./);
  });

  it("never claims a state when none is open", () => {
    expect(supportedStatesAnswer([])).not.toMatch(/We file annual reports in/);
  });
});

describe("structured data", () => {
  it("names the operating company only once it is configured", async () => {
    expect(organizationJsonLd()).not.toHaveProperty("legalName");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_ENTITY", "Harborlune LLC");
    vi.resetModules();
    const fresh = await import("@/lib/seo/json-ld");
    expect(fresh.organizationJsonLd()).toMatchObject({ legalName: "Harborlune LLC" });
  });

  it("includes a logo and no ratings", () => {
    const org = organizationJsonLd();
    expect(org.logo).toMatchObject({ "@type": "ImageObject", width: 180, height: 180 });
    expect(JSON.stringify(org)).not.toMatch(/aggregateRating|review/i);
  });

  it("describes a business service with a price only when one is set", () => {
    const withPrice = businessServiceJsonLd({
      name: "Registered agent service",
      serviceType: "Registered agent service",
      description: "Desc.",
      path: "/registered-agent",
      offer: { name: "One year", priceCents: 11900, description: "Yearly." },
    });
    expect(withPrice.offers).toMatchObject({ "@type": "Offer", price: "119.00", priceCurrency: "USD" });
    expect(withPrice.areaServed).toEqual({ "@type": "Country", name: "United States" });
    expect(String(withPrice.description)).toMatch(/Not affiliated with or endorsed by any government agency/);

    const noPrice = businessServiceJsonLd({ name: "Formation", serviceType: "Formation", description: "D.", path: "/business-formation", stateName: "Florida" });
    expect(noPrice).not.toHaveProperty("offers");
    expect(noPrice.areaServed).toEqual({ "@type": "State", name: "Florida" });
    expect(JSON.stringify(noPrice)).not.toMatch(/aggregateRating|review|GovernmentService/i);
  });
});

describe("social card", () => {
  it("every page names the shared image, since a page's openGraph replaces the layout's", async () => {
    const { pageMetadata } = await import("@/lib/seo/metadata");
    const m = pageMetadata({ title: "T", description: "D", path: "/x" });
    expect(m.openGraph?.images).toEqual([{ url: "/opengraph-image", width: 1200, height: 630, alt: expect.stringContaining("Filewell") }]);
    expect(m.twitter).toMatchObject({ images: ["/opengraph-image"] });
  });
});
