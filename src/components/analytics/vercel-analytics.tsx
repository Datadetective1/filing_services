"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { sanitizeAnalyticsUrl } from "@/lib/analytics/vercel";

function privacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = sanitizeAnalyticsUrl(event.url, privacySignal());
  return url ? { ...event, url } : null;
}

/** Vercel Web Analytics page views, with query strings stripped and private areas skipped. */
export function VercelAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
