import "server-only";
import { absoluteUrl } from "@/config/site";
import { getEmailProvider } from "@/lib/email/provider";
import { renderEmail } from "@/lib/email/render";
import { getDefaultTemplate } from "@/lib/email/templates";
import { createSignedToken } from "@/lib/security/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SendNotificationInput {
  userId: string;
  templateKey: string;
  /** Unique per logical message; a second send with the same key is a no-op. */
  dedupeKey: string;
  vars: Record<string, string | number | null | undefined>;
  /** Internal path the CTA should land on, e.g. /dashboard/filings/<id>. */
  ctaPath?: string | null;
  businessId?: string | null;
  filingId?: string | null;
}

export type SendResult =
  | { status: "sent" | "failed" | "suppressed"; notificationId: string }
  | { status: "duplicate"; notificationId: string | null };

/**
 * Render, record and deliver one notification. At-most-once per dedupeKey: the
 * row is claimed (inserted) before anything is sent.
 */
export async function sendNotification(input: SendNotificationInput): Promise<SendResult> {
  const db = createAdminClient();

  const { data: profile } = await db
    .from("profiles")
    .select("email")
    .eq("id", input.userId)
    .maybeSingle();
  const to = profile?.email;

  const { data: dbTemplate } = await db
    .from("notification_templates")
    .select("subject, body_text, cta_label, category, active")
    .eq("key", input.templateKey)
    .maybeSingle();
  const fallback = getDefaultTemplate(input.templateKey);
  const template = dbTemplate?.active
    ? {
        subject: dbTemplate.subject as string,
        body: dbTemplate.body_text as string,
        ctaLabel: dbTemplate.cta_label as string | null,
        category: dbTemplate.category as string,
      }
    : fallback
      ? { subject: fallback.subject, body: fallback.body, ctaLabel: fallback.ctaLabel, category: fallback.category }
      : null;
  if (!template) throw new Error(`Unknown notification template: ${input.templateKey}`);

  // Claim the dedupe key first.
  const { data: claimed, error: claimError } = await db
    .from("notifications")
    .insert({
      user_id: input.userId,
      business_id: input.businessId ?? null,
      filing_id: input.filingId ?? null,
      template_key: input.templateKey,
      channel: "email",
      to_address: to ?? "",
      subject: "(pending)",
      body_text: "",
      body_html: "",
      status: "queued",
      dedupe_key: input.dedupeKey,
    })
    .select("id")
    .single();
  if (claimError) {
    if (claimError.code === "23505") {
      const { data: existing } = await db
        .from("notifications")
        .select("id")
        .eq("dedupe_key", input.dedupeKey)
        .maybeSingle();
      return { status: "duplicate", notificationId: existing?.id ?? null };
    }
    throw new Error(`Notification claim failed: ${claimError.message}`);
  }
  const notificationId = claimed.id as string;

  const ctaUrl = input.ctaPath
    ? absoluteUrl(`/r/${notificationId}?to=${encodeURIComponent(input.ctaPath)}`)
    : null;
  const unsubscribeToken =
    template.category === "reminder"
      ? encodeURIComponent(createSignedToken("unsubscribe", { uid: input.userId }, 60 * 60 * 24 * 365))
      : null;
  // Link in the email body opens a confirmation page; the List-Unsubscribe header
  // points at the RFC 8058 one-click POST endpoint.
  const unsubscribeUrl = unsubscribeToken ? absoluteUrl(`/unsubscribe?token=${unsubscribeToken}`) : null;
  const oneClickUrl = unsubscribeToken ? absoluteUrl(`/api/unsubscribe?token=${unsubscribeToken}`) : null;

  const rendered = renderEmail({
    subject: template.subject,
    body: template.body,
    ctaLabel: template.ctaLabel,
    ctaUrl,
    vars: input.vars,
    unsubscribeUrl,
    footerNote:
      template.category === "reminder"
        ? "You're receiving this because you track this business's filings with us."
        : null,
  });

  if (!to) {
    await db
      .from("notifications")
      .update({ ...toColumns(rendered), status: "suppressed", error: "no email address" })
      .eq("id", notificationId);
    return { status: "suppressed", notificationId };
  }

  const provider = getEmailProvider();
  try {
    const { id } = await provider.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: input.dedupeKey,
      headers: oneClickUrl
        ? { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
    });
    await db
      .from("notifications")
      .update({
        ...toColumns(rendered),
        status: "sent",
        provider: provider.name,
        provider_message_id: id,
        sent_at: new Date().toISOString(),
      })
      .eq("id", notificationId);
    return { status: "sent", notificationId };
  } catch (e) {
    await db
      .from("notifications")
      .update({
        ...toColumns(rendered),
        status: "failed",
        provider: provider.name,
        error: e instanceof Error ? e.message.slice(0, 500) : "send failed",
      })
      .eq("id", notificationId);
    return { status: "failed", notificationId };
  }
}

function toColumns(r: { subject: string; text: string; html: string }) {
  return { subject: r.subject, body_text: r.text, body_html: r.html };
}
