import "server-only";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { isProductionEnvironment, site } from "@/config/site";
import { env } from "@/lib/env";
import { isTestRunner } from "@/lib/runtime";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  headers?: Record<string, string>;
}

export interface EmailProvider {
  readonly name: "outbox" | "resend";
  send(email: OutgoingEmail): Promise<{ id: string }>;
}

/** Email is switched on for this deployment but cannot be delivered (e.g. no API key). */
export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

/**
 * Outbox: records the email (the notifications table already stores the full
 * rendered message) and delivers nothing. Contains no network code. Used in
 * development, tests, previews/staging, and wherever EMAIL_PROVIDER=outbox.
 */
class OutboxEmailProvider implements EmailProvider {
  readonly name = "outbox" as const;
  async send(): Promise<{ id: string }> {
    return { id: `outbox_${randomUUID()}` };
  }
}

/**
 * Resend was requested but cannot be used. Every send fails with a clear reason,
 * so the notification row is marked "failed" instead of silently landing in the
 * outbox as "sent".
 */
class UnconfiguredEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  constructor(private readonly reason: string) {}
  async send(): Promise<{ id: string }> {
    throw new EmailConfigurationError(this.reason);
  }
}

/** Resend's error name and message, without anything that looks like key material. */
export function describeResendError(error: { name?: string | null; message?: string | null } | null | undefined): string {
  const name = error?.name || "unknown";
  const message = (error?.message ?? "")
    .replace(/re_[A-Za-z0-9_-]+/g, "re_[redacted]")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 300);
  return message ? `Email send failed: ${name}: ${message}` : `Email send failed: ${name}`;
}

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  private readonly client: Resend;
  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly replyTo: string,
  ) {
    this.client = new Resend(apiKey);
  }
  async send(email: OutgoingEmail): Promise<{ id: string }> {
    const { data, error } = await this.client.emails.send(
      {
        from: this.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: this.replyTo,
        headers: email.headers,
      },
      { idempotencyKey: email.idempotencyKey.slice(0, 256) },
    );
    if (error || !data) throw new Error(describeResendError(error));
    return { id: data.id };
  }
}

/** Default sender on the verified domain, e.g. "Filewell <filings@getfilewell.com>". */
export function defaultEmailFrom(): string {
  return `${site.name} <filings@${site.domain}>`;
}

export interface EmailDeliveryInput {
  testRunner: boolean;
  /** The Vercel production deployment. */
  production: boolean;
  /** EMAIL_PROVIDER exactly as configured; undefined when unset. */
  provider: string | undefined;
  /** EMAIL_DELIVERY_OUTSIDE_PRODUCTION === "true": staging-only override for deliverability checks. */
  deliveryOutsideProduction: boolean;
  hasApiKey: boolean;
  from: string | undefined;
  replyTo: string | undefined;
}

export interface EmailDelivery {
  mode: "outbox" | "resend" | "misconfigured";
  from: string;
  replyTo: string;
  /** Plain-language reason when nothing is delivered (never contains secrets). */
  reason: string | null;
}

export const EMAIL_NOT_CONFIGURED = "Email delivery is not configured: RESEND_API_KEY is missing";

/**
 * The single decision about where email goes (pure, so the matrix is testable):
 *  - The test runner always uses the outbox.
 *  - EMAIL_PROVIDER=outbox always uses the outbox.
 *  - Resend delivers only on the production deployment (where it is the default when
 *    EMAIL_PROVIDER is unset). Anywhere else the outbox is used even if a Resend key is
 *    present, unless EMAIL_PROVIDER=resend and EMAIL_DELIVERY_OUTSIDE_PRODUCTION=true.
 *  - Resend requested without an API key is "misconfigured": sends fail visibly.
 */
export function resolveEmailDelivery(input: EmailDeliveryInput): EmailDelivery {
  const from = input.from?.trim() || defaultEmailFrom();
  const replyTo = input.replyTo?.trim() || site.supportEmail;
  const outbox = (reason: string): EmailDelivery => ({ mode: "outbox", from, replyTo, reason });

  if (input.testRunner) return outbox("Test runner: emails are recorded in the outbox and not delivered");
  const requested = input.provider?.trim() || (input.production ? "resend" : "outbox");
  if (requested !== "resend") return outbox("EMAIL_PROVIDER is outbox: emails are recorded, not delivered");
  if (!input.production && !input.deliveryOutsideProduction) {
    return outbox("Not the production deployment: emails are recorded in the outbox, not delivered");
  }
  if (!input.hasApiKey) return { mode: "misconfigured", from, replyTo, reason: EMAIL_NOT_CONFIGURED };
  return { mode: "resend", from, replyTo, reason: null };
}

function currentDelivery(): EmailDelivery {
  const e = env();
  return resolveEmailDelivery({
    testRunner: isTestRunner(),
    production: isProductionEnvironment(),
    // Read raw: the parsed env defaults an unset EMAIL_PROVIDER to "outbox".
    provider: process.env.EMAIL_PROVIDER?.trim() || undefined,
    deliveryOutsideProduction: process.env.EMAIL_DELIVERY_OUTSIDE_PRODUCTION === "true",
    hasApiKey: Boolean(e.RESEND_API_KEY?.trim()),
    from: e.EMAIL_FROM,
    replyTo: e.EMAIL_REPLY_TO,
  });
}

/** The provider object for a delivery decision. Exported for tests. */
export function providerFor(delivery: EmailDelivery, apiKey: string | undefined): EmailProvider {
  if (delivery.mode === "outbox") return new OutboxEmailProvider();
  if (delivery.mode === "misconfigured" || !apiKey?.trim()) {
    return new UnconfiguredEmailProvider(delivery.reason ?? EMAIL_NOT_CONFIGURED);
  }
  return new ResendEmailProvider(apiKey.trim(), delivery.from, delivery.replyTo);
}

export function getEmailProvider(): EmailProvider {
  return providerFor(currentDelivery(), env().RESEND_API_KEY);
}

export interface EmailReadiness {
  mode: "outbox" | "resend" | "misconfigured";
  /** True when messages are actually delivered to inboxes. */
  delivering: boolean;
  /** Sender used when delivering (no secrets). */
  from: string | null;
  /** Reply-To used when delivering. */
  replyTo: string | null;
  reason: string | null;
}

/** Non-throwing summary of email delivery, for the staff status panel. Mirrors getEmailProvider exactly. */
export function getEmailReadiness(): EmailReadiness {
  try {
    const d = currentDelivery();
    return { mode: d.mode, delivering: d.mode === "resend", from: d.from, replyTo: d.replyTo, reason: d.reason };
  } catch (e) {
    return {
      mode: "misconfigured",
      delivering: false,
      from: null,
      replyTo: null,
      reason: e instanceof Error ? e.message : "Email configuration could not be read",
    };
  }
}
