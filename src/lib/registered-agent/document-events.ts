import "server-only";
import { audit } from "@/lib/audit";
import type { StaffUser } from "@/lib/auth/session";
import { sendNotification } from "@/lib/notifications/send";
import { notifyStaff } from "@/lib/notifications/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRaJurisdiction } from "./jurisdictions";
import type { RaiDocumentEvent } from "./rai-webhook";

/**
 * Partner new-document alerts. Each alert is recorded once (by the partner's document ID),
 * matched to a subscription by the partner's company ID, and announced: staff are told to
 * pull the document from the partner portal and upload it, and a matched customer hears
 * that a document arrived. The upload itself sends the usual "document ready" email.
 */

export const RAI_PROVIDER = "registered_agents_inc";

/** Open alerts older than this get one reminder to staff. */
export const OPEN_ALERT_REMINDER_HOURS = 4;

export type AlertOutcome = "recorded" | "duplicate";

export class DocumentEventError extends Error {}

interface MatchedSub {
  id: string;
  user_id: string;
  business_id: string;
  state_code: string;
  service_status: string;
}

async function companyLabel(businessId: string | null, fallback: string | null): Promise<string> {
  if (businessId) {
    const { data } = await createAdminClient().from("businesses").select("legal_name").eq("id", businessId).maybeSingle();
    if (data?.legal_name) return data.legal_name as string;
  }
  return fallback ?? "an unknown company";
}

/** Record and announce one verified alert. Safe to call again with the same alert. */
export async function recordProviderDocumentAlert(event: RaiDocumentEvent): Promise<AlertOutcome> {
  const db = createAdminClient();

  let matches: MatchedSub[] = [];
  if (event.companyId) {
    const { data, error } = await db
      .from("ra_subscriptions")
      .select("id, user_id, business_id, state_code, service_status")
      .eq("provider", RAI_PROVIDER)
      .eq("provider_account_ref", event.companyId)
      .limit(2);
    if (error) throw new DocumentEventError(`subscription lookup failed: ${error.message}`);
    matches = (data ?? []) as MatchedSub[];
  }
  const sub = matches.length === 1 ? matches[0] : null;
  const matchStatus = sub ? "matched" : matches.length > 1 ? "ambiguous" : "unmatched";

  const { data: inserted, error } = await db
    .from("provider_document_events")
    .upsert(
      {
        provider: RAI_PROVIDER,
        provider_document_id: event.documentId,
        provider_company_id: event.companyId,
        provider_company_name: event.companyName,
        match_status: matchStatus,
        ra_subscription_id: sub?.id ?? null,
        user_id: sub?.user_id ?? null,
        business_id: sub?.business_id ?? null,
      },
      { onConflict: "provider,provider_document_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new DocumentEventError(`alert record failed: ${error.message}`);
  const row = (inserted ?? [])[0] as { id: string } | undefined;
  if (!row) return "duplicate";

  await audit({
    actorUserId: null,
    actorType: "webhook",
    action: "provider_document_event.received",
    entityType: "provider_document_event",
    entityId: row.id,
    after: { provider_document_id: event.documentId, provider_company_id: event.companyId, match_status: matchStatus },
  });

  const company = await companyLabel(sub?.business_id ?? null, event.companyName);
  const stateName = sub ? (getRaJurisdiction(sub.state_code)?.name ?? sub.state_code) : "unknown state";
  const why =
    matchStatus === "matched"
      ? "Download it from the partner portal and upload it on the subscription page; the upload emails the customer the document."
      : matchStatus === "ambiguous"
        ? "More than one subscription has this partner company ID. Fix the company IDs, then upload the document on the right subscription."
        : "No subscription has this partner company ID yet. Find the customer, save the company ID on their subscription (that links this alert), then upload the document.";

  await notifyStaff({
    templateKey: "staff_ra_partner_document",
    vars: {
      company_name: company,
      state_name: stateName,
      provider_document_id: event.documentId,
      provider_company_id: event.companyId ?? "(none sent)",
      message: why,
    },
    dedupeKey: `ra_partner_document:${row.id}`,
    ctaPath: sub ? `/admin/registered-agent/${sub.id}` : "/admin/registered-agent",
    businessId: sub?.business_id ?? null,
  });

  if (sub && sub.service_status !== "ended") {
    try {
      const res = await sendNotification({
        userId: sub.user_id,
        templateKey: "ra_document_arriving",
        dedupeKey: `ra_document_arriving:${row.id}`,
        vars: { company_name: company, state_name: stateName },
        ctaPath: `/dashboard/services/${sub.id}`,
        businessId: sub.business_id,
      });
      if (res.status === "sent") {
        await db.from("provider_document_events").update({ customer_notified_at: new Date().toISOString() }).eq("id", row.id);
      }
    } catch (e) {
      // The alert is recorded and staff know; the customer still gets the upload email.
      console.error("[ra alerts] customer notice failed", row.id, e instanceof Error ? e.message : e);
    }
  }
  return "recorded";
}

/**
 * Staff saved the partner's company ID on a subscription: store it, and link any alerts
 * that arrived for that company before it was known (they were unmatched).
 */
export async function recordProviderCompanyId(staff: StaffUser, subId: string, companyId: string): Promise<number> {
  const clean = companyId.trim();
  if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(clean)) throw new DocumentEventError("Enter the company ID exactly as the partner portal shows it.");
  const db = createAdminClient();
  const { data: sub } = await db.from("ra_subscriptions").select("id, user_id, business_id, provider").eq("id", subId).maybeSingle();
  if (!sub) throw new DocumentEventError("Subscription not found.");
  if (sub.provider !== RAI_PROVIDER) throw new DocumentEventError("This subscription isn't with Registered Agents Inc.");
  const { error } = await db.from("ra_subscriptions").update({ provider_account_ref: clean }).eq("id", subId);
  if (error) {
    if (error.code === "23505") throw new DocumentEventError("Another subscription already has this company ID.");
    throw new DocumentEventError(error.message);
  }
  const { data: linked } = await db
    .from("provider_document_events")
    .update({ match_status: "matched", ra_subscription_id: sub.id, user_id: sub.user_id, business_id: sub.business_id })
    .eq("provider", RAI_PROVIDER)
    .eq("provider_company_id", clean)
    .in("match_status", ["unmatched", "ambiguous"])
    .is("handled_at", null)
    .select("id");
  await audit({
    actorUserId: staff.id,
    actorType: "staff",
    action: "ra_subscription.provider_company_id",
    entityType: "ra_subscription",
    entityId: subId,
    after: { provider_account_ref: clean, linked_alerts: (linked ?? []).length },
  });
  return (linked ?? []).length;
}

/** After an upload on a subscription, close its oldest open partner alert with that document. */
export async function linkUploadToOpenAlert(staffId: string, subId: string, documentId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: open } = await db
    .from("provider_document_events")
    .select("id")
    .eq("ra_subscription_id", subId)
    .is("handled_at", null)
    .order("received_at", { ascending: true })
    .limit(1);
  const alert = (open ?? [])[0] as { id: string } | undefined;
  if (!alert) return null;
  await db
    .from("provider_document_events")
    .update({ service_document_id: documentId, handled_at: new Date().toISOString(), handled_by: staffId })
    .eq("id", alert.id)
    .is("handled_at", null);
  return alert.id;
}

