"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

const KEY = "fw_vs";

/** Records one "visit_started" per browser session (tab session), for visitor counts by source. */
export function VisitTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      return;
    }
    track("visit_started");
  }, []);
  return null;
}
