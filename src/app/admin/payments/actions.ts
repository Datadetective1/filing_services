"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { UUID_RE } from "@/components/admin/format";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, fail, ok, parseForm } from "../_lib/action-helpers";

/**
 * Clear a payment's review flag (admin only). Nothing else ever sets requires_review back
 * to false, so without this a flagged payment stays on "Payments requiring review" and in
 * the daily staff alert forever. Only requires_review changes: review_reason stays as the
 * record of why it was flagged, and status, amounts, orders, refunds and filings are never
 * touched. The audit record (with the admin's note) is written first, and the flag is
 * cleared only if that succeeded.
 */

interface ReviewRow {
  id: string;
  order_id: string;
  requires_review: boolean;
  review_reason: string | null;
}

export async function markPaymentReviewedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      paymentId: z.string().regex(UUID_RE, "Unknown payment."),
      note: z
        .string({ error: "Say what you checked." })
        .trim()
        .min(1, "Say what you checked.")
        .max(500, "Keep the note under 500 characters."),
      confirm: z.literal("yes", { error: "Tick the confirmation box to mark it reviewed." }),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);

  const db = createAdminClient();
  const { data: before, error: readError } = await db
    .from("payments")
    .select("id, order_id, requires_review, review_reason")
    .eq("id", parsed.data.paymentId)
    .maybeSingle();
  if (readError) return fail(`Could not load the payment: ${readError.message}`);
  if (!before) return fail("Payment not found.");
  const payment = before as ReviewRow;
  if (!payment.requires_review) return ok("Already reviewed. Nothing changed.");

  // The filing the order belongs to, so the clear also shows in that filing's audit log.
  const { data: filing } = await db.from("filings").select("id").eq("order_id", payment.order_id).maybeSingle();
  const filingId = (filing as { id: string } | null)?.id ?? null;

  try {
    await audit({
      actorUserId: admin.id,
      actorType: "staff",
      action: "payment.review_cleared",
      entityType: "payment",
      entityId: payment.id,
      filingId,
      before: { requires_review: true, review_reason: payment.review_reason },
      after: { requires_review: false, review_reason: payment.review_reason },
      metadata: { note: parsed.data.note, order_id: payment.order_id },
    });
  } catch (e) {
    return actionError(e);
  }

  // Guarded on the flag, so a payment cleared by someone else in the meantime is left alone.
  const { data: after, error: updateError } = await db
    .from("payments")
    .update({ requires_review: false })
    .eq("id", payment.id)
    .eq("requires_review", true)
    .select("id")
    .maybeSingle();
  if (updateError) {
    return fail(`Your note was logged, but the flag was not cleared: ${updateError.message}. Try again.`);
  }
  if (!after) return ok("Already reviewed. Nothing changed.");

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  if (filingId) revalidatePath(`/admin/filings/${filingId}`);
  return ok("Marked reviewed. The payment no longer shows as needing review, and the daily alert stops.");
}
