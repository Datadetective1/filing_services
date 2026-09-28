import "server-only";
import { audit } from "@/lib/audit";
import { verifySignedToken } from "@/lib/security/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One-click reminder opt-out, shared by the /unsubscribe confirmation page and the
 * RFC 8058 POST endpoint (/api/unsubscribe). The signed token is the only
 * credential: it names the user ({ uid }) and is verified on every call. The only
 * side effect is turning reminder emails off, which is idempotent.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function userIdFromUnsubscribeToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length === 0) return null;
  const payload = verifySignedToken<{ uid?: unknown }>("unsubscribe", token);
  const uid = payload?.uid;
  return typeof uid === "string" && UUID_RE.test(uid) ? uid : null;
}

export type OptOutResult = "unsubscribed" | "already_unsubscribed" | "invalid";

export async function optOutOfReminders(token: unknown): Promise<OptOutResult> {
  const uid = userIdFromUnsubscribeToken(token);
  if (!uid) return "invalid";

  const db = createAdminClient();
  const { data: profile, error: readError } = await db
    .from("profiles")
    .select("id, reminder_emails_enabled")
    .eq("id", uid)
    .maybeSingle();
  if (readError) throw new Error("Could not read reminder preference");
  if (!profile) return "invalid";
  if (profile.reminder_emails_enabled === false) return "already_unsubscribed";

  const { error } = await db.from("profiles").update({ reminder_emails_enabled: false }).eq("id", uid);
  if (error) throw new Error("Could not update reminder preference");

  await audit({
    actorUserId: uid,
    actorType: "customer",
    action: "reminders.unsubscribed",
    entityType: "profile",
    entityId: uid,
  });
  return "unsubscribed";
}
