import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { type Attribution, attributionProperties } from "./attribution";
import { readAttribution } from "./attribution-server";
import type { AnalyticsEvent } from "./events";

/**
 * First-party, privacy-conscious analytics: no IP addresses, no user agents, no
 * third-party trackers. Events carry an optional random anonymous id and, once
 * signed in, the user id. Analytics failures never break the product.
 */
export async function trackServer(
  event: AnalyticsEvent,
  opts: {
    userId?: string | null;
    anonymousId?: string | null;
    path?: string | null;
    stateCode?: string | null;
    filingTypeCode?: string | null;
    entityType?: string | null;
    properties?: Record<string, unknown>;
    /** Skip if an event with the same key was already recorded. */
    dedupeKey?: string;
    /** Attribution to record; defaults to the visitor's cookie (null outside a browser request). */
    attribution?: Attribution | null;
  } = {},
): Promise<void> {
  try {
    const db = createAdminClient();
    const attribution = opts.attribution !== undefined ? opts.attribution : await readAttribution();
    const properties = {
      ...attributionProperties(attribution),
      ...(opts.properties ?? {}),
      ...(opts.dedupeKey ? { dedupe_key: opts.dedupeKey } : {}),
    };
    if (opts.dedupeKey) {
      const { data } = await db
        .from("analytics_events")
        .select("id")
        .eq("event_name", event)
        .eq("properties->>dedupe_key", opts.dedupeKey)
        .limit(1);
      if (data && data.length > 0) return;
    }
    await db.from("analytics_events").insert({
      event_name: event,
      user_id: opts.userId ?? null,
      anonymous_id: opts.anonymousId ?? null,
      path: opts.path?.slice(0, 300) ?? null,
      state_code: opts.stateCode ?? null,
      filing_type_code: opts.filingTypeCode ?? null,
      entity_type: opts.entityType ?? null,
      properties,
    });
  } catch {
    // Never let analytics break a user flow.
  }
}
