import "server-only";
import { absoluteUrl, site } from "@/config/site";
import { parseAttribution } from "@/lib/analytics/attribution";
import { readAttribution } from "@/lib/analytics/attribution-server";
import { trackServer } from "@/lib/analytics/server";
import { publicQuote } from "@/lib/compliance/public-quote";
import { findRule } from "@/lib/compliance/registry";
import { addDays, compareISODate, todayInTimeZone } from "@/lib/domain/dates";
import { getEmailProvider } from "@/lib/email/provider";
import { isReservedTestAddress } from "@/lib/email/recipients";
import { renderEmail } from "@/lib/email/render";
import type { PendingLookup } from "@/lib/lookup/pending";
import { createSignedToken, verifySignedToken } from "@/lib/security/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  confirmationEmail,
  nextReminderDueDate,
  plannedSubscriberReminders,
  REMINDER_CONSENT_TEXT,
  reminderEmail,
  type SubscriberCopyVars,
} from "./subscriber-plan";

/**
 * Voluntary reminder subscriptions (double opt-in). Only ever created from an address
 * the visitor typed and confirmed; never from public records. Unsubscribing adds the
 * address to reminder_suppressions, which only an explicit new opt-in that is
 * confirmed again lifts.
 */

const db = () => createAdminClient();
const TZ = "America/New_York";
const CONFIRM_TTL = 60 * 60 * 24 * 7;
const UNSUB_TTL = 60 * 60 * 24 * 400;
/** At most one confirmation email per address per 10 minutes. */
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

export interface SubscriberRow {
  id: string;
  email: string;
  state_code: string;
  entity_type: string;
  is_foreign: boolean;
  is_nonprofit: boolean;
  legal_name: string;
  entity_number: string | null;
  formation_date: string | null;
  status: "pending" | "confirmed" | "unsubscribed";
  consent_at: string;
  confirmation_sent_at: string | null;
  attribution: unknown;
}

export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) && e.length <= 254 ? e : null;
}

export const reminderUnsubscribeToken = (email: string) => createSignedToken("rem-unsub", { e: email }, UNSUB_TTL);
export function emailFromReminderUnsubToken(t: string | null | undefined): string | null {
  const p = verifySignedToken<{ e?: unknown }>("rem-unsub", t);
  return p && typeof p.e === "string" && p.e.includes("@") ? p.e : null;
}
/** Bound to the consent time, so an old link can't re-subscribe someone after they unsubscribed. */
const confirmToken = (row: Pick<SubscriberRow, "id" | "consent_at">) =>
  createSignedToken("rem-confirm", { s: row.id, c: new Date(row.consent_at).getTime() }, CONFIRM_TTL);
/** Reminder links: restores the business's lookup, nothing else. */
export const reminderLinkToken = (subscriberId: string) => createSignedToken("rem-link", { s: subscriberId }, UNSUB_TTL);
export function subscriberFromLinkToken(t: string | null | undefined): string | null {
  const p = verifySignedToken<{ s?: unknown }>("rem-link", t);
  return p && typeof p.s === "string" ? p.s : null;
}

/** Keep a copy of what was sent (best effort; never blocks the email). */
async function recordEmail(subscriberId: string, kind: "confirmation" | "reminder", subject: string, text: string, providerId: string | null) {
  await db()
    .from("subscriber_emails")
    .insert({ subscriber_id: subscriberId, kind, subject: subject.slice(0, 300), body_text: text.slice(0, 20000), provider_message_id: providerId })
    .then(
      () => undefined,
      () => undefined,
    );
}

async function copyVars(row: SubscriberRow, dueDate: string): Promise<SubscriberCopyVars | null> {
  const rule = findRule(row.state_code, row.entity_type as never, "annual_report", row.is_foreign);
  if (!rule) return null;
  const quote = await publicQuote(rule, { isNonprofit: row.is_nonprofit }).catch(() => null);
  return {
    businessName: row.legal_name,
    dueDate,
    stateFeeCents: rule.stateFeeCents,
    nonprofitFeeCents: rule.nonprofitStateFeeCents ?? null,
    serviceFeeCents: quote?.serviceFeeCents ?? null,
  };
}

