import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Registered Agents Inc. new-document alerts: pull the signed token out of the request,
 * check its signature with our API secret, and read the document and company out of it.
 *
 * What the partner told us (account managers, by email, Oct 30 and Nov 3 2026): each alert
 * is an HTTP POST carrying the Document ID, Company ID and Company Name, signed with our
 * Secret Key using HS256, with an X-CT-Signature header we can verify it with. We have not
 * seen their published docs or a real alert, so this is strict about the signature (HS256
 * only; "none", other HMACs and key-pair algorithms are refused) and tolerant about where
 * the signed token sits and how the fields are spelled.
 *
 * X-CT-Signature is read two ways, because the emails don't say which it is:
 *   - a JWT (HS256, signed with the Secret Key) whose claims are the event, or
 *   - an HMAC-SHA256 of the raw body with the Secret Key (hex or base64, optional "sha256=").
 * When the header is present it must verify; a request with no header falls back to a JWT
 * in the body or a Bearer header.
 */

export class RaiWebhookError extends Error {}

/**
 * A correctly signed callback for an event we don't act on. A callback URL receives every
 * event on the account (new-invoice, paid-invoice and new-document, per the partner's API
 * docs), so these are answered 200 and dropped rather than refused.
 */
export class RaiIgnoredEvent extends Error {
  constructor(readonly eventName: string) {
    super(`ignored ${eventName} event`);
  }
}

/** Event names that mean a new document arrived. The docs call it "new-document". */
const DOCUMENT_EVENT_NAMES = new Set(["new-document", "new_document", "document.new", "document-new", "newdocument"]);

/** Env var holding the API secret the partner signs alerts with. Never logged. */
export const RAI_WEBHOOK_SECRET_ENV = "RAI_API_SECRET";

/** The partner confirmed HS256; anything else is refused. */
const HMAC_ALGS = { HS256: "sha256" } as const;

/** Header the partner puts its signature in. */
export const RAI_SIGNATURE_HEADER = "x-ct-signature";
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

/** An object, or a JSON string holding one (some senders put the event in a string claim). */
function asObject(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string" && v.length <= MAX_TOKEN_LENGTH && v.trim().startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(v);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

/** A plain event name like "new-invoice", lower-cased; anything else is not an event name. */
function readEventName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return /^[a-z]+([-_.][a-z]+)+$/.test(t) && t.length <= 60 ? t : null;
}

/**
 * The document and company from the verified claims, looking at the top level and one
 * level down (data, document, payload, event, content). With no document ID, a named
 * non-document event (like "new-invoice") throws RaiIgnoredEvent; anything else is refused.
 */
export function readRaiDocumentEvent(claims: Record<string, unknown>): RaiDocumentEvent {
  const layers: Record<string, unknown>[] = [claims];
  for (const key of ["data", "document", "payload", "event", "content"]) {
    const v = asObject(pick(claims, [key]));
    if (v) layers.push(v);
  }
  const find = (names: string[]) => {
    for (const layer of layers) {
      const v = pick(layer, names);
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  };
  const documentId = idString(find(["document_id", "documentId"]), 200);
  if (!documentId) {
    // Only a named, non-document event is dropped; a document ID always wins.
    const eventName = readEventName(find(["event", "event_name", "eventName", "event_type", "eventType", "type"]));
    if (eventName && !DOCUMENT_EVENT_NAMES.has(eventName)) throw new RaiIgnoredEvent(eventName);
    throw new RaiWebhookError("no document ID in the alert");
  }
  return {
    documentId,
    companyId: idString(find(["company_id", "companyId", "entity_id"]), 100),
    companyName: nameString(find(["company_name", "companyName", "entity_name"])),
  };
}

/** The bytes of a body signature: hex or base64(url), with an optional "sha256=" prefix. */
function decodeBodySignature(sig: string): Buffer | null {
  const v = sig.trim().replace(/^sha256=/i, "");
  if (/^[0-9a-f]{64}$/i.test(v)) return Buffer.from(v, "hex");
  if (/^[A-Za-z0-9+/_-]{43}={0,1}$/.test(v)) return Buffer.from(v.replace(/=+$/, ""), "base64url");
  return null;
}

/** Check an HMAC-SHA256 of the exact raw body against the X-CT-Signature value. */
export function verifyRaiBodySignature(rawBody: string, signature: string, secret: string): void {
  if (!secret) throw new RaiWebhookError("no secret configured");
  const given = decodeBodySignature(signature);
  if (!given) throw new RaiWebhookError("signature header is not a recognised format");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new RaiWebhookError("bad signature");
}

function claimsFromSignedBody(rawBody: string, secret: string, now: Date): Record<string, unknown> {
  // The body is already authenticated; if it also carries a token, that token must verify too.
  let token: string | null = null;
  try {
    token = extractRaiToken(rawBody, new Headers());
  } catch {
    token = null;
  }
  if (token) return verifyRaiJwt(token, secret, now);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new RaiWebhookError("body is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new RaiWebhookError("body is not an object");
  return parsed as Record<string, unknown>;
}

/** Everything the route needs: find the signature, verify it, read the event. */
export function parseRaiDocumentAlert(rawBody: string, headers: Headers, secret: string, now: Date = new Date()): RaiDocumentEvent {
  const sigHeader = headers.get(RAI_SIGNATURE_HEADER)?.trim();
  if (sigHeader) {
    if (looksLikeJwt(sigHeader)) return readRaiDocumentEvent(verifyRaiJwt(sigHeader, secret, now));
    verifyRaiBodySignature(rawBody, sigHeader, secret);
    return readRaiDocumentEvent(claimsFromSignedBody(rawBody, secret, now));
  }
  return readRaiDocumentEvent(verifyRaiJwt(extractRaiToken(rawBody, headers), secret, now));
}
