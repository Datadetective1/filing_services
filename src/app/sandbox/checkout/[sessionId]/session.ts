import "server-only";
import { getPaymentProvider } from "@/lib/payments";
import { SandboxPaymentProvider } from "@/lib/payments/sandbox";
import { createAdminClient } from "@/lib/supabase/admin";

/** Matches the sandbox_checkout_sessions.id check constraint. */
export const SANDBOX_SESSION_RE = /^sbx_cs_[A-Za-z0-9]{1,64}$/;

export interface SandboxLineItem {
  kind: string;
  name: string;
  amountCents: number;
}

export interface SandboxSessionRow {
  id: string;
  order_id: string;
  payment_id: string;
  amount_cents: number;
  currency: string;
  line_items: unknown;
  customer_email: string | null;
  success_url: string;
  cancel_url: string;
  status: "open" | "completed" | "expired" | "failed";
  payment_intent_id: string | null;
  created_at: string;
  completed_at: string | null;
}

/** The active provider, but only when it is the sandbox simulator. */
export function sandboxProvider(): SandboxPaymentProvider | null {
  try {
    const provider = getPaymentProvider();
    return provider instanceof SandboxPaymentProvider ? provider : null;
  } catch {
    return null;
  }
}

/**
 * Load a sandbox session for the signed-in user. Sessions have no RLS policies
 * (service role only), so ownership is enforced here through the order's owner.
 */
export async function loadOwnedSession(userId: string, sessionId: string): Promise<SandboxSessionRow | null> {
  if (!SANDBOX_SESSION_RE.test(sessionId)) return null;
  const db = createAdminClient();
  const { data: session } = await db.from("sandbox_checkout_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) return null;
  const { data: order } = await db.from("orders").select("id, user_id").eq("id", session.order_id).maybeSingle();
  if (!order || order.user_id !== userId) return null;
  return session as SandboxSessionRow;
}

export function lineItemsOf(session: SandboxSessionRow): SandboxLineItem[] {
  if (!Array.isArray(session.line_items)) return [];
  return session.line_items
    .filter((li): li is Record<string, unknown> => Boolean(li) && typeof li === "object")
    .map((li) => ({
      kind: String(li.kind ?? ""),
      name: String(li.name ?? "Item"),
      amountCents: Number.isInteger(li.amountCents) ? Number(li.amountCents) : 0,
    }));
}

/**
 * Same-site path from a stored return URL. Only the path is used, so a stored URL
 * can never send the customer to another site.
 */
export function localPath(url: string, fallback: string): string {
  try {
    const u = new URL(url, "http://sandbox.invalid");
    const path = `${u.pathname}${u.search}${u.hash}`;
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
