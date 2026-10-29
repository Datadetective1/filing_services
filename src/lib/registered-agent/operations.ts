import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import type { StaffUser } from "@/lib/auth/session";
import { DOCUMENT_BUCKET, DocumentValidationError, MAX_DOCUMENT_BYTES, SIGNED_URL_TTL_SECONDS, sanitizeFileName, sniffMime } from "@/lib/documents/storage";
import { formatCents } from "@/lib/domain/money";
import { sendNotification } from "@/lib/notifications/send";
import { notifyStaff } from "@/lib/notifications/staff";
import { SERVICES } from "@/lib/services/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  escalationLevel,
  mailItemBillable,
  SERVICE_DOCUMENT_KIND_LABELS,
  urgencyFor,
  type ServiceDocumentKind,
  SERVICE_DOCUMENT_KINDS,
} from "./documents";
import { getRaJurisdiction } from "./jurisdictions";
import {
  providerCancellationDue,
  renewalReminderDue,
  transitionProblem,
  type BillingStatus,
  type ProviderOrderKind,
  type ProviderOrderStatus,
} from "./status";

/**
 * Operator actions for registered agent service, and the scheduled checks behind it.
 * Every action re-checks the rule in code, the database enforces it again (transition
 * function, check constraints), and each one is audited.
 */

export class OperationError extends Error {}

async function subscriptionNames(subId: string) {
  const db = createAdminClient();
  const { data: sub } = await db
    .from("ra_subscriptions")
    .select("id, user_id, business_id, state_code, plan, current_period_end, renewal_price_cents")
    .eq("id", subId)
    .maybeSingle();
  if (!sub) return null;
  const { data: business } = await db.from("businesses").select("legal_name").eq("id", sub.business_id).maybeSingle();
  return {
    sub,
    vars: {
      company_name: (business?.legal_name as string | undefined) ?? "your business",
      state_name: getRaJurisdiction(sub.state_code)?.name ?? sub.state_code,
      service_name: SERVICES[sub.plan as "registered_agent" | "ra_annual_report_bundle"].name.toLowerCase(),
    },
  };
}

async function formationNames(businessId: string, stateCode: string) {
  const { data: business } = await createAdminClient().from("businesses").select("legal_name").eq("id", businessId).maybeSingle();
  return {
    vars: {
      company_name: (business?.legal_name as string | undefined) ?? "your business",
      state_name: getRaJurisdiction(stateCode)?.name ?? stateCode,
      service_name: "formation",
    },
  };
}

export interface TransitionInput {
  providerOrderId: string;
  to: ProviderOrderStatus;
  expectedFrom: ProviderOrderStatus;
  providerReference?: string | null;
  confirmedOn?: string | null;
  evidence?: string | null;
  note?: string | null;
  /** Shown to the customer on their order history. */
  customerVisible: boolean;
  governmentFeeRemittedCents?: number | null;
}