/** Close an alert without an upload (a duplicate, or handled another way), with a note. */
export async function closeProviderDocumentAlert(staff: StaffUser, alertId: string, note: string): Promise<void> {
  const clean = note.trim();
  if (clean.length < 3) throw new DocumentEventError("Note why this alert needs no upload.");
  const { data, error } = await createAdminClient()
    .from("provider_document_events")
    .update({ handled_at: new Date().toISOString(), handled_by: staff.id, handled_note: clean.slice(0, 500) })
    .eq("id", alertId)
    .is("handled_at", null)
    .select("id");
  if (error) throw new DocumentEventError(error.message);
  if (!(data ?? []).length) throw new DocumentEventError("This alert is already closed.");
  await audit({ actorUserId: staff.id, actorType: "staff", action: "provider_document_event.closed", entityType: "provider_document_event", entityId: alertId, metadata: { note: clean.slice(0, 500) } });
}

/** One reminder to staff for each alert still open after OPEN_ALERT_REMINDER_HOURS. */
export async function remindOpenAlerts(now: Date = new Date()): Promise<number> {
  const db = createAdminClient();
  const cutoff = new Date(now.getTime() - OPEN_ALERT_REMINDER_HOURS * 3_600_000).toISOString();
  const { data } = await db
    .from("provider_document_events")
    .select("id, provider_document_id, provider_company_id, provider_company_name, ra_subscription_id, business_id")
    .is("handled_at", null)
    .is("reminder_sent_at", null)
    .lte("received_at", cutoff);
  let sent = 0;
  for (const a of (data ?? []) as {
    id: string;
    provider_document_id: string;
    provider_company_id: string | null;
    provider_company_name: string | null;
    ra_subscription_id: string | null;
    business_id: string | null;
  }[]) {
    await notifyStaff({
      templateKey: "staff_ra_partner_document",
      vars: {
        company_name: await companyLabel(a.business_id, a.provider_company_name),
        state_name: "the partner portal",
        provider_document_id: a.provider_document_id,
        provider_company_id: a.provider_company_id ?? "(none sent)",
        message: `Reminder: this alert is still open after ${OPEN_ALERT_REMINDER_HOURS} hours. Upload the document, or close the alert with a note if no upload is needed.`,
      },
      dedupeKey: `ra_partner_document_reminder:${a.id}`,
      ctaPath: a.ra_subscription_id ? `/admin/registered-agent/${a.ra_subscription_id}` : "/admin/registered-agent",
      businessId: a.business_id,
    });
    await db.from("provider_document_events").update({ reminder_sent_at: now.toISOString() }).eq("id", a.id);
    sent += 1;
  }
  return sent;
}
