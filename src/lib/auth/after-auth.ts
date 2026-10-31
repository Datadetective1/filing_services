import "server-only";
import { cookies } from "next/headers";
import { safeNextPath } from "./session";

/**
 * Where a visitor was headed when they signed up, kept in this browser so it survives a
 * confirmation link that fails (opened first on a phone or by a mail scanner) and the password
 * sign-in that follows. HttpOnly, one day, same-origin paths only; never decides access.
 */

const COOKIE = "fw_after_auth";
const DEFAULT = "/dashboard";

export async function rememberAfterAuth(next: string): Promise<void> {
  const path = safeNextPath(next, DEFAULT);
  if (path === DEFAULT || path === "/reset-password") return;
  (await cookies()).set(COOKIE, path, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function readAfterAuth(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const path = safeNextPath(value, DEFAULT);
  return path === DEFAULT ? null : path;
}

export async function clearAfterAuth(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The explicit target wins; the remembered one only fills in for the plain default. */
export function pickAfterAuth(explicit: string, remembered: string | null): string {
  return explicit === DEFAULT && remembered ? remembered : explicit;
}
