"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { UUID_RE } from "@/components/admin/format";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { runReminderCycle, type DispatchSummary } from "@/lib/reminders/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, fail, ok, parseForm } from "../_lib/action-helpers";

/** Admin-only reminder controls. Every run and every schedule change is audited. */

export async function runReminderCycleAction(): Promise<ActionState> {
  const admin = await requireAdmin();
  let summary: DispatchSummary;
  try {
    summary = await runReminderCycle();
  } catch (e) {
    await audit({
      actorUserId: admin.id,
      actorType: "staff",
      action: "reminders.manual_run_failed",
      entityType: "reminder_cycle",
      metadata: { error: e instanceof Error ? e.message.slice(0, 500) : "unknown" },
    }).catch(() => {});
    return actionError(e);
  }
  try {
    await audit({
      actorUserId: admin.id,
      actorType: "staff",
      action: "reminders.manual_run",
      entityType: "reminder_cycle",
      after: { ...summary },
    });
  } catch (e) {
    return actionError(e);
  }
  revalidatePath("/admin/reminders");
  return ok("Reminder cycle finished.", [
    { label: "Examined", value: String(summary.examined) },
    { label: "Sent", value: String(summary.sent) },
    { label: "Skipped", value: String(summary.skipped) },
    { label: "Cancelled", value: String(summary.cancelled) },
    { label: "Failed", value: String(summary.failed) },
    { label: "Newly planned", value: String(summary.planned) },
    { label: "Periods rolled forward", value: String(summary.rolledForward) },
  ]);
}

/** "-90, -60, -30, 0, 7" -> sorted unique integers within [-365, 365]. */
function parseOffsets(input: string): { ok: true; offsets: number[] } | { ok: false; error: string } {
  const parts = input
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return { ok: false, error: "Enter at least one offset." };
  if (parts.length > 40) return { ok: false, error: "Use at most 40 offsets." };
  const values: number[] = [];
  for (const p of parts) {
    if (!/^[+-]?\d{1,3}$/.test(p)) return { ok: false, error: `"${p}" is not a whole number of days.` };
    const n = Number(p);
    if (n < -365 || n > 365) return { ok: false, error: `${n} is outside the allowed range of -365 to 365.` };
    values.push(n);
  }
  return { ok: true, offsets: [...new Set(values)].sort((a, b) => a - b) };
}

export async function updateScheduleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      scheduleId: z.string().regex(UUID_RE, "Unknown schedule."),
      offsets: z.string({ error: "Enter the offsets." }).max(500, "That list is too long."),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const offsets = parseOffsets(parsed.data.offsets);
  if (!offsets.ok) return fail(offsets.error);

  const db = createAdminClient();
  const { data: before } = await db.from("reminder_schedules").select("id, name, offsets_days").eq("id", parsed.data.scheduleId).maybeSingle();
  if (!before) return fail("Schedule not found.");
  const previous = (before.offsets_days ?? []) as number[];
  if (previous.length === offsets.offsets.length && previous.every((v, i) => v === offsets.offsets[i])) {
    return ok("No change. The offsets are the same.");
  }
  const { error } = await db.from("reminder_schedules").update({ offsets_days: offsets.offsets }).eq("id", before.id);
  if (error) return fail(`Could not save the schedule: ${error.message}`);
  try {
    await audit({
      actorUserId: admin.id,
      actorType: "staff",
      action: "reminder_schedule.updated",
      entityType: "reminder_schedule",
      entityId: before.id,
      before: { offsets_days: previous },
      after: { offsets_days: offsets.offsets },
      metadata: { name: before.name },
    });
  } catch (e) {
    return actionError(e);
  }
  revalidatePath("/admin/reminders");
  return ok(`Saved: ${offsets.offsets.join(", ")}.`);
}
