import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import type { PendingLookup } from "@/lib/lookup/pending";
import { createClient } from "@/lib/supabase/server";

/** An existing, non-archived business of this user matching the lookup (case-insensitive name). */
export async function findExistingBusiness(user: SessionUser, lookup: Pick<PendingLookup, "stateCode" | "entityType" | "legalName">): Promise<string | null> {
  const db = await createClient();
  const { data } = await db
    .from("businesses")
    .select("id, legal_name")
    .eq("owner_user_id", user.id)
    .eq("state_code", lookup.stateCode)
    .eq("entity_type", lookup.entityType)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(200);
  const wanted = lookup.legalName.replace(/\s+/g, " ").trim().toLowerCase();
  const match = (data ?? []).find((b) => String(b.legal_name).replace(/\s+/g, " ").trim().toLowerCase() === wanted);
  return match ? String(match.id) : null;
}