/** Move one provider order, and keep the subscription's service status in step. */
export async function transitionProviderOrder(staff: StaffUser, input: TransitionInput): Promise<void> {
  const db = createAdminClient();
  const { data: po } = await db
    .from("provider_orders")
    .select("id, kind, status, user_id, business_id, ra_subscription_id, provider_reference, state_code")
    .eq("id", input.providerOrderId)
    .maybeSingle();
  if (!po) throw new OperationError("Order not found.");
  if (po.status !== input.expectedFrom) throw new OperationError("This order changed while you were looking at it. Reload and try again.");
  const evidence = {
    providerReference: input.providerReference?.trim() || po.provider_reference,
    confirmedOn: input.confirmedOn?.trim() || null,
    evidence: input.evidence?.trim() || null,
  };
  if (input.confirmedOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.confirmedOn)) throw new OperationError("Enter the confirmation date as YYYY-MM-DD.");
  if (input.confirmedOn && input.confirmedOn > new Date().toISOString().slice(0, 10)) throw new OperationError("The confirmation date can't be in the future.");
  const problem = transitionProblem(po.kind as ProviderOrderKind, po.status as ProviderOrderStatus, input.to, evidence);
  if (problem) throw new OperationError(problem);
  if (input.to === "information_needed" && !input.note?.trim()) throw new OperationError("Say what you need from the customer.");

  const patch: Record<string, unknown> = {};
  if (input.providerReference?.trim()) patch.provider_reference = input.providerReference.trim().slice(0, 100);
  if (evidence.confirmedOn) patch.confirmed_on = evidence.confirmedOn;
  if (evidence.evidence) patch.evidence = evidence.evidence.slice(0, 2000);
  if (typeof input.governmentFeeRemittedCents === "number" && input.governmentFeeRemittedCents >= 0) {
    patch.government_fee_remitted_cents = Math.round(input.governmentFeeRemittedCents);
  }
  const { error } = await db.rpc("transition_provider_order", {
    p_id: po.id,
    p_to_status: input.to,
    p_actor_user_id: staff.id,
    p_actor_type: "staff",
    p_note: input.note?.trim().slice(0, 2000) || null,
    p_customer_visible: input.customerVisible,
    p_patch: patch,
    p_expected_from: input.expectedFrom,
  });
  if (error) throw new OperationError(error.message);

  // Government fee actually paid to the state: keep the economics row in step.
  if (typeof patch.government_fee_remitted_cents === "number") {
    const { data: o } = await db.from("provider_orders").select("order_id").eq("id", po.id).maybeSingle();
    const code = po.kind === "change_of_agent" ? "change_registered_agent" : po.kind === "formation" ? "formation" : null;
    if (o && code) {
      await db.from("order_economics").update({ government_fees_remitted_cents: patch.government_fee_remitted_cents }).eq("order_id", o.order_id).eq("service_code", code);
    }
  }

  // An approved formation makes the business an existing one, dated as the state approved it.
  if (po.kind === "formation" && input.to === "completed") {
    const { error: bizError } = await db
      .from("businesses")
      .update({ lifecycle: "existing", formation_date: evidence.confirmedOn })
      .eq("id", po.business_id)
      .eq("lifecycle", "forming");
    if (bizError) throw new OperationError(bizError.message);
  }

  const { data: orderRow } = await db.from("provider_orders").select("order_id").eq("id", po.id).maybeSingle();
  const named = po.ra_subscription_id ? await subscriptionNames(po.ra_subscription_id) : await formationNames(po.business_id, po.state_code);
  if (!named) return;
  // Formation without registered agent service has no service page: its order page instead.
  const ctaPath = po.ra_subscription_id ? `/dashboard/services/${po.ra_subscription_id}` : `/dashboard/services/formation/${orderRow?.order_id ?? ""}`;

  if (po.kind === "registered_agent") {
    const serviceStatus =
      input.to === "active"
        ? "active"
        : input.to === "cancellation_requested"
          ? "cancellation_requested"
          : input.to === "provider_termination_pending"
            ? "termination_pending"
            : input.to === "terminated" || input.to === "refunded"
              ? "ended"
              : null;
    if (serviceStatus) {
      const { error: subError } = await db
        .from("ra_subscriptions")
        .update({
          service_status: serviceStatus,
          ...(input.to === "active" ? { appointment_confirmed_at: new Date(`${evidence.confirmedOn}T12:00:00Z`).toISOString(), appointment_evidence: evidence.evidence } : {}),
          ...(input.to === "terminated" ? { service_end_date: evidence.confirmedOn } : {}),
        })
        .eq("id", po.ra_subscription_id);
      if (subError) throw new OperationError(subError.message);
    }
    if (input.to === "active") {
      await sendNotification({ userId: po.user_id, templateKey: "service_active", dedupeKey: `service_active:${po.id}`, vars: named.vars, ctaPath, businessId: po.business_id });
    }
  }
  if (input.to === "completed") {
    await sendNotification({
      userId: po.user_id,
      templateKey: "service_filing_completed",
      dedupeKey: `service_filing_completed:${po.id}`,
      vars: { ...named.vars, service_name: po.kind === "change_of_agent" ? "change of registered agent" : "formation" },
      ctaPath,
      businessId: po.business_id,
    });
  }
  if (input.to === "information_needed") {
    await sendNotification({
      userId: po.user_id,
      templateKey: "service_information_requested",
      dedupeKey: `service_information_requested:${po.id}:${Date.now()}`,
      vars: { ...named.vars, message: input.note!.trim() },
      ctaPath,
      businessId: po.business_id,
    });
  }
}

/** The customer's replacement agent, recorded before the provider is asked to end service. */
export async function recordReplacementAgent(staff: StaffUser, subId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 200) throw new OperationError("Enter the new agent's name as the state lists it.");
  const db = createAdminClient();
  const { error } = await db.from("ra_subscriptions").update({ replacement_agent_name: clean, replacement_confirmed_at: new Date().toISOString() }).eq("id", subId);
  if (error) throw new OperationError(error.message);
  await audit({ actorUserId: staff.id, actorType: "staff", action: "ra_subscription.replacement_recorded", entityType: "ra_subscription", entityId: subId, after: { replacement_agent_name: clean } });
}

