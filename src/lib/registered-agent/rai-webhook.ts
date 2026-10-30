import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Registered Agents Inc. new-document alerts: pull the signed token out of the request,
 * check its signature with our API secret, and read the document and company out of it.
 *
 * What the partner told us (account manager, by email): each alert is an HTTP POST whose
 * content is a JWT signed with our API credentials, carrying the Document ID, Company ID
 * and Company Name. We have not seen their published docs or a real alert, so this is
 * deliberately strict about the signature (HMAC only, "none" and key-pair algorithms are
 * refused) and tolerant about where the token sits and how the fields are spelled.
 */

export class RaiWebhookError extends Error {}

/** Env var holding the API secret the partner signs alerts with. Never logged. */
export const RAI_WEBHOOK_SECRET_ENV = "RAI_API_SECRET";

const HMAC_ALGS = { HS256: "sha256", HS384: "sha384", HS512: "sha512" } as const;
type HmacAlg = keyof typeof HMAC_ALGS;

/** Clock slack for exp / nbf, in seconds. */
const LEEWAY_SECONDS = 300;
const MAX_TOKEN_LENGTH = 16 * 1024;
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function raiWebhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = env[RAI_WEBHOOK_SECRET_ENV]?.trim();
  return v ? v : null;
}

function looksLikeJwt(v: unknown): boolean {
  return typeof v === "string" && v.length <= MAX_TOKEN_LENGTH && JWT_SHAPE.test(v.trim());
}

/**
 * The token from the request: the raw body itself, a JSON body with the token in a
 * common field (token, jwt, data, payload, content), or a Bearer token header.
 */
export function extractRaiToken(rawBody: string, headers: Headers): string {
  const body = rawBody.trim();
  if (looksLikeJwt(body)) return body;
  if (body.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new RaiWebhookError("body is not valid JSON");
    }
    if (parsed && typeof parsed === "object") {
      for (const key of ["token", "jwt", "data", "payload", "content", "message"]) {
        const v = (parsed as Record<string, unknown>)[key];
        if (looksLikeJwt(v)) return (v as string).trim();
      }
    }
  }
  const auth = headers.get("authorization")?.trim();
  if (auth && /^bearer\s+/i.test(auth)) {
    const t = auth.replace(/^bearer\s+/i, "");
    if (looksLikeJwt(t)) return t;
  }
  throw new RaiWebhookError("no signed token in the request");
}

function decodeSegment(seg: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
  } catch {
    throw new RaiWebhookError("token segment is not JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RaiWebhookError("token segment is not an object");
  return value as Record<string, unknown>;
}

/**
 * Verify an HMAC-signed JWT and return its claims. Throws RaiWebhookError for anything
 * unsigned, signed another way, signed with another key, expired or not yet valid.
 */
export function verifyRaiJwt(token: string, secret: string, now: Date = new Date()): Record<string, unknown> {
  if (!secret) throw new RaiWebhookError("no secret configured");
  if (!looksLikeJwt(token)) throw new RaiWebhookError("not a signed token");
  const [h, p, s] = token.trim().split(".");
  const header = decodeSegment(h);
  const alg = header.alg;
  if (typeof alg !== "string" || !(alg in HMAC_ALGS)) throw new RaiWebhookError("unsupported signing algorithm");
  const expected = createHmac(HMAC_ALGS[alg as HmacAlg], secret).update(`${h}.${p}`).digest();
  const given = Buffer.from(s, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new RaiWebhookError("bad signature");

  const claims = decodeSegment(p);
  const nowSec = Math.floor(now.getTime() / 1000);
  if (claims.exp !== undefined) {
    if (typeof claims.exp !== "number" || nowSec > claims.exp + LEEWAY_SECONDS) throw new RaiWebhookError("token expired");
  }
  if (claims.nbf !== undefined) {
    if (typeof claims.nbf !== "number" || nowSec + LEEWAY_SECONDS < claims.nbf) throw new RaiWebhookError("token not yet valid");
  }
  return claims;
}

export interface RaiDocumentEvent {
  documentId: string;
  companyId: string | null;
  companyName: string | null;
}

/** "Document ID", "document_id", "documentId" and "DocumentID" all compare equal. */
const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

function pick(obj: Record<string, unknown>, names: string[]): unknown {
  const wanted = new Set(names.map(normalizeKey));
  for (const [k, v] of Object.entries(obj)) if (wanted.has(normalizeKey(k))) return v;
  return undefined;
}

function idString(v: unknown, max: number): string | null {
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max && /^[A-Za-z0-9_.:-]+$/.test(t) ? t : null;
}

function nameString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Plain text only: drop control characters, collapse whitespace, cap the length.
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 300) : null;
}

/**
 * The document and company from the verified claims, looking at the top level and one
 * level down (data, document, payload, event, content). A missing document ID is refused.
 */
export function readRaiDocumentEvent(claims: Record<string, unknown>): RaiDocumentEvent {
  const layers: Record<string, unknown>[] = [claims];
  for (const key of ["data", "document", "payload", "event", "content"]) {
    const v = pick(claims, [key]);
    if (v && typeof v === "object" && !Array.isArray(v)) layers.push(v as Record<string, unknown>);
  }
  const find = (names: string[]) => {
    for (const layer of layers) {
      const v = pick(layer, names);
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  };
  const documentId = idString(find(["document_id", "documentId"]), 200);
  if (!documentId) throw new RaiWebhookError("no document ID in the alert");
  return {
    documentId,
    companyId: idString(find(["company_id", "companyId", "entity_id"]), 100),
    companyName: nameString(find(["company_name", "companyName", "entity_name"])),
  };
}

/** Everything the route needs: find the token, verify it, read the event. */
export function parseRaiDocumentAlert(rawBody: string, headers: Headers, secret: string, now: Date = new Date()): RaiDocumentEvent {
  return readRaiDocumentEvent(verifyRaiJwt(extractRaiToken(rawBody, headers), secret, now));
}
