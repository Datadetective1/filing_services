import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Compact signed tokens (HMAC-SHA256) for things like one-click unsubscribe links
 * and the pre-signup lookup cookie. Payloads are NOT encrypted — never put secrets
 * or sensitive personal data in them.
 */

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(data: string, purpose: string, secret = env().APP_SIGNING_SECRET): string {
  return createHmac("sha256", secret).update(`${purpose}.${data}`).digest("base64url");
}

export function createSignedToken(
  purpose: string,
  payload: Record<string, unknown>,
  ttlSeconds: number,
  secret?: string,
): string {
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${body}.${sign(body, purpose, secret)}`;
}

export function verifySignedToken<T extends Record<string, unknown>>(
  purpose: string,
  token: string | undefined | null,
  secret?: string,
): T | null {
  if (!token || typeof token !== "string" || token.length > 4096) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body, purpose, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
