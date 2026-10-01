import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Add an address to the permanent outreach do-not-contact list (idempotent; never removed by code). */
export async function suppressEmail(email: string, reason: "unsubscribe" | "bounce" | "complaint" | "manual" | "customer", source: string) {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) || e.length > 320) return false;
  const { error } = await createAdminClient().from("marketing_suppressions").upsert({ email: e, reason, source: source.slice(0, 200) }, { onConflict: "email", ignoreDuplicates: true });
  return !error;
}
