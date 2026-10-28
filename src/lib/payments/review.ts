import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Payments flagged for staff review while processing: an amount or currency mismatch, a
 * second payment for an order that was already paid, a refund issued outside the app.
 * The one definition (requires_review, most recently updated first) behind "Payments
 * requiring review" on /admin/payments, "Payment review" on /admin and the daily staff
 * alert.
 */
export function paymentsNeedingReview<Row>(db: Pick<SupabaseClient, "from">, columns: string, opts: { limit: number; count?: "exact" }) {
  return db
    .from("payments")
    .select(columns, opts.count ? { count: opts.count } : undefined)
    .eq("requires_review", true)
    .order("updated_at", { ascending: false })
    .limit(opts.limit)
    .overrideTypes<Row[], { merge: false }>();
}
