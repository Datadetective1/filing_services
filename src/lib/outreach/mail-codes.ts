import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { absoluteUrl } from "@/config/site";
import { env } from "@/lib/env";

/**
 * Per-piece landing codes for printed URLs: getfilewell.com/m/<campaign>-<entity>-<mac>.
 * Signed (HMAC with APP_SIGNING_SECRET), so a code can't be forged or pointed at another
 * entity, and it resolves without a lookup table. The entity number is public register
 * data; nothing personal is in the URL.
 */

const CODE_RE = /^([0-9a-f]{8})-(\d{1,10})-([A-Za-z0-9_-]{10})$/;

function mac(campaignShort: string, entity: string, secret: string): string {
  return createHmac("sha256", secret).update(`mail|${campaignShort}|${entity}`).digest("base64url").slice(0, 10);
}

export function campaignShort(campaignId: string): string {
  return campaignId.replace(/-/g, "").slice(0, 8).toLowerCase();
}

export function landingCode(campaignId: string, entityNumber: string, secret = env().APP_SIGNING_SECRET): string {
  const c = campaignShort(campaignId);
  const e = entityNumber.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return `${c}-${e}-${mac(c, e, secret)}`;
}

export function landingUrl(code: string): string {
  return absoluteUrl(`/m/${code}`);
}

/** The campaign prefix and 10-digit entity number a valid code points at, or null. */
export function verifyLandingCode(code: string, secret = env().APP_SIGNING_SECRET): { campaignShort: string; entityNumber: string } | null {
  const m = CODE_RE.exec(code);
  if (!m) return null;
  const [, c, e, given] = m;
  const want = mac(c, e, secret);
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { campaignShort: c, entityNumber: e.padStart(10, "0") };
}
