import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsUrl } from "@/lib/analytics/vercel";

describe("sanitizeAnalyticsUrl", () => {
  it("keeps public pages without their query string", () => {
    expect(sanitizeAnalyticsUrl("https://getfilewell.com/states/pa", false)).toBe("https://getfilewell.com/states/pa");
    expect(sanitizeAnalyticsUrl("https://getfilewell.com/unsubscribe?token=abc123&email=a%40b.com", false)).toBe(
      "https://getfilewell.com/unsubscribe",
    );
    expect(sanitizeAnalyticsUrl("https://getfilewell.com/pricing#faq", false)).toBe("https://getfilewell.com/pricing");
  });

  it("keeps campaign tags only", () => {
    expect(
      sanitizeAnalyticsUrl("https://getfilewell.com/?utm_source=newsletter&utm_campaign=oct&ref=x&token=y", false),
    ).toBe("https://getfilewell.com/?utm_source=newsletter&utm_campaign=oct");
  });

  it("skips staff, sandbox and auth paths", () => {
    expect(sanitizeAnalyticsUrl("https://getfilewell.com/admin", false)).toBeNull();
    expect(sanitizeAnalyticsUrl("https://getfilewell.com/admin/filings/123", false)).toBeNull();
    expect(sanitizeAnalyticsUrl("https://getfilewell.com/sandbox/checkout/cs_1", false)).toBeNull();
    expect(sanitizeAnalyticsUrl("https://getfilewell.com/auth/callback?code=1", false)).toBeNull();
    expect(sanitizeAnalyticsUrl("https://getfilewell.com/administrator-guide", false)).toBe(
      "https://getfilewell.com/administrator-guide",
    );
  });

  it("skips everything when the browser sends a privacy signal", () => {
    expect(sanitizeAnalyticsUrl("https://getfilewell.com/states/pa", true)).toBeNull();
  });

  it("skips unparseable URLs", () => {
    expect(sanitizeAnalyticsUrl("not a url", false)).toBeNull();
  });
});
