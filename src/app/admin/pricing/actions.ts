"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { dollarsToCents, money, UUID_RE } from "@/components/admin/format";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, fail, ok, parseForm } from "../_lib/action-helpers";

/**
 * Service price changes (admin only). A fee change always resets approval, so a
 * new amount can't reach live checkout without a fresh, explicit approval. Every
 * change is audited with its before and after values.
 */

const MAX_FEE_CENTS = 1_000_000; // $10,000
const PRICE_COLUMNS = "id, filing_type_code, state_code, entity_type, service_fee_cents, approved, approved_at, approved_by, active, notes";

interface PriceRow {
  id: string;
  filing_type_code: string;
  state_code: string | null;
  entity_type: string | null;
  service_fee_cents: number;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  active: boolean;
  notes: string | null;
}

async function loadPrice(id: string): Promise<PriceRow | null> {
  const { data } = await createAdminClient().from("service_prices").select(PRICE_COLUMNS).eq("id", id).maybeSingle();
  return (data as PriceRow | null) ?? null;
}

function snapshot(p: PriceRow) {
  return {
    service_fee_cents: p.service_fee_cents,
    approved: p.approved,
    approved_at: p.approved_at,
    approved_by: p.approved_by,
    notes: p.notes,
  };
}

export async function changeFeeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      priceId: z.string().regex(UUID_RE, "Unknown price."),
      fee: z.string({ error: "Enter the new fee." }).trim().min(1, "Enter the new fee."),
      notes: z.string().trim().max(500, "Keep notes under 500 characters.").optional().default(""),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const cents = dollarsToCents(parsed.data.fee);
  if (cents === null) return fail("Enter the fee in dollars, for example 49 or 49.00.");
  if (cents < 0 || cents > MAX_FEE_CENTS) return fail("The fee must be between $0 and $10,000.");

  const before = await loadPrice(parsed.data.priceId);
  if (!before) return fail("Price not found.");
  const notes = parsed.data.notes || before.notes;
  if (before.service_fee_cents === cents && notes === before.notes) return ok("No change. The fee is the same.");

  const db = createAdminClient();
  const { data: after, error } = await db
    .from("service_prices")
    .update({
      service_fee_cents: cents,
      approved: false,
      approved_at: null,
      approved_by: null,
      notes,
      updated_by: admin.id,
    })
    .eq("id", before.id)
    .select(PRICE_COLUMNS)
    .single();
  if (error || !after) return fail(`Could not save the price: ${error?.message ?? "unknown error"}`);
  try {
    await audit({
      actorUserId: admin.id,
      actorType: "staff",
      action: "service_price.fee_changed",
      entityType: "service_price",
      entityId: before.id,
      before: snapshot(before),
      after: snapshot(after as PriceRow),
    });
  } catch (e) {
    return actionError(e);
  }
  revalidatePath("/admin/pricing");
  return ok(
    before.approved
      ? `Fee set to ${money(cents)}. Approval was reset: live checkout refuses this price until it is approved again.`
      : `Fee set to ${money(cents)}. It still needs approval before live payments.`,
  );
}

export async function approvePriceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      priceId: z.string().regex(UUID_RE, "Unknown price."),
      expectedFee: z.coerce.number().int().min(0),
      confirm: z.literal("yes", { error: "Tick the confirmation box to approve." }),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const before = await loadPrice(parsed.data.priceId);
  if (!before) return fail("Price not found.");
  if (!before.active) return fail("Inactive prices can't be approved.");
  if (before.approved) return ok("Already approved.");
  // Guard against approving an amount that changed after the page was loaded.
  if (before.service_fee_cents !== parsed.data.expectedFee) {
    return fail(`The fee changed to ${money(before.service_fee_cents)} since this page loaded. Reload and review it before approving.`);
  }

  const db = createAdminClient();
  const approvedAt = new Date().toISOString();
  const { data: after, error } = await db
    .from("service_prices")
    .update({ approved: true, approved_at: approvedAt, approved_by: admin.id, updated_by: admin.id })
    .eq("id", before.id)
    .eq("service_fee_cents", parsed.data.expectedFee)
    .eq("approved", false)
    .select(PRICE_COLUMNS)
    .maybeSingle();
  if (error) return fail(`Could not approve the price: ${error.message}`);
  if (!after) return fail("The price changed while approving. Reload and try again.");
  try {
    await audit({
      actorUserId: admin.id,
      actorType: "staff",
      action: "service_price.approved",
      entityType: "service_price",
      entityId: before.id,
      before: snapshot(before),
      after: snapshot(after as PriceRow),
    });
  } catch (e) {
    return actionError(e);
  }
  revalidatePath("/admin/pricing");
  return ok(`Approved ${money(before.service_fee_cents)} for live payments.`);
}
