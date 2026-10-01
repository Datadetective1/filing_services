import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTRIBUTION_COOKIE, type Attribution, parseAttribution } from "./attribution";

/** The visitor's attribution from the first-party cookie, or null (no cookie, GPC, outside a request). */
export async function readAttribution(): Promise<Attribution | null> {
  try {
    return parseAttribution((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
  } catch {
    return null;
  }
}

/** Keep the visitor's attribution with a newly added business (first write wins). Best effort. */
export async function saveBusinessAttribution(businessId: string, userId: string): Promise<void> {
  try {
    const attribution = await readAttribution();
    if (!attribution) return;
    await createAdminClient()
      .from("business_attribution")
      .upsert({ business_id: businessId, user_id: userId, attribution }, { onConflict: "business_id", ignoreDuplicates: true });
  } catch {
    // Attribution never blocks a customer flow.
  }
}

export async function businessAttribution(businessId: string): Promise<Attribution | null> {
  try {
    const { data } = await createAdminClient().from("business_attribution").select("attribution").eq("business_id", businessId).maybeSingle();
    return data ? parseAttribution(JSON.stringify(data.attribution)) : null;
  } catch {
    return null;
  }
}