function dueFor(row: SubscriberRow, today: string) {
  const rule = findRule(row.state_code, row.entity_type as never, "annual_report", row.is_foreign);
  return rule && rule.verificationStatus === "verified" ? nextReminderDueDate(rule, row.formation_date, today) : null;
}

export async function isReminderSuppressed(email: string): Promise<boolean> {
  const [{ data: rem }, { data: mkt }] = await Promise.all([
    db().from("reminder_suppressions").select("email").eq("email", email).maybeSingle(),
    // Hard bounces and complaints recorded for any Filewell email are honored here too.
    db().from("marketing_suppressions").select("reason").eq("email", email).in("reason", ["bounce", "complaint"]).maybeSingle(),
  ]);
  return Boolean(rem || mkt);
}

export type SubscribeResult = { status: "sent" | "already_confirmed" | "throttled" | "unsupported" | "error" };

/** Record a pending subscription for the visitor's looked-up business and email a confirmation link. */
export async function subscribeToReminders(rawEmail: string, lookup: PendingLookup, consent: boolean): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  if (!email || !consent) return { status: "error" };
  const rule = findRule(lookup.stateCode, lookup.entityType, "annual_report", lookup.isForeign);
  if (!rule || rule.verificationStatus !== "verified") return { status: "unsupported" };
  const today = todayInTimeZone(TZ);
  const due = nextReminderDueDate(rule, lookup.formationDate ?? null, today);
  if (!due) return { status: "unsupported" };

  const attribution = await readAttribution();
  const identity = { email, state_code: lookup.stateCode, entity_number: lookup.entityNumber ?? null, legal_name: lookup.legalName };
  let q = db().from("reminder_subscribers").select("*").eq("email", email).eq("state_code", identity.state_code);
  q = identity.entity_number ? q.eq("entity_number", identity.entity_number) : q.is("entity_number", null).ilike("legal_name", identity.legal_name);
  const { data: existing } = await q.maybeSingle();
  const row = existing as SubscriberRow | null;

  const suppressed = await isReminderSuppressed(email);
  if (row?.status === "confirmed" && !suppressed) return { status: "already_confirmed" };
  if (row?.confirmation_sent_at && Date.now() - new Date(row.confirmation_sent_at).getTime() < RESEND_COOLDOWN_MS) {
    return { status: "throttled" };
  }

  const fields = {
    entity_type: lookup.entityType,
    is_foreign: lookup.isForeign,
    is_nonprofit: lookup.isNonprofit,
    formation_date: lookup.formationDate ?? null,
    status: "pending" as const,
    consent_text: REMINDER_CONSENT_TEXT,
    consent_at: new Date().toISOString(),
    attribution: attribution ?? row?.attribution ?? null,
  };
  const saved = row
    ? await db().from("reminder_subscribers").update(fields).eq("id", row.id).select("*").single()
    : await db().from("reminder_subscribers").insert({ ...identity, ...fields }).select("*").single();
  if (saved.error || !saved.data) return { status: "error" };
  const sub = saved.data as SubscriberRow;

  const vars = await copyVars(sub, due.dueDate);
  if (!vars) return { status: "unsupported" };
  const copy = confirmationEmail(vars);
  const rendered = renderEmail({
    subject: copy.subject,
    body: copy.body,
    ctaLabel: copy.ctaLabel,
    ctaUrl: absoluteUrl(`/reminders/confirm?t=${encodeURIComponent(confirmToken(sub))}`),
    vars: {},
    // Lets someone who never asked for this block future confirmation emails too.
    unsubscribeUrl: absoluteUrl(`/reminders/unsubscribe?t=${encodeURIComponent(reminderUnsubscribeToken(email))}`),
  });
  try {
    const sent = isReservedTestAddress(email)
      ? { id: "reserved_address" }
      : await getEmailProvider().send({ to: email, ...rendered, idempotencyKey: `rem-confirm:${sub.id}:${sub.consent_at}` });
    await db().from("reminder_subscribers").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", sub.id);
    await recordEmail(sub.id, "confirmation", rendered.subject, rendered.text, sent.id);
  } catch {
    return { status: "error" };
  }
  await trackServer("reminder_opt_in", { stateCode: sub.state_code, entityType: sub.entity_type, attribution, properties: { resubscribe: suppressed } });
  return { status: "sent" };
}

