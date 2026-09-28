"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";
import type { AnalyticsEvent } from "@/lib/analytics/events";

/** Records a page-level event once on mount. */
export function TrackView({ event, stateCode, entityType }: { event: AnalyticsEvent; stateCode?: string; entityType?: string }) {
  useEffect(() => {
    track(event, { stateCode, entityType });
  }, [event, stateCode, entityType]);
  return null;
}