/** The provider's yearly renewal date for this entity (from the partner dashboard). */
export async function recordProviderRenewalDate(staff: StaffUser, subId: string, date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new OperationError("Enter the date as YYYY-MM-DD.");
  const { error } = await createAdminClient().from("ra_subscriptions").update({ provider_renewal_date: date }).eq("id", subId);
  if (error) throw new OperationError(error.message);
  await audit({ actorUserId: staff.id, actorType: "staff", action: "ra_subscription.provider_renewal_date", entityType: "ra_subscription", entityId: subId, after: { provider_renewal_date: date } });
}

/** An operator cancelled this entity in the provider's dashboard (unpaid or ended customer). */
export async function recordProviderCancelled(staff: StaffUser, subId: string, note: string): Promise<void> {
  if (note.trim().length < 3) throw new OperationError("Note what you did (for example the date and the dashboard confirmation).");
  const db = createAdminClient();
  const { data: sub } = await db.from("ra_subscriptions").select("billing_status").eq("id", subId).maybeSingle();
  if (!sub) throw new OperationError("Subscription not found.");
  if (sub.billing_status === "active") throw new OperationError("This customer is paid up. Don't cancel a paying customer with the provider.");
  const { error } = await db.from("ra_subscriptions").update({ provider_cancelled_at: new Date().toISOString() }).eq("id", subId);
  if (error) throw new OperationError(error.message);
  await audit({ actorUserId: staff.id, actorType: "staff", action: "ra_subscription.provider_cancelled", entityType: "ra_subscription", entityId: subId, metadata: { note: note.trim().slice(0, 500) } });
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export function isServiceDocumentKind(v: unknown): v is ServiceDocumentKind {
  return typeof v === "string" && (SERVICE_DOCUMENT_KINDS as readonly string[]).includes(v);
}

/**
 * Store a document the provider received for a customer's business, then notify the
 * customer. Service of process and government notices are flagged for escalation until the
 * customer has been reached.
 */
export async function uploadServiceDocument(
  staff: StaffUser,
  input: { subscriptionId: string; kind: ServiceDocumentKind; file: File; summary: string | null; providerReceivedAt: string | null },
): Promise<{ id: string; notified: boolean }> {
  const db = createAdminClient();
  const { data: sub } = await db.from("ra_subscriptions").select("id, user_id, business_id, current_period_start").eq("id", input.subscriptionId).maybeSingle();
  if (!sub) throw new OperationError("Subscription not found.");
  if (!(input.file instanceof File) || input.file.size === 0) throw new DocumentValidationError("Choose a file to upload");
  if (input.file.size > MAX_DOCUMENT_BYTES) throw new DocumentValidationError("Files must be 4 MB or smaller");
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) throw new DocumentValidationError("Only PDF, PNG and JPEG files are accepted");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fileName = sanitizeFileName(input.file.name);
  const storagePath = `${sub.user_id}/ra/${sub.id}/${randomUUID()}-${fileName}`;
  const { error: uploadError } = await db.storage.from(DOCUMENT_BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (uploadError) throw new OperationError(`Upload failed: ${uploadError.message}`);

  // Regular mail beyond the included items each service year is billable.
  let billable = false;
  if (input.kind === "regular_mail") {
    const since = sub.current_period_start ?? new Date(Date.now() - 365 * 86_400_000).toISOString();
    const { count } = await db
      .from("service_documents")
      .select("id", { count: "exact", head: true })
      .eq("ra_subscription_id", sub.id)
      .eq("kind", "regular_mail")
      .gte("available_to_filewell_at", since);
    billable = mailItemBillable("regular_mail", (count ?? 0) + 1);
  }
  const urgency = urgencyFor(input.kind);
  const { data: doc, error } = await db
    .from("service_documents")
    .insert({
      user_id: sub.user_id,
      business_id: sub.business_id,
      ra_subscription_id: sub.id,
      kind: input.kind,
      urgency,
      summary: input.summary?.trim().slice(0, 1000) || null,
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mime,
      size_bytes: bytes.length,
      sha256,
      provider_received_at: input.providerReceivedAt || null,
      operator_processed_at: new Date().toISOString(),
      escalation_status: urgency === "normal" ? "none" : "pending",
      billable_mail: billable,
      uploaded_by: staff.id,
    })
    .select("id")
    .single();
  if (error || !doc) {
    await db.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw new OperationError(`Document record failed: ${error?.message}`);
  }
  await audit({ actorUserId: staff.id, actorType: "staff", action: "service_document.uploaded", entityType: "service_document", entityId: doc.id, after: { kind: input.kind, urgency, billable_mail: billable } });
  const notified = await notifyCustomerOfDocument(doc.id, staff.id);
  return { id: doc.id, notified };
}

/** Email the customer about a document and record the attempt. */
export async function notifyCustomerOfDocument(documentId: string, actorId: string | null): Promise<boolean> {
  const db = createAdminClient();
  const { data: doc } = await db
    .from("service_documents")
    .select("id, user_id, business_id, ra_subscription_id, kind, customer_notified_at")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || !doc.ra_subscription_id) return false;
  const named = await subscriptionNames(doc.ra_subscription_id);
  if (!named) return false;
  const kind = doc.kind as ServiceDocumentKind;
  const result = await sendNotification({
    userId: doc.user_id,
    templateKey: kind === "service_of_process" ? "ra_document_urgent" : "ra_document_received",
    dedupeKey: `ra_document:${doc.id}`,
    vars: { ...named.vars, document_label: SERVICE_DOCUMENT_KIND_LABELS[kind].toLowerCase() },
    ctaPath: `/dashboard/services/${doc.ra_subscription_id}`,
    businessId: doc.business_id,
  });
  const sent = result.status === "sent" || result.status === "duplicate";
  await db.from("document_notification_attempts").insert({
    document_id: doc.id,
    channel: "email",
    status: result.status === "sent" ? "sent" : result.status === "duplicate" ? "sent" : "failed",
    notification_id: result.notificationId,
    attempted_by: actorId,
    note: result.status === "suppressed" ? "suppressed by the email system" : null,
  });
  if (result.status === "sent" && !doc.customer_notified_at) {
    await db.from("service_documents").update({ customer_notified_at: new Date().toISOString(), escalation_status: "resolved" }).eq("id", doc.id).is("customer_notified_at", null);
  }
  return sent && result.status === "sent";
}

