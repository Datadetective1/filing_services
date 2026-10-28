import "server-only";
import { todayInTimeZone } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import { notifyStaff } from "@/lib/notifications/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymentsNeedingReview } from "./review";

/** Same day boundary as the admin console (Eastern). */
const OPS_TIME_ZONE = "America/New_York";
/** Same cap as the "Needs review" list on /admin/payments. */
const MAX_CASES = 100;

interface FlaggedPayment {
  id: string;
  order_id: string;
  mode: string;
  amount_cents: number;
  review_reason: string | null;
}

export interface PaymentReviewAlertSummary {
  /** Payments flagged for review right now. */
  cases: number;
  /** Staff emails by outcome (one per active staff member per case). */
  sent: number;
  duplicate: number;
  failed: number;
  suppressed: number;
}

/**
 * Dedupe base: one alert per flagged payment per Eastern calendar day. notifyStaff adds the
 * staff member, and notifications.dedupe_key is unique, so a second run that day is a no-op.
 */
export function paymentReviewAlertKey(paymentId: string, now: Date = new Date()): string {
  return `staff_payment_review:${paymentId}:${todayInTimeZone(OPS_TIME_ZONE, now)}`;
}

/**
 * Daily, from the reminder cron: email staff about every payment flagged for review (the
 * cases listed on /admin/payments and /admin), at most once per payment per day, through
 * the staff notification path (outbox outside production). Never throws.
 */
export async function alertStaffOfPaymentsNeedingReview(now: Date = new Date()): Promise<PaymentReviewAlertSummary> {
  const summary: PaymentReviewAlertSummary = { cases: 0, sent: 0, duplicate: 0, failed: 0, suppressed: 0 };
  try {
    const db = createAdminClient();
    const { data, error } = await paymentsNeedingReview<FlaggedPayment>(db, "id, order_id, mode, amount_cents, review_reason", { limit: MAX_CASES });
    if (error) throw new Error(error.message);
    const payments = data ?? [];
    summary.cases = payments.length;
    if (!payments.length) return summary;

    // The filing each order belongs to: the business name and where the email links (as on /admin).
    const { data: filings } = await db
      .from("filings")
      .select("id, order_id, business_id, businesses(legal_name)")
      .in("order_id", [...new Set(payments.map((p) => p.order_id))]);
    const byOrder = new Map<string, { filingId: string; businessId: string | null; businessName: string | null }>();
    for (const f of (filings ?? []) as { id: string; order_id: string; business_id: string | null; businesses: { legal_name: string } | { legal_name: string }[] | null }[]) {
      const b = Array.isArray(f.businesses) ? f.businesses[0] : f.businesses;
      byOrder.set(f.order_id, { filingId: f.id, businessId: f.business_id, businessName: b?.legal_name ?? null });
    }

    for (const p of payments) {
      const filing = byOrder.get(p.order_id);
      const results = await notifyStaff({
        templateKey: "staff_payment_review",
        vars: {
          company_name: filing?.businessName ?? "Unknown business",
          amount: formatCents(p.amount_cents),
          payment_mode: p.mode,
          review_reason: p.review_reason ?? "flagged for review",
        },
        dedupeKey: paymentReviewAlertKey(p.id, now),
        ctaPath: filing ? `/admin/filings/${filing.filingId}#payment` : "/admin/payments#review",
        filingId: filing?.filingId ?? null,
        businessId: filing?.businessId ?? null,
      });
      for (const r of results) summary[r.status] += 1;
    }
  } catch (e) {
    console.error("[staff alert] payment review alerts failed", e instanceof Error ? e.message : e);
  }
  return summary;
}
