import "server-only";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
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

/**
 * Outbox: records the email (the notifications table already stores the full
 * rendered message) and delivers nothing. Contains no network code. Used in
 * development, tests, and any environment without a verified sending domain.
 */
class OutboxEmailProvider implements EmailProvider {
  readonly name = "outbox" as const;
  async send(): Promise<{ id: string }> {
    return { id: `outbox_${randomUUID()}` };
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  private readonly client: Resend;
  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly replyTo?: string,
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
    if (error || !data) throw new Error(`Email send failed: ${error?.name ?? "unknown"}`);
    return { id: data.id };
  }
}

export function getEmailProvider(): EmailProvider {
  const e = env();
  if (isTestRunner() || e.EMAIL_PROVIDER !== "resend") return new OutboxEmailProvider();
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM) return new OutboxEmailProvider();
  return new ResendEmailProvider(e.RESEND_API_KEY, e.EMAIL_FROM, e.EMAIL_REPLY_TO);
}
