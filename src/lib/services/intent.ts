import "server-only";
import { cookies } from "next/headers";

/**
 * Which service a visitor came for, so the business lookup (built for annual reports) can
 * hand them straight to the registered agent order after it, without asking again. HttpOnly,
 * one day, and only ever "registered_agent": it changes which offer is shown first, nothing else.
 */

const COOKIE = "fw_service_intent";
export type ServiceIntent = "registered_agent";

export async function setServiceIntent(intent: ServiceIntent): Promise<void> {
  (await cookies()).set(COOKIE, intent, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function readServiceIntent(): Promise<ServiceIntent | null> {
  return (await cookies()).get(COOKIE)?.value === "registered_agent" ? "registered_agent" : null;
}

export async function clearServiceIntent(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
