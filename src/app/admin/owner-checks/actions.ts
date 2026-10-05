"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { OWNER_CHECK_KEYS } from "@/lib/admin/owner-checks";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, fail, ok, parseForm } from "../_lib/action-helpers";

/** Save one owner-check item (admin only): done/not done and the recorded state wording. Audited. */
export async function saveOwnerCheckAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      itemKey: z.string().refine((k) => OWNER_CHECK_KEYS.has(k), "Unknown checklist item."),
      done: z.literal("on").optional(),
      note: z.string().max(4000, "Keep the note under 4,000 characters.").optional().default(""),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const { itemKey, done, note } = parsed.data;
  const db = createAdminClient();
  try {
    const { data: before } = await db.from("owner_checks").select("done, note").eq("item_key", itemKey).maybeSingle();
    const after = { done: done === "on", note: note.trim() || null };
    const { error } = await db
      .from("owner_checks")
      .upsert({ item_key: itemKey, ...after, updated_by: admin.id, updated_at: new Date().toISOString() }, { onConflict: "item_key" });
    if (error) return fail(`Could not save: ${error.message}`);
    await audit({
      actorUserId: admin.id,
      actorType: "staff",
      action: "owner_check.saved",
      entityType: "owner_check",
      entityId: itemKey,
      before: before ?? null,
      after,
    });
  } catch (e) {
    return actionError(e);
  }
  revalidatePath("/admin/owner-checks");
  return ok("Saved.");
}
