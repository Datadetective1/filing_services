import "server-only";
import { loadFilingContext } from "@/lib/filings/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification, type SendResult } from "./send";

export interface NotifyStaffInput {
  templateKey: string;
  vars: Record<string, string | number | null | undefined>;
  /** Base dedupe key for the event; each staff member's copy is suffixed with their user id. */
  dedupeKey: string;
  /** Internal path the CTA should land on, e.g. /admin/filings/<id>. */
  ctaPath?: string | null;
  filingId?: string | null;
  businessId?: string | null;
}

export function staffDedupeKey(base: string, staffUserId: string): string {
  return `${base}:staff:${staffUserId}`;
}

/**
 * Email a template to every active staff member (one notification per staff user,
 * so each copy is deduplicated and recorded on its own). Never throws: a failed
 * alert must not break payment processing or a customer's action.
 */
export async function notifyStaff(input: NotifyStaffInput): Promise<SendResult[]> {
  const results: SendResult[] = [];
  try {
    const { data, error } = await createAdminClient().from("staff_members").select("user_id").eq("active", true);
    if (error) throw new Error(error.message);
    for (const member of (data ?? []) as { user_id: string }[]) {
      try {
        results.push(
          await sendNotification({
            userId: member.user_id,
            templateKey: input.templateKey,
            dedupeKey: staffDedupeKey(input.dedupeKey, member.user_id),
            vars: input.vars,
            ctaPath: input.ctaPath ?? null,
            filingId: input.filingId ?? null,
            businessId: input.businessId ?? null,
          }),
        );
      } catch (e) {
        console.error("[staff alert] send failed", input.templateKey, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error("[staff alert] staff lookup failed", input.templateKey, e instanceof Error ? e.message : e);
  }
  return results;
}

/**
 * Dedupe base for "customer message" alerts: one alert per filing per clock hour (UTC).
 * Later messages on the same filing in that hour are in the same thread and return
 * "duplicate", so a burst of customer messages cannot flood staff inboxes or use up
 * the email provider's daily quota (which would block customer emails).
 */
export function customerMessageAlertKey(filingId: string, now: Date = new Date()): string {
  return `staff_customer_message:${filingId}:${now.toISOString().slice(0, 13)}`;
}

/** Tell staff a customer posted a message on a filing (at most one alert per filing per hour). Never throws. */
export async function notifyStaffOfCustomerMessage(filingId: string, messageId: string): Promise<void> {
  try {
    const ctx = await loadFilingContext(filingId);
    if (!ctx) return;
    await notifyStaff({
      templateKey: "staff_customer_message",
      vars: ctx.vars,
      dedupeKey: customerMessageAlertKey(ctx.filing.id),
      ctaPath: `/admin/filings/${ctx.filing.id}`,
      filingId: ctx.filing.id,
      businessId: ctx.filing.businessId,
    });
  } catch (e) {
    console.error("[staff alert] customer message alert failed", messageId, e instanceof Error ? e.message : e);
  }
}
