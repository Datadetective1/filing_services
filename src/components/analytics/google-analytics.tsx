"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gaPageView, type GaPageView } from "@/lib/analytics/google";

type Gtag = (...args: unknown[]) => void;
type GaWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

function privacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

/** Waits for the new route's <title> (Next streams metadata), then reads the cleaned page view. */
function readView(): Promise<GaPageView | null> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const view = gaPageView(window.location.href, document.title, privacySignal());
      resolve(view && !view.page_title ? { ...view, page_title: view.page_path } : view);
    }, 400);
  });
}

/**
 * Google Analytics 4 page views. Nothing loads for visitors with a privacy signal, and
 * nothing loads until the visitor reaches a page that may be measured (never on staff
 * or sign-in pages). The first page view is the one gtag's config sends, with the
 * cleaned address and title passed in; later route changes send a cleaned page view
 * by hand. Google signals and ad personalization are off.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (privacySignal()) return;
    let cancelled = false;
    void readView().then((view) => {
      if (cancelled || !view) return;
      const w = window as GaWindow;
      if (!started.current) {
        started.current = true;
        w.dataLayer = w.dataLayer || [];
        w.gtag = function gtag() {
          // gtag.js reads the arguments object itself, so it must be pushed as is.
          // eslint-disable-next-line prefer-rest-params
          w.dataLayer!.push(arguments);
        };
        w.gtag("js", new Date());
        w.gtag("config", measurementId, {
          ...view,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        });
        setLoaded(true);
        return;
      }
      w.gtag?.("event", "page_view", { ...view, send_to: measurementId });
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, measurementId]);

  if (!loaded) return null;
  return (
    <Script
      id="ga4"
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
      strategy="afterInteractive"
    />
  );
}