/** Confirm a subscription from its emailed link. Lifts a previous unsubscribe (explicit re-subscribe). */
export async function confirmSubscription(token: string | null | undefined): Promise<"confirmed" | "invalid"> {
  const p = verifySignedToken<{ s?: unknown; c?: unknown }>("rem-confirm", token);
  if (!p || typeof p.s !== "string" || typeof p.c !== "number") return "invalid";
  const { data } = await db().from("reminder_subscribers").select("*").eq("id", p.s).maybeSingle();
  const row = data as SubscriberRow | null;
  if (!row || new Date(row.consent_at).getTime() !== p.c) return "invalid";
  if (row.status === "confirmed") return "confirmed";
  await db().from("reminder_suppressions").delete().eq("email", row.email).eq("reason", "unsubscribe");
  await db().from("reminder_subscribers").update({ status: "confirmed", confirmed_at: new Date().toISOString(), unsubscribed_at: null }).eq("id", row.id);
  await planSubscriber({ ...row, status: "confirmed" }, todayInTimeZone(TZ));
  await trackServer("reminder_confirmed", {
    stateCode: row.state_code,
    entityType: row.entity_type,
    attribution: parseAttribution(row.attribution ? JSON.stringify(row.attribution) : null),
  });
  return "confirmed";
}

/** One-click unsubscribe: every reminder subscription for the address, permanently. Idempotent. */
export async function unsubscribeReminders(token: string | null | undefined): Promise<"ok" | "invalid"> {
  const email = emailFromReminderUnsubToken(token);
  if (!email) return "invalid";
  await db().from("reminder_suppressions").upsert({ email, reason: "unsubscribe", source: "reminder link" }, { onConflict: "email", ignoreDuplicates: true });
  const { data: rows } = await db()
    .from("reminder_subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("email", email)
    .neq("status", "unsubscribed")
    .select("id, state_code, entity_type, attribution");
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length) {
    await db()
      .from("subscriber_reminders")
      .update({ status: "skipped", skip_reason: "unsubscribed", processed_at: new Date().toISOString() })
      .in("subscriber_id", ids)
      .eq("status", "scheduled");
  }
  for (const r of rows ?? []) {
    await trackServer("reminder_unsubscribed", {
      stateCode: r.state_code as string,
      entityType: r.entity_type as string,
      attribution: parseAttribution(r.attribution ? JSON.stringify(r.attribution) : null),
    });
  }
  return "ok";
}

async function planSubscriber(row: SubscriberRow, today: string): Promise<number> {
  const due = dueFor(row, today);
  if (!due) return 0;
  const rows = plannedSubscriberReminders(due.dueDate, today).map((r) => ({
    subscriber_id: row.id,
    due_date: due.dueDate,
    offset_days: r.offsetDays,
    scheduled_for: r.scheduledFor,
  }));
  if (!rows.length) return 0;
  const { count } = await db()
    .from("subscriber_reminders")
    .upsert(rows, { onConflict: "subscriber_id,due_date,offset_days", ignoreDuplicates: true, count: "exact" });
  return count ?? 0;
}