/** A phone call or text an operator made (urgent documents), or a customer's acknowledgement. */
export async function recordNotificationAttempt(
  staff: StaffUser,
  input: { documentId: string; channel: "phone" | "sms" | "email"; status: "sent" | "delivered" | "failed" | "acknowledged"; note: string | null },
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("document_notification_attempts").insert({
    document_id: input.documentId,
    channel: input.channel,
    status: input.status,
    attempted_by: staff.id,
    note: input.note?.trim().slice(0, 1000) || null,
  });
  if (error) throw new OperationError(error.message);
  if (input.status === "delivered" || input.status === "acknowledged") {
    await db
      .from("service_documents")
      .update({ customer_notified_at: new Date().toISOString(), escalation_status: "resolved" })
      .eq("id", input.documentId)
      .is("customer_notified_at", null);
  }
  await audit({ actorUserId: staff.id, actorType: "staff", action: "service_document.notification_attempt", entityType: "service_document", entityId: input.documentId, after: { channel: input.channel, status: input.status } });
}

/** Customer download: row-level security decides whether this user may read the row. */
export async function signedUrlForServiceDocument(documentId: string): Promise<{ url: string; fileName: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return null;
  const userDb = await createClient();
  const { data: doc } = await userDb.from("service_documents").select("id, storage_bucket, storage_path, file_name").eq("id", documentId).maybeSingle();
  if (!doc) return null;
  const { data, error } = await createAdminClient().storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, { download: doc.file_name });
  if (error || !data) return null;
  return { url: data.signedUrl, fileName: doc.file_name };
}

// ---------------------------------------------------------------------------
// Scheduled checks (cron)
// ---------------------------------------------------------------------------

export interface ServiceCycleSummary {
  renewalReminders: number;
  escalations: number;
  providerCancellationsFlagged: number;
  errors: number;
}

/**
 * Renewal reminders (30 and 7 days ahead), escalation of urgent documents that have not
 * reached the customer, and unpaid entities to cancel with the provider before its
 * renewal. Never throws: one failure doesn't stop the others.
 */
