"use client";

import type { AnalyticsEvent } from "./events";

const KEY = "fw_aid";

function privacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

function anonymousId(): string | null {
  if (privacySignal()) return null;
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Fire-and-forget first-party event. Honors Global Privacy Control / Do Not Track. */
export function track(event: AnalyticsEvent, props: { stateCode?: string; entityType?: string } = {}) {
  try {
    const body = JSON.stringify({ event, anonymousId: anonymousId(), path: location.pathname, ...props });
    void fetch("/api/analytics", {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "application/json" },
    }).catch(() => {});
  } catch {
    // ignore
  }
}
