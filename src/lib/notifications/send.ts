import "server-only";
import { absoluteUrl } from "@/config/site";
import { getEmailProvider } from "@/lib/email/provider";
import { isReservedTestAddress, RESERVED_ADDRESS_REASON } from "@/lib/email/recipients";
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
  /** When set, the email is recorded as "suppressed" with this reason and not delivered. */
  suppressReason?: string | null;
}

export type SendResult =
  | { status: "sent" | "failed" | "suppressed"; notificationId: string }
  | { status: "duplicate"; notificationId: string | null };

/**
 * Render, record and deliver one notification. At-most-once per dedupeKey: the
 * row is claimed (inserted) before anything is sent. A row whose earlier attempt
 * ended "failed" is re-claimed and retried (the provider idempotency key is the
 * same dedupeKey, so a retry never delivers twice).
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
  let notificationId: string;
  if (claimError) {
    if (claimError.code !== "23505") throw new Error(`Notification claim failed: ${claimError.message}`);
    const { data: existing } = await db
      .from("notifications")
      .select("id, status")
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle();
    if (existing?.status !== "failed") return { status: "duplicate", notificationId: existing?.id ?? null };
    // Conditional re-claim: only one concurrent retry wins.
    const { data: reclaimed } = await db
      .from("notifications")
      .update({ status: "queued", error: null })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (!reclaimed) return { status: "duplicate", notificationId: existing.id as string };
    notificationId = reclaimed.id as string;
  } else {
    notificationId = claimed.id as string;
  }

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

  // Never hand a provider an address that cannot receive mail, or a message the caller suppressed.
  const suppression = !to
    ? "no email address"
    : isReservedTestAddress(to)
      ? RESERVED_ADDRESS_REASON
      : (input.suppressReason ?? null);
  if (!to || suppression) {
    await db
      .from("notifications")
      .update({ ...toColumns(rendered, to), status: "suppressed", error: suppression })
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
        ...toColumns(rendered, to),
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
        ...toColumns(rendered, to),
        status: "failed",
        provider: provider.name,
        error: e instanceof Error ? e.message.slice(0, 500) : "send failed",
      })
      .eq("id", notificationId);
    return { status: "failed", notificationId };
  }
}

function toColumns(r: { subject: string; text: string; html: string }, to: string | null | undefined) {
  // The address is rewritten too: a retried row may predate an email change.
  return { to_address: to ?? "", subject: r.subject, body_text: r.text, body_html: r.html };
}
