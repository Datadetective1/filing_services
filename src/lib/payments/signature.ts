import { createHmac, timingSafeEqual } from "node:crypto";
import { WebhookVerificationError } from "./types";

/**
 * Stripe-compatible webhook signature scheme used by the sandbox provider:
 *   header: "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${rawBody}`>"
 * Timestamp tolerance defends against replay of captured deliveries; event-id
 * uniqueness in payment_events defends against replay inside the window.
 */

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function signPayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

export function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): void {
  if (!header) throw new WebhookVerificationError("missing signature header");
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  ) as Record<string, string>;
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) {
    throw new WebhookVerificationError("malformed signature header");
  }
  if (Math.abs(nowSeconds - t) > toleranceSeconds) {
    throw new WebhookVerificationError("signature timestamp outside tolerance");
  }
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(v1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new WebhookVerificationError("signature mismatch");
  }
}
