import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractRaiToken, parseRaiDocumentAlert, RaiWebhookError, raiWebhookSecret, readRaiDocumentEvent, verifyRaiJwt } from "@/lib/registered-agent/rai-webhook";

/**
 * Registered Agents Inc. alerts: only an HMAC token signed with our API secret is read,
 * and the document and company come out of it however the partner spells the fields.
 */

const SECRET = "test-api-secret";
const NOW = new Date("2026-10-30T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

const b64 = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

function sign(claims: Record<string, unknown>, opts: { alg?: string; secret?: string; header?: Record<string, unknown> } = {}) {
  const alg = opts.alg ?? "HS256";
  const h = b64(opts.header ?? { alg, typ: "JWT" });
  const p = b64(claims);
  const hash = alg === "HS512" ? "sha512" : alg === "HS384" ? "sha384" : "sha256";
  const s = createHmac(hash, opts.secret ?? SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}

const CLAIMS = { document_id: "D-1001", company_id: "55123", company_name: "Acme LLC" };

describe("verifyRaiJwt", () => {
  it("accepts a token signed with the API secret (HS256, HS384, HS512)", () => {
    for (const alg of ["HS256", "HS384", "HS512"]) {
      expect(verifyRaiJwt(sign(CLAIMS, { alg }), SECRET, NOW)).toMatchObject(CLAIMS);
    }
  });

  it("refuses a token signed with another key", () => {
    expect(() => verifyRaiJwt(sign(CLAIMS, { secret: "someone-else" }), SECRET, NOW)).toThrow(RaiWebhookError);
  });

  it("refuses an unsigned token (alg none) and key-pair algorithms", () => {
    const unsigned = `${b64({ alg: "none" })}.${b64(CLAIMS)}.`;
    expect(() => verifyRaiJwt(unsigned, SECRET, NOW)).toThrow(RaiWebhookError);
    const noneWithSig = sign(CLAIMS, { header: { alg: "none" } });
    expect(() => verifyRaiJwt(noneWithSig, SECRET, NOW)).toThrow("unsupported signing algorithm");
    const rs = sign(CLAIMS, { header: { alg: "RS256" } });
    expect(() => verifyRaiJwt(rs, SECRET, NOW)).toThrow("unsupported signing algorithm");
  });

  it("refuses a token whose claims were changed after signing", () => {
    const [h, , s] = sign(CLAIMS).split(".");
    const tampered = `${h}.${b64({ ...CLAIMS, company_id: "99999" })}.${s}`;
    expect(() => verifyRaiJwt(tampered, SECRET, NOW)).toThrow("bad signature");
  });

  it("refuses an expired token and one not valid yet, with five minutes of slack", () => {
    expect(() => verifyRaiJwt(sign({ ...CLAIMS, exp: nowSec - 600 }), SECRET, NOW)).toThrow("token expired");
    expect(verifyRaiJwt(sign({ ...CLAIMS, exp: nowSec - 60 }), SECRET, NOW)).toMatchObject(CLAIMS);
    expect(() => verifyRaiJwt(sign({ ...CLAIMS, nbf: nowSec + 600 }), SECRET, NOW)).toThrow("token not yet valid");
    expect(() => verifyRaiJwt(sign({ ...CLAIMS, exp: "tomorrow" }), SECRET, NOW)).toThrow("token expired");
  });

  it("refuses everything when no secret is configured", () => {
    expect(() => verifyRaiJwt(sign(CLAIMS, { secret: "" }), "", NOW)).toThrow("no secret configured");
  });

  it("refuses garbage", () => {
    expect(() => verifyRaiJwt("not-a-token", SECRET, NOW)).toThrow(RaiWebhookError);
    expect(() => verifyRaiJwt(`${b64("x")}.${b64("y")}.${b64("z")}`, SECRET, NOW)).toThrow(RaiWebhookError);
  });
});

describe("extractRaiToken", () => {
  const token = sign(CLAIMS);
  const none = new Headers();

  it("reads the raw body, a JSON field or a Bearer header", () => {
    expect(extractRaiToken(token, none)).toBe(token);
    expect(extractRaiToken(`  ${token}\n`, none)).toBe(token);
    for (const key of ["token", "jwt", "data", "payload", "content"]) {
      expect(extractRaiToken(JSON.stringify({ [key]: token }), none)).toBe(token);
    }
    expect(extractRaiToken("", new Headers({ authorization: `Bearer ${token}` }))).toBe(token);
  });

  it("refuses a plain JSON alert with no signed token in it", () => {
    expect(() => extractRaiToken(JSON.stringify(CLAIMS), none)).toThrow("no signed token");
    expect(() => extractRaiToken("{not json", none)).toThrow(RaiWebhookError);
    expect(() => extractRaiToken("", none)).toThrow(RaiWebhookError);
  });
});

describe("readRaiDocumentEvent", () => {
  it("reads the fields however they're spelled, at the top level or one level down", () => {
    const expected = { documentId: "D-1001", companyId: "55123", companyName: "Acme LLC" };
    expect(readRaiDocumentEvent(CLAIMS)).toEqual(expected);
    expect(readRaiDocumentEvent({ "Document ID": "D-1001", "Company ID": "55123", "Company Name": "Acme LLC" })).toEqual(expected);
    expect(readRaiDocumentEvent({ documentId: "D-1001", companyId: 55123, companyName: "Acme LLC" })).toEqual(expected);
    expect(readRaiDocumentEvent({ iat: 1, data: { DocumentID: "D-1001", CompanyID: "55123", CompanyName: "Acme LLC" } })).toEqual(expected);
  });

  it("refuses an alert without a usable document ID", () => {
    expect(() => readRaiDocumentEvent({ company_id: "55123" })).toThrow("no document ID");
    expect(() => readRaiDocumentEvent({ document_id: "../../etc" })).toThrow("no document ID");
    expect(() => readRaiDocumentEvent({ document_id: "x".repeat(201) })).toThrow("no document ID");
  });

  it("keeps a company name as plain text and drops an odd company ID", () => {
    const e = readRaiDocumentEvent({ document_id: "1", company_id: "a b", company_name: "Acme\u0000\nLLC   " + "x".repeat(400) });
    expect(e.companyId).toBeNull();
    expect(e.companyName?.startsWith("Acme LLC x")).toBe(true);
    expect(e.companyName?.length).toBe(300);
  });
});

describe("parseRaiDocumentAlert and the secret", () => {
  it("verifies and reads in one step", () => {
    expect(parseRaiDocumentAlert(JSON.stringify({ token: sign(CLAIMS) }), new Headers(), SECRET, NOW)).toEqual({
      documentId: "D-1001",
      companyId: "55123",
      companyName: "Acme LLC",
    });
  });

  it("reads the secret from RAI_API_SECRET only, ignoring blanks", () => {
    expect(raiWebhookSecret({ RAI_API_SECRET: " s3cret " } as NodeJS.ProcessEnv)).toBe("s3cret");
    expect(raiWebhookSecret({ RAI_API_SECRET: "  " } as NodeJS.ProcessEnv)).toBeNull();
    expect(raiWebhookSecret({} as NodeJS.ProcessEnv)).toBeNull();
  });
});
