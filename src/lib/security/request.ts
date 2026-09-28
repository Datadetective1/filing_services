import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Salted hash of the client IP. We never store raw IP addresses. */
export async function clientIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || null;
  if (!ip) return null;
  return createHash("sha256").update(`${env().IP_HASH_SALT}:${ip}`).digest("hex").slice(0, 32);
}

export async function userAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent")?.slice(0, 500) ?? null;
}

/**
 * CSRF defense for cookie-authenticated route handlers (server actions already get
 * Next.js's built-in origin check): the Origin header must match our host.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