export interface SubscriberCycleSummary {
  planned: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Daily: plan the next reminders for confirmed subscribers, then send the ones due
 * today. Reminder emails carry a commercial offer, so they are only sent when the
 * sender's postal address is configured (CAN-SPAM); otherwise they are skipped.
 */
export async function runSubscriberReminderCycle(now = new Date()): Promise<SubscriberCycleSummary> {
  const summary: SubscriberCycleSummary = { planned: 0, sent: 0, skipped: 0, failed: 0 };
  const today = todayInTimeZone(TZ, now);
  const { data: subs } = await db().from("reminder_subscribers").select("*").eq("status", "confirmed").limit(5000);
  for (const s of (subs ?? []) as SubscriberRow[]) summary.planned += await planSubscriber(s, today);

  const { data: due } = await db()
    .from("subscriber_reminders")
    .select("id, subscriber_id, due_date, offset_days, scheduled_for")
    .eq("status", "scheduled")
    .lte("scheduled_for", today)
    .order("scheduled_for", { ascending: true })
    .limit(1000);

  for (const r of due ?? []) {
    const skip = async (reason: string) => {
      await db().from("subscriber_reminders").update({ status: "skipped", skip_reason: reason, processed_at: now.toISOString() }).eq("id", r.id).eq("status", "scheduled");
      summary.skipped++;
    };
    const { data } = await db().from("reminder_subscribers").select("*").eq("id", r.subscriber_id).maybeSingle();
    const sub = data as SubscriberRow | null;
    if (!sub || sub.status !== "confirmed") { await skip("not_confirmed"); continue; }
    if (await isReminderSuppressed(sub.email)) { await skip("suppressed"); continue; }
    if (compareISODate(r.scheduled_for as string, addDays(today, -2)) < 0) { await skip("stale"); continue; }
    if (!site.postalAddress) { await skip("no_postal_address"); continue; }
    if (isReservedTestAddress(sub.email)) { await skip("reserved_address"); continue; }
    const vars = await copyVars(sub, r.due_date as string);
    if (!vars) { await skip("no_rule"); continue; }

    const copy = reminderEmail(vars, r.offset_days as number);
    const unsubToken = reminderUnsubscribeToken(sub.email);
    const unsubscribeUrl = absoluteUrl(`/reminders/unsubscribe?t=${encodeURIComponent(unsubToken)}`);
    const rendered = renderEmail({
      subject: copy.subject,
      body: copy.body,
      ctaLabel: copy.ctaLabel,
      ctaUrl: absoluteUrl(`/rs/${encodeURIComponent(reminderLinkToken(sub.id))}`),
      vars: {},
      unsubscribeUrl,
    });
    try {
      const sent = await getEmailProvider().send({
        to: sub.email,
        ...rendered,
        idempotencyKey: `rem-sub:${r.id}`,
        headers: {
          "List-Unsubscribe": `<${absoluteUrl(`/api/reminders/unsubscribe?t=${encodeURIComponent(unsubToken)}`)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      await db().from("subscriber_reminders").update({ status: "sent", provider_message_id: sent.id, processed_at: now.toISOString() }).eq("id", r.id);
      await recordEmail(sub.id, "reminder", rendered.subject, rendered.text, sent.id);
      await trackServer("reminder_sent", {
        stateCode: sub.state_code,
        entityType: sub.entity_type,
        attribution: parseAttribution(sub.attribution ? JSON.stringify(sub.attribution) : null),
        properties: { offset_days: r.offset_days },
        dedupeKey: `reminder_sent:${r.id}`,
      });
      summary.sent++;
    } catch {
      await db().from("subscriber_reminders").update({ status: "failed", processed_at: now.toISOString() }).eq("id", r.id);
      summary.failed++;
    }
  }
  return summary;
}

/** The subscriber behind a reminder link, as a lookup to restore (or null). */
export async function lookupForReminderLink(token: string | null | undefined): Promise<SubscriberRow | null> {
  const id = subscriberFromLinkToken(token);
  if (!id) return null;
  const { data } = await db().from("reminder_subscribers").select("*").eq("id", id).eq("status", "confirmed").maybeSingle();
  return (data as SubscriberRow | null) ?? null;
}
