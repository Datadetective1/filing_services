import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractRaiToken, parseRaiDocumentAlert, RaiIgnoredEvent, RaiWebhookError, raiWebhookSecret, readRaiDocumentEvent, verifyRaiBodySignature, verifyRaiJwt } from "@/lib/registered-agent/rai-webhook";

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
  it("accepts a token signed with the API secret using HS256", () => {
    expect(verifyRaiJwt(sign(CLAIMS), SECRET, NOW)).toMatchObject(CLAIMS);
  });

  it("refuses other HMAC algorithms, since the partner signs with HS256 only", () => {
    for (const alg of ["HS384", "HS512"]) {
      expect(() => verifyRaiJwt(sign(CLAIMS, { alg }), SECRET, NOW)).toThrow("unsupported signing algorithm");
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
    expect(raiWebhookSecret({ RAI_API_SECRET: " s3cret " } as unknown as NodeJS.ProcessEnv)).toBe("s3cret");
    expect(raiWebhookSecret({ RAI_API_SECRET: "  " } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(raiWebhookSecret({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("X-CT-Signature", () => {
  const expected = { documentId: "D-1001", companyId: "55123", companyName: "Acme LLC" };
  const body = JSON.stringify({ event: "document.new", ...CLAIMS });
  const mac = (raw: string, secret = SECRET) => createHmac("sha256", secret).update(raw).digest();

  it("reads the event from a JWT in the header", () => {
    const headers = new Headers({ "X-CT-Signature": sign(CLAIMS) });
    expect(parseRaiDocumentAlert("", headers, SECRET, NOW)).toEqual(expected);
  });

  it("refuses a header JWT signed with another key, even if the body holds a good token", () => {
    const headers = new Headers({ "X-CT-Signature": sign(CLAIMS, { secret: "someone-else" }) });
    expect(() => parseRaiDocumentAlert(sign(CLAIMS), headers, SECRET, NOW)).toThrow("bad signature");
  });

  it("accepts an HMAC-SHA256 of the raw body in hex, base64, base64url or with a sha256= prefix", () => {
    const m = mac(body);
    for (const sig of [m.toString("hex"), m.toString("base64"), m.toString("base64url"), `sha256=${m.toString("hex")}`]) {
      expect(parseRaiDocumentAlert(body, new Headers({ "X-CT-Signature": sig }), SECRET, NOW)).toEqual(expected);
    }
  });

  it("refuses a body signature made with another key or over a changed body", () => {
    const wrongKey = mac(body, "someone-else").toString("hex");
    expect(() => parseRaiDocumentAlert(body, new Headers({ "X-CT-Signature": wrongKey }), SECRET, NOW)).toThrow("bad signature");
    const good = mac(body).toString("hex");
    const changed = body.replace("55123", "99999");
    expect(() => parseRaiDocumentAlert(changed, new Headers({ "X-CT-Signature": good }), SECRET, NOW)).toThrow("bad signature");
  });

  it("refuses a header it can't read instead of falling back to the body", () => {
    expect(() => parseRaiDocumentAlert(sign(CLAIMS), new Headers({ "X-CT-Signature": "nope" }), SECRET, NOW)).toThrow("not a recognised format");
  });

  it("still checks a token inside a signed body", () => {
    const raw = JSON.stringify({ token: sign(CLAIMS, { secret: "someone-else" }) });
    const headers = new Headers({ "X-CT-Signature": mac(raw).toString("hex") });
    expect(() => parseRaiDocumentAlert(raw, headers, SECRET, NOW)).toThrow("bad signature");
    const ok = JSON.stringify({ token: sign(CLAIMS) });
    expect(parseRaiDocumentAlert(ok, new Headers({ "X-CT-Signature": mac(ok).toString("hex") }), SECRET, NOW)).toEqual(expected);
  });

  it("refuses a signed body that isn't a JSON object", () => {
    const raw = "[1,2]";
    expect(() => parseRaiDocumentAlert(raw, new Headers({ "X-CT-Signature": mac(raw).toString("hex") }), SECRET, NOW)).toThrow("not an object");
  });

  it("refuses everything when no secret is configured", () => {
    expect(() => verifyRaiBodySignature(body, mac(body).toString("hex"), "")).toThrow("no secret configured");
  });
});

describe("callback event names", () => {
  it("drops named non-document events", () => {
    for (const event of ["new-invoice", "paid-invoice", "Paid-Invoice"]) {
      expect(() => readRaiDocumentEvent({ event, invoice_id: "I1" }), event).toThrow(RaiIgnoredEvent);
    }
    expect(() => readRaiDocumentEvent({ type: "new-invoice" })).toThrow(RaiIgnoredEvent);
  });

  it("reads new-document events, and a document ID always wins over the name", () => {
    expect(readRaiDocumentEvent({ event: "new-document", document_id: "D1", company_name: "Acme LLC" })).toEqual({ documentId: "D1", companyId: null, companyName: "Acme LLC" });
    expect(readRaiDocumentEvent({ event: "new-invoice", document_id: "D1" }).documentId).toBe("D1");
    expect(readRaiDocumentEvent({ type: "document", data: { document_id: "D3" } }).documentId).toBe("D3");
  });

  it("refuses a document event, or an unnamed one, with no document ID", () => {
    for (const claims of [{ event: "new-document" }, { type: "document" }, {}]) {
      const fn = () => readRaiDocumentEvent(claims);
      expect(fn).toThrow(RaiWebhookError);
      expect(fn).not.toThrow(RaiIgnoredEvent);
    }
  });

  it("reads the event from a JSON string claim", () => {
    const content = JSON.stringify({ event: "new-document", document_id: "D4", company_id: "C1" });
    expect(readRaiDocumentEvent({ content })).toEqual({ documentId: "D4", companyId: "C1", companyName: null });
    expect(() => readRaiDocumentEvent({ content: JSON.stringify({ event: "new-invoice" }) })).toThrow(RaiIgnoredEvent);
  });
});
