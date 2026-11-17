import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { annualReportLookupHref } from "@/components/marketing/cta-link";
import { isAnnualReportPath, SERVICE_INTENT_COOKIE } from "@/lib/services/intent-cookie";
import { withoutStaleAgentIntent } from "@/proxy";

/**
 * A visitor who looked at the registered agent order keeps that choice for a day. Before this,
 * "Have us file it" on an annual report page then opened the registered agent lookup and result
 * instead of the $56 annual report order. Annual report buttons and pages now forget it.
 */

describe("annual report buttons", () => {
  it("go through the start route, which forgets the agent choice", () => {
    expect(annualReportLookupHref("/find?state=PA")).toBe("/annual-report/start?state=PA");
    expect(annualReportLookupHref("/find?state=PA&entity=llc")).toBe("/annual-report/start?state=PA&entity=llc");
    expect(annualReportLookupHref("/find")).toBe("/annual-report/start");
  });

  it("leave other destinations alone (partner orders, anchors, other pages)", () => {
    expect(annualReportLookupHref("/dashboard/services/annual-report?state=NJ")).toBe("/dashboard/services/annual-report?state=NJ");
    expect(annualReportLookupHref("#choose-state")).toBe("#choose-state");
    expect(annualReportLookupHref("/finder")).toBe("/finder");
  });
});

describe("annual report pages", () => {
  it("are recognised", () => {
    for (const p of ["/annual-report", "/annual-report/pennsylvania", "/annual-report/pennsylvania/llc", "/annual-report/due-dates", "/pennsylvania/annual-report-deadline", "/florida/annual-report-late-fee"]) {
      expect(isAnnualReportPath(p)).toBe(true);
    }
    for (const p of ["/", "/find", "/find/result", "/registered-agent", "/registered-agent/pennsylvania", "/services/pa", "/pennsylvania/business-search"]) {
      expect(isAnnualReportPath(p)).toBe(false);
    }
  });

  const visit = (path: string, headers: Record<string, string> = {}) =>
    withoutStaleAgentIntent(
      new NextRequest(`http://localhost${path}`, { headers: { cookie: `${SERVICE_INTENT_COOKIE}=registered_agent`, ...headers } }),
      NextResponse.next(),
    );
  const cleared = (res: NextResponse) => (res.headers.get("set-cookie") ?? "").includes(`${SERVICE_INTENT_COOKIE}=;`);

  it("clear the agent choice on a real visit", () => {
    expect(cleared(visit("/annual-report/pennsylvania"))).toBe(true);
    expect(cleared(visit("/pennsylvania/annual-report-after-deadline"))).toBe(true);
  });

  it("keep it on the agent pages, the lookup itself and router prefetches", () => {
    expect(cleared(visit("/registered-agent/pennsylvania"))).toBe(false);
    expect(cleared(visit("/find?state=PA"))).toBe(false);
    expect(cleared(visit("/annual-report/pennsylvania", { "next-router-prefetch": "1" }))).toBe(false);
  });
});
