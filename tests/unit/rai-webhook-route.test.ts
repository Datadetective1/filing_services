import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Recording needs a database; it's tested on its own.
const record = vi.fn();
vi.mock("@/lib/registered-agent/document-events", () => ({ recordProviderDocumentAlert: (...a: unknown[]) => record(...a) }));

const SECRET = "route-secret";
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
function sign(claims: Record<string, unknown>, secret = SECRET, alg = "HS256") {
  const h = b64({ alg, typ: "JWT" });
  const p = b64(claims);
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.RAI_API_SECRET;
  record.mockReset();
  record.mockResolvedValue("recorded");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  if (saved === undefined) delete process.env.RAI_API_SECRET;
  else process.env.RAI_API_SECRET = saved;
});

async function post(body: string, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/webhooks/registered-agent/route");
  return POST(new NextRequest("http://localhost/api/webhooks/registered-agent", { method: "POST", body, headers }));
}

describe("registered agent alert route", () => {
  it("answers 503 and records nothing until the secret is set", async () => {
    delete process.env.RAI_API_SECRET;
    const res = await post(sign({ document_id: "D1" }));
    expect(res.status).toBe(503);
    expect(record).not.toHaveBeenCalled();
  });

  it("records a signed alert and returns the outcome", async () => {
    process.env.RAI_API_SECRET = SECRET;
    const res = await post(JSON.stringify({ token: sign({ document_id: "D1", company_id: "C9", company_name: "Acme LLC" }) }), { "content-type": "application/json" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, outcome: "recorded" });
    expect(record).toHaveBeenCalledWith({ documentId: "D1", companyId: "C9", companyName: "Acme LLC" });
  });

  it("answers 200 for a replayed alert (recording reports a duplicate)", async () => {
    process.env.RAI_API_SECRET = SECRET;
    record.mockResolvedValue("duplicate");
    const res = await post(sign({ document_id: "D1" }));
    expect(await res.json()).toEqual({ received: true, outcome: "duplicate" });
  });

  it("rejects unsigned, wrongly signed and plain JSON alerts with 401 and records nothing", async () => {
    process.env.RAI_API_SECRET = SECRET;
    const unsigned = `${b64({ alg: "none" })}.${b64({ document_id: "D1" })}.`;
    for (const body of [unsigned, sign({ document_id: "D1" }, "wrong"), JSON.stringify({ document_id: "D1", company_id: "C9" }), "", "{oops"]) {
      const res = await post(body);
      expect(res.status, body).toBe(401);
    }
    expect(record).not.toHaveBeenCalled();
  });

  it("records a plain JSON alert signed in the X-CT-Signature header, and rejects a bad one", async () => {
    process.env.RAI_API_SECRET = SECRET;
    const body = JSON.stringify({ event: "document.new", document_id: "D2", company_id: "C9", company_name: "Acme LLC" });
    const good = createHmac("sha256", SECRET).update(body).digest("hex");
    const res = await post(body, { "content-type": "application/json", "X-CT-Signature": good });
    expect(res.status).toBe(200);
    expect(record).toHaveBeenCalledWith({ documentId: "D2", companyId: "C9", companyName: "Acme LLC" });
    record.mockClear();
    const bad = createHmac("sha256", "wrong").update(body).digest("hex");
    expect((await post(body, { "X-CT-Signature": bad })).status).toBe(401);
    expect((await post(body, { "X-CT-Signature": sign({ document_id: "D2" }, "wrong") })).status).toBe(401);
    expect(record).not.toHaveBeenCalled();
  });

  it("rejects a signed alert with no document ID", async () => {
    process.env.RAI_API_SECRET = SECRET;
    const res = await post(sign({ company_id: "C9" }));
    expect(res.status).toBe(401);
    expect(record).not.toHaveBeenCalled();
  });

  it("refuses an oversized body", async () => {
    process.env.RAI_API_SECRET = SECRET;
    const res = await post("x".repeat(70 * 1024));
    expect(res.status).toBe(413);
  });

  it("answers 500 when recording fails, so the partner retries", async () => {
    process.env.RAI_API_SECRET = SECRET;
    record.mockRejectedValue(new Error("db down"));
    const res = await post(sign({ document_id: "D1" }));
    expect(res.status).toBe(500);
  });

  it("answers 200 and records nothing for signed invoice events sent to the same URL", async () => {
    process.env.RAI_API_SECRET = SECRET;
    for (const event of ["new-invoice", "paid-invoice"]) {
      const res = await post(sign({ event, invoice_id: "I1", company_id: "C9" }));
      expect(res.status, event).toBe(200);
      expect(await res.json()).toEqual({ received: true, ignored: event });
    }
    expect(record).not.toHaveBeenCalled();
    // An invoice event that isn't signed with our secret is still refused.
    expect((await post(sign({ event: "new-invoice" }, "wrong"))).status).toBe(401);
  });
});
