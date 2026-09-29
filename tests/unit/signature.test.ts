import { describe, expect, it } from "vitest";
import { SIGNATURE_TOLERANCE_SECONDS, signPayload, verifySignature } from "@/lib/payments/signature";
import { WebhookVerificationError } from "@/lib/payments/types";

const SECRET = "whsec_test_0123456789abcdef";
const BODY = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { amount_total: 5600 } });
const NOW = 1_790_000_000;

function expectRejected(fn: () => void, message: RegExp) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(WebhookVerificationError);
    expect((e as Error).message).toMatch(message);
    return;
  }
  throw new Error("expected verification to fail");
}

describe("webhook signatures", () => {
  it("produces a Stripe-style header", () => {
    expect(signPayload(BODY, SECRET, NOW)).toMatch(/^t=1790000000,v1=[0-9a-f]{64}$/);
  });

  it("verifies a correctly signed payload", () => {
    const header = signPayload(BODY, SECRET, NOW);
    expect(() => verifySignature(BODY, header, SECRET, NOW)).not.toThrow();
    // Within tolerance on either side.
    expect(() => verifySignature(BODY, header, SECRET, NOW + SIGNATURE_TOLERANCE_SECONDS)).not.toThrow();
    expect(() => verifySignature(BODY, header, SECRET, NOW - 10)).not.toThrow();
  });

  it("rejects a tampered body", () => {
    const header = signPayload(BODY, SECRET, NOW);
    const tampered = BODY.replace("5600", "1");
    expectRejected(() => verifySignature(tampered, header, SECRET, NOW), /mismatch/);
    expectRejected(() => verifySignature(`${BODY} `, header, SECRET, NOW), /mismatch/);
  });

  it("rejects a signature made with a different secret", () => {
    const header = signPayload(BODY, "some-other-secret", NOW);
    expectRejected(() => verifySignature(BODY, header, SECRET, NOW), /mismatch/);
  });

  it("rejects a re-signed timestamp (signature binds the timestamp)", () => {
    const header = signPayload(BODY, SECRET, NOW - 1000);
    const forged = header.replace(`t=${NOW - 1000}`, `t=${NOW}`);
    expectRejected(() => verifySignature(BODY, forged, SECRET, NOW), /mismatch/);
  });

  it("rejects deliveries outside the timestamp tolerance (replay)", () => {
    const old = signPayload(BODY, SECRET, NOW - SIGNATURE_TOLERANCE_SECONDS - 1);
    expectRejected(() => verifySignature(BODY, old, SECRET, NOW), /tolerance/);
    const future = signPayload(BODY, SECRET, NOW + SIGNATURE_TOLERANCE_SECONDS + 1);
    expectRejected(() => verifySignature(BODY, future, SECRET, NOW), /tolerance/);
  });

  it("rejects missing and malformed headers", () => {
    expectRejected(() => verifySignature(BODY, null, SECRET, NOW), /missing/);
    expectRejected(() => verifySignature(BODY, "", SECRET, NOW), /missing/);
    const mac = signPayload(BODY, SECRET, NOW).split("v1=")[1];
    for (const header of [
      "garbage",
      `t=${NOW}`,
      `v1=${mac}`,
      `t=abc,v1=${mac}`,
      `t=${NOW},v1=zz`,
      `t=${NOW},v1=${mac.toUpperCase()}`,
      `t=${NOW},v1=${mac}00`,
    ]) {
      expectRejected(() => verifySignature(BODY, header, SECRET, NOW), /malformed/);
    }
  });
});
