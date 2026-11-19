import { describe, expect, it } from "vitest";
import {
  attributionProperties,
  classifyTouch,
  googleAdsClickId,
  mergeTouch,
  PAID_SOURCES,
  parseAttribution,
  serializeAttribution,
} from "@/lib/analytics/attribution";
import { cleanConversionName, conversionsCsv, googleAdsTime } from "@/lib/acquisition/google-ads";

const SELF = ["www.getfilewell.com", "getfilewell.com"];
const touch = (url: string, referrer: string | null = null) =>
  classifyTouch({ url: new URL(url), referrer, selfHosts: SELF, today: "2026-12-01" });
const GCLID = "Cj0KCQiA_test-Click_ID123";

describe("attribution: Google Ads clicks", () => {
  it("an auto-tagged click is google_ads/cpc and keeps the click ID, even with a Google referrer", () => {
    const t = touch(`https://www.getfilewell.com/annual-report/pennsylvania?gclid=${GCLID}&utm_campaign=pa_annual_report`, "https://www.google.com/");
    expect(t).toMatchObject({ s: "google_ads", m: "cpc", c: "pa_annual_report", g: GCLID, lp: "/annual-report/pennsylvania" });
  });

  it("utm_source=google with a paid medium is Google Ads without a click ID", () => {
    expect(touch("https://www.getfilewell.com/registered-agent?utm_source=google&utm_medium=cpc&utm_campaign=ra")).toMatchObject({ s: "google_ads", m: "cpc", c: "ra" });
    expect(touch("https://www.getfilewell.com/registered-agent?utm_source=google&utm_medium=cpc")?.g).toBeUndefined();
  });

  it("iOS braid clicks count as Google Ads", () => {
    expect(touch("https://www.getfilewell.com/?gbraid=0AAAAAo_braid_value")?.s).toBe("google_ads");
  });

  it("organic Google stays organic, and a malformed click ID is ignored", () => {
    expect(touch("https://www.getfilewell.com/", "https://www.google.com/")).toMatchObject({ s: "google", m: "organic" });
    expect(touch("https://www.getfilewell.com/?gclid=bad<script>")?.s).toBe("direct");
  });

  it("the click ID survives the cookie round trip but never reaches analytics properties", () => {
    const a = mergeTouch(null, touch(`https://www.getfilewell.com/?gclid=${GCLID}`))!;
    const back = parseAttribution(serializeAttribution(a));
    expect(googleAdsClickId(back)).toBe(GCLID);
    expect(JSON.stringify(attributionProperties(back))).not.toContain(GCLID);
  });

  it("a later organic visit keeps the first-touch click ID", () => {
    const a = mergeTouch(mergeTouch(null, touch(`https://www.getfilewell.com/?gclid=${GCLID}`)), touch("https://www.getfilewell.com/", "https://www.bing.com/"));
    expect(a?.lt.s).toBe("bing");
    expect(googleAdsClickId(a)).toBe(GCLID);
  });

  it("Google Ads is paid media", () => {
    expect(PAID_SOURCES.has("google_ads")).toBe(true);
  });
});

describe("Google Ads offline conversion CSV", () => {
  it("uses the upload template, Central time and the service fee as value", () => {
    const csv = conversionsCsv([{ clickId: GCLID, paidAt: "2026-12-10T18:05:09Z", valueCents: 4900 }]);
    expect(csv.split("\n")).toEqual([
      "Parameters:TimeZone=America/Chicago",
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
      `${GCLID},Filewell purchase,2026-12-10 12:05:09,49.00,USD`,
      "",
    ]);
  });

  it("skips bad click IDs and duplicates, and cleans the conversion name", () => {
    const csv = conversionsCsv(
      [
        { clickId: "x", paidAt: "2026-12-10T18:05:09Z", valueCents: 4900 },
        { clickId: GCLID, paidAt: "2026-12-10T18:05:09Z", valueCents: 4900 },
        { clickId: GCLID, paidAt: "2026-12-10T18:05:09Z", valueCents: 4900 },
      ],
      'Buy, "now"',
    );
    expect(csv.trim().split("\n")).toHaveLength(3);
    expect(cleanConversionName('Buy, "now"')).toBe("Buy now");
    expect(cleanConversionName("")).toBe("Filewell purchase");
  });

  it("formats times as yyyy-MM-dd HH:mm:ss", () => {
    expect(googleAdsTime("2026-07-01T05:00:00Z")).toBe("2026-07-01 00:00:00");
  });
});