export async function runServiceCycle(now = new Date()): Promise<ServiceCycleSummary> {
  const summary: ServiceCycleSummary = { renewalReminders: 0, escalations: 0, providerCancellationsFlagged: 0, errors: 0 };
  const db = createAdminClient();
  const today = now.toISOString().slice(0, 10);

  try {
    const { data: subs } = await db
      .from("ra_subscriptions")
      .select("id, user_id, business_id, state_code, plan, billing_status, cancel_at_period_end, current_period_end, renewal_price_cents, renewal_reminders_sent, provider_renewal_date, provider_cancelled_at")
      .neq("service_status", "ended");
    for (const s of subs ?? []) {
      try {
        if (s.current_period_end) {
          const due = renewalReminderDue({
            periodEnd: s.current_period_end,
            today,
            cancelAtPeriodEnd: s.cancel_at_period_end,
            billingStatus: s.billing_status as BillingStatus,
            sent: s.renewal_reminders_sent ?? [],
          });
          if (due) {
            const named = await subscriptionNames(s.id);
            const res = await sendNotification({
              userId: s.user_id,
              templateKey: "ra_renewal_reminder",
              dedupeKey: `ra_renewal_reminder:${s.id}:${due.key}`,
              vars: {
                ...(named?.vars ?? {}),
                days: due.days,
                renewal_date: new Date(s.current_period_end).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" }),
                renewal_amount: formatCents(s.renewal_price_cents),
              },
              ctaPath: `/dashboard/services/${s.id}`,
              businessId: s.business_id,
            });
            if (res.status === "sent" || res.status === "duplicate" || res.status === "suppressed") {
              await db.from("ra_subscriptions").update({ renewal_reminders_sent: [...(s.renewal_reminders_sent ?? []), due.key] }).eq("id", s.id);
              summary.renewalReminders += 1;
            }
          }
        }
        const cancel = providerCancellationDue({
          billingStatus: s.billing_status as BillingStatus,
          providerRenewalDate: s.provider_renewal_date,
          providerCancelledAt: s.provider_cancelled_at,
          today,
        });
        if (cancel.due) {
          const named = await subscriptionNames(s.id);
          await notifyStaff({
            templateKey: "staff_ra_billing_review",
            vars: {
              ...(named?.vars ?? {}),
              message: `the customer hasn't paid and the provider renews this entity in ${cancel.daysLeft} days; cancel it in the partner dashboard${cancel.late ? " now (inside the 30-day notice window)" : ""} unless the customer pays`,
            },
            dedupeKey: `ra_provider_cancel:${s.id}:${s.provider_renewal_date}`,
            ctaPath: `/admin/registered-agent/${s.id}`,
            businessId: s.business_id,
          });
          summary.providerCancellationsFlagged += 1;
        }
      } catch (e) {
        summary.errors += 1;
        console.error("[services cron] subscription check failed", s.id, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    summary.errors += 1;
    console.error("[services cron] subscription scan failed", e instanceof Error ? e.message : e);
  }

  try {
    const { data: docs } = await db
      .from("service_documents")
      .select("id, kind, business_id, ra_subscription_id, available_to_filewell_at, customer_notified_at, escalation_status")
      .is("customer_notified_at", null)
      .neq("urgency", "normal");
    for (const d of docs ?? []) {
      const level = escalationLevel({ kind: d.kind as ServiceDocumentKind, availableAt: d.available_to_filewell_at, customerNotifiedAt: d.customer_notified_at, now: now.toISOString() });
      if (level !== "backup_operator" && level !== "owner") continue;
      if (d.escalation_status === level || (d.escalation_status === "owner" && level === "backup_operator")) continue;
      const named = d.ra_subscription_id ? await subscriptionNames(d.ra_subscription_id) : null;
      await db.from("service_documents").update({ escalation_status: level }).eq("id", d.id);
      await notifyStaff({
        templateKey: "staff_ra_document_escalation",
        vars: {
          ...(named?.vars ?? {}),
          document_label: SERVICE_DOCUMENT_KIND_LABELS[d.kind as ServiceDocumentKind].toLowerCase(),
          message: level === "owner" ? "owner" : "backup operator",
        },
        dedupeKey: `ra_document_escalation:${d.id}:${level}`,
        ctaPath: d.ra_subscription_id ? `/admin/registered-agent/${d.ra_subscription_id}` : "/admin/registered-agent",
        businessId: d.business_id,
      });
      summary.escalations += 1;
    }
  } catch (e) {
    summary.errors += 1;
    console.error("[services cron] document escalation failed", e instanceof Error ? e.message : e);
  }
  return summary;
}
