import { afterEach, describe, expect, it, vi } from "vitest";
import { site } from "@/config/site";
import {
  defaultEmailFrom,
  describeResendError,
  EMAIL_NOT_CONFIGURED,
  type EmailDeliveryInput,
  getEmailProvider,
  getEmailReadiness,
  providerFor,
  resolveEmailDelivery,
} from "@/lib/email/provider";

// Pure decision tests: nothing here constructs a network call.
const base: EmailDeliveryInput = {
  testRunner: false,
  production: true,
  provider: undefined,
  deliveryOutsideProduction: false,
  hasApiKey: true,
  from: undefined,
  replyTo: undefined,
};
const decide = (over: Partial<EmailDeliveryInput>) => resolveEmailDelivery({ ...base, ...over });

const email = { to: "owner@realmail.com", subject: "s", html: "<p>h</p>", text: "t", idempotencyKey: "k" };

describe("resolveEmailDelivery", () => {
  it("delivers through Resend on production when the key is present (the default when EMAIL_PROVIDER is unset)", () => {
    expect(decide({}).mode).toBe("resend");
    expect(decide({ provider: "resend" }).mode).toBe("resend");
    expect(decide({}).reason).toBeNull();
  });

  it("uses the outbox on production when EMAIL_PROVIDER=outbox is set explicitly", () => {
    const d = decide({ provider: "outbox" });
    expect(d.mode).toBe("outbox");
    expect(d.reason).toMatch(/outbox/);
  });

  it("uses the outbox outside production even with a Resend key and EMAIL_PROVIDER=resend", () => {
    for (const provider of [undefined, "resend", "outbox"]) {
      const d = decide({ production: false, provider, hasApiKey: true });
      expect(d.mode).toBe("outbox");
    }
    expect(decide({ production: false, provider: "resend" }).reason).toMatch(/Not the production deployment/);
  });

  it("allows delivery outside production only with EMAIL_PROVIDER=resend and the explicit override", () => {
    expect(decide({ production: false, provider: "resend", deliveryOutsideProduction: true }).mode).toBe("resend");
    // The override alone does not switch a deployment that never asked for Resend.
    expect(decide({ production: false, provider: undefined, deliveryOutsideProduction: true }).mode).toBe("outbox");
    expect(decide({ production: false, provider: "outbox", deliveryOutsideProduction: true }).mode).toBe("outbox");
  });

  it("is misconfigured, not a silent outbox, when Resend is requested without an API key", () => {
    const d = decide({ hasApiKey: false });
    expect(d.mode).toBe("misconfigured");
    expect(d.reason).toBe(EMAIL_NOT_CONFIGURED);
    expect(decide({ provider: "resend", hasApiKey: false }).mode).toBe("misconfigured");
    expect(decide({ production: false, provider: "resend", deliveryOutsideProduction: true, hasApiKey: false }).mode).toBe(
      "misconfigured",
    );
  });

  it("always uses the outbox under the test runner", () => {
    for (const production of [true, false]) {
      const d = decide({ testRunner: true, production, provider: "resend", deliveryOutsideProduction: true, hasApiKey: true });
      expect(d.mode).toBe("outbox");
    }
    expect(decide({ testRunner: true, hasApiKey: false }).mode).toBe("outbox");
  });

  it("defaults the sender to the verified domain and Reply-To to support; env overrides win", () => {
    const d = decide({});
    expect(d.from).toBe(`${site.name} <filings@${site.domain}>`);
    expect(d.from).toBe(defaultEmailFrom());
    expect(d.replyTo).toBe(site.supportEmail);
    const custom = decide({ from: "Ops <ops@getfilewell.com>", replyTo: "help@getfilewell.com" });
    expect(custom.from).toBe("Ops <ops@getfilewell.com>");
    expect(custom.replyTo).toBe("help@getfilewell.com");
    // Blank values are treated as unset.
    expect(decide({ from: "  ", replyTo: "" }).from).toBe(defaultEmailFrom());
  });
});

describe("providerFor", () => {
  it("returns the outbox for outbox mode, which delivers nothing", async () => {
    const p = providerFor(decide({ provider: "outbox" }), "re_unit_test_placeholder");
    expect(p.name).toBe("outbox");
    await expect(p.send(email)).resolves.toEqual({ id: expect.stringMatching(/^outbox_/) });
  });

  it("fails every send visibly when misconfigured", async () => {
    const p = providerFor(decide({ hasApiKey: false }), undefined);
    expect(p.name).toBe("resend");
    await expect(p.send(email)).rejects.toThrow("Email delivery is not configured");
  });

  it("never builds a Resend client without a key, even if the decision said resend", async () => {
    const p = providerFor(decide({}), "   ");
    await expect(p.send(email)).rejects.toThrow("Email delivery is not configured");
  });

  it("builds the Resend provider when configured (no send is attempted here)", () => {
    expect(providerFor(decide({}), "re_unit_test_placeholder").name).toBe("resend");
  });
});

describe("getEmailProvider / getEmailReadiness under the test runner", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stay on the outbox even when production, Resend and a key are all configured", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_unit_test_placeholder");
    vi.stubEnv("EMAIL_DELIVERY_OUTSIDE_PRODUCTION", "true");
    expect(getEmailProvider().name).toBe("outbox");
    const r = getEmailReadiness();
    expect(r.mode).toBe("outbox");
    expect(r.delivering).toBe(false);
    expect(r.reason).toMatch(/Test runner/);
  });
});

describe("describeResendError", () => {
  it("keeps the error name and message", () => {
    expect(describeResendError({ name: "validation_error", message: "The getfilewell.com domain is not verified." })).toBe(
      "Email send failed: validation_error: The getfilewell.com domain is not verified.",
    );
  });

  it("redacts anything that looks like an API key, strips newlines and caps the length", () => {
    const out = describeResendError({ name: "invalid_api_key", message: `API key re_AbC123_secretValue is invalid\nline2 ${"x".repeat(600)}` });
    expect(out).not.toContain("secretValue");
    expect(out).toContain("re_[redacted]");
    expect(out).not.toMatch(/[\r\n]/);
    expect(out.length).toBeLessThan(360);
  });

  it("handles a missing error", () => {
    expect(describeResendError(null)).toBe("Email send failed: unknown");
    expect(describeResendError({ name: "rate_limit_exceeded", message: "" })).toBe("Email send failed: rate_limit_exceeded");
  });
});
