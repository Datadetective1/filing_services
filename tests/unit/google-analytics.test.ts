import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gaMeasurementId, gaPageView } from "@/lib/analytics/google";

describe("gaMeasurementId", () => {
  it("accepts a GA4 Measurement ID and normalizes case and spaces", () => {
    expect(gaMeasurementId(" g-abc123xyz ")).toBe("G-ABC123XYZ");
  });
  it("is off when unset or malformed", () => {
    expect(gaMeasurementId(undefined)).toBeNull();
    expect(gaMeasurementId("")).toBeNull();
    expect(gaMeasurementId("UA-12345-1")).toBeNull();
    expect(gaMeasurementId("G-<script>")).toBeNull();
  });
});

describe("gaPageView", () => {
  it("keeps public pages, campaign tags and gclid, and drops everything else", () => {
    const view = gaPageView(
      "https://getfilewell.com/annual-report/pennsylvania?utm_source=google&gclid=abc&email=a%40b.com#top",
      "Pennsylvania annual report | Filewell",
      false,
    );
    expect(view).toEqual({
      page_location: "https://getfilewell.com/annual-report/pennsylvania?utm_source=google&gclid=abc",
      page_path: "/annual-report/pennsylvania",
      page_title: "Pennsylvania annual report | Filewell",
    });
  });

  it("skips staff, test and sign-in pages", () => {
    for (const path of ["/admin", "/admin/queue", "/sandbox/checkout", "/auth/callback", "/login", "/signup", "/reset-password"]) {
      expect(gaPageView(`https://getfilewell.com${path}`, "x", false)).toBeNull();
    }
  });

  it("replaces record IDs and titles in the signed-in area", () => {
    const view = gaPageView(
      "https://getfilewell.com/file/3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f/checkout",
      "Acme Holdings LLC | Filewell",
      false,
    );
    expect(view?.page_path).toBe("/file/:id/checkout");
    expect(view?.page_location).toBe("https://getfilewell.com/file/:id/checkout");
    expect(view?.page_title).not.toContain("Acme");
  });

  it("sends nothing when the browser sends a privacy signal", () => {
    expect(gaPageView("https://getfilewell.com/", "Filewell", true)).toBeNull();
  });

  it("returns null for an unparseable URL", () => {
    expect(gaPageView("not a url", "x", false)).toBeNull();
  });
});

describe("privacy policy", () => {
  it("discloses Google Analytics and no longer says no Google script is used", () => {
    const page = readFileSync("src/app/(marketing)/legal/privacy/page.tsx", "utf8");
    expect(page).toContain("Google Analytics");
    expect(page).not.toContain("put any Google script");
  });
});
