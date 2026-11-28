"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { gaPageView } from "@/lib/analytics/google";

type Gtag = (...args: unknown[]) => void;
type GaWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

function privacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

/**
 * Google Analytics 4 page views. Loads gtag.js after the page is interactive, never for
 * visitors with a privacy signal, with Google signals and ad personalization off.
 * Page views are sent by hand on each route change so query strings and record IDs
 * are cleaned first (see gaPageView).
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (privacySignal()) return;
    const w = window as GaWindow;
    w.dataLayer = w.dataLayer || [];
    if (!w.gtag) {
      w.gtag = function gtag() {
        // gtag.js reads the arguments object itself, so it must be pushed as is.
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
      w.gtag("js", new Date());
      w.gtag("config", measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
    }
    setAllowed(true);
  }, [measurementId]);

  useEffect(() => {
    if (!allowed) return;
    // Wait a tick so the new route's <title> is in place before it is read.
    const timer = window.setTimeout(() => {
      const w = window as GaWindow;
      const view = gaPageView(window.location.href, document.title, privacySignal());
      if (view && w.gtag) w.gtag("event", "page_view", { ...view, send_to: measurementId });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [allowed, pathname, measurementId]);

  if (!allowed) return null;
  return (
    <Script
      id="ga4"
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
      strategy="afterInteractive"
    />
  );
}
