import "server-only";
import { cookies } from "next/headers";
import { createSignedToken, verifySignedToken } from "@/lib/security/tokens";

/**
 * Companion to the pending-lookup cookie (src/lib/lookup/pending.ts), whose schema is
 * fixed. Carries the one extra thing the lookup form collects: where a foreign entity
 * was formed. Signed, HttpOnly, same lifetime. It is what the visitor typed, nothing more.
 */

const COOKIE = "fw_lookup_home";
const PURPOSE = "lookup_home";
const TTL_SECONDS = 60 * 60 * 24;

export async function setLookupHomeJurisdiction(value: string | null): Promise<void> {
  const jar = await cookies();
  if (!value) {
    jar.delete(COOKIE);
    return;
  }
  jar.set(COOKIE, createSignedToken(PURPOSE, { v: value.slice(0, 100) }, TTL_SECONDS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function readLookupHomeJurisdiction(): Promise<string | null> {
  const payload = verifySignedToken<{ v: unknown }>(PURPOSE, (await cookies()).get(COOKIE)?.value);
  const v = payload?.v;
  if (typeof v !== "string") return null;
  const clean = v.replace(/\s+/g, " ").trim().slice(0, 100);
  return clean || null;
}

export async function clearLookupHomeJurisdiction(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
