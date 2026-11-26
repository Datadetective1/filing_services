"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

/** Records one service_page_viewed when a registered agent page opens (state code when there is one). */
export function ServicePageView({ stateCode }: { stateCode?: string }) {
  useEffect(() => {
    track("service_page_viewed", stateCode ? { stateCode } : {});
  }, [stateCode]);
  return null;
}
