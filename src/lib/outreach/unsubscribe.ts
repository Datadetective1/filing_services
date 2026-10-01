import "server-only";
import { createSignedToken, verifySignedToken } from "@/lib/security/tokens";
import { suppressEmail } from "./suppression";

/** Outreach unsubscribe tokens: signed, carry only the address, valid 400 days (CAN-SPAM needs >= 30). */
export function outreachUnsubscribeToken(email: string): string {
  return createSignedToken("mkt-unsub", { e: email.trim().toLowerCase() }, 60 * 60 * 24 * 400);
}

export function emailFromOutreachToken(token: string | null | undefined): string | null {
  const p = verifySignedToken<{ e?: unknown }>("mkt-unsub", token);
  return p && typeof p.e === "string" && p.e.includes("@") ? p.e : null;
}

/** Permanently suppress the address in the token. Idempotent. */
export async function unsubscribeOutreach(token: string | null | undefined): Promise<"ok" | "invalid"> {
  const email = emailFromOutreachToken(token);
  if (!email) return "invalid";
  await suppressEmail(email, "unsubscribe", "outreach link");
  return "ok";
}
