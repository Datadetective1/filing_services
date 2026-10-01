import "server-only";

/**
 * Lob print & mail adapter (https://api.lob.com/v1, basic auth with the API key as user).
 *
 * Safety is enforced here, before any network call:
 *  - Keys starting "test_" create TEST postcards: Lob renders them but never prints, mails
 *    or charges. This is the only mode usable today.
 *  - A "live_" key is refused unless MAIL_SENDS_ENABLED is exactly "true", the campaign is
 *    approved, MAIL_VENDOR is "lob" and a real return address is configured. None of these
 *    are set, and MAIL_SENDS_ENABLED stays false until the owner authorizes mailing.
 *  - Every request carries an Idempotency-Key (the marketing_sends row id), so a retry can
 *    never create a second piece.
 */

export type LobMode = "test" | "live";

export class MailBlockedError extends Error {
  constructor(readonly reasons: string[]) {
    super(`Mail blocked: ${reasons.join("; ")}`);
    this.name = "MailBlockedError";
  }
}

export interface LobAddress {
  name?: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country: "US";
}

export function lobMode(key: string | undefined | null): LobMode | null {
  if (!key) return null;
  if (key.startsWith("test_")) return "test";
  if (key.startsWith("live_")) return "live";
  return null;
}

/** The configured return ("from") address, or null when any required part is missing. */
export function lobFromAddress(env: Record<string, string | undefined> = process.env): LobAddress | null {
  const line1 = env.MAIL_FROM_LINE1?.trim();
  const city = env.MAIL_FROM_CITY?.trim();
  const state = env.MAIL_FROM_STATE?.trim();
  const zip = env.MAIL_FROM_ZIP?.trim();
  if (!line1 || !city || !state || !zip) return null;
  return {
    company: "Filewell",
    name: env.MAIL_FROM_NAME?.trim() || undefined,
    address_line1: line1,
    address_line2: env.MAIL_FROM_LINE2?.trim() || undefined,
    address_city: city,
    address_state: state,
    address_zip: zip,
    address_country: "US",
  };
}

/** Why a send in this mode would be refused (empty = allowed). Pure, for tests and the admin page. */
export function mailBlockers(input: {
  mode: LobMode | null;
  vendor: string | undefined;
  sendsEnabled: string | undefined;
  campaignApproved: boolean;
  hasFromAddress: boolean;
}): string[] {
  const out: string[] = [];
  if (!input.mode) out.push("No Lob API key (LOB_API_KEY) configured");
  if (!input.hasFromAddress) out.push("No return address (MAIL_FROM_LINE1, MAIL_FROM_CITY, MAIL_FROM_STATE, MAIL_FROM_ZIP)");
  if (input.mode === "live") {
    if (input.vendor !== "lob") out.push("MAIL_VENDOR is not lob");
    if (input.sendsEnabled !== "true") out.push("MAIL_SENDS_ENABLED is not true (live mailing is switched off)");
    if (!input.campaignApproved) out.push("Campaign is not approved");
  }
  return out;
}

export interface CreatePostcardInput {
  idempotencyKey: string;
  description: string;
  to: LobAddress;
  from: LobAddress;
  front: string;
  back: string;
  metadata: Record<string, string>;
}

export interface LobPostcard {
  id: string;
  url?: string;
  expected_delivery_date?: string;
}

export async function createLobPostcard(
  key: string,
  input: CreatePostcardInput,
  guard: { campaignApproved: boolean; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch },
): Promise<LobPostcard> {
  const env = guard.env ?? process.env;
  const mode = lobMode(key);
  const blockers = mailBlockers({ mode, vendor: env.MAIL_VENDOR, sendsEnabled: env.MAIL_SENDS_ENABLED, campaignApproved: guard.campaignApproved, hasFromAddress: Boolean(input.from) });
  if (blockers.length) throw new MailBlockedError(blockers);
  const res = await (guard.fetchImpl ?? fetch)("https://api.lob.com/v1/postcards", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      description: input.description.slice(0, 255),
      to: input.to,
      from: input.from,
      front: input.front,
      back: input.back,
      size: "4x6",
      use_type: "marketing",
      mail_type: "usps_first_class",
      metadata: input.metadata,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; url?: string; expected_delivery_date?: string; error?: { message?: string } };
  if (!res.ok || !body.id) throw new Error(`Lob ${res.status}: ${body.error?.message ?? "request failed"}`);
  return { id: body.id, url: body.url, expected_delivery_date: body.expected_delivery_date };
}
