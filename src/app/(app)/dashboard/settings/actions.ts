"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Settings actions. Profile changes go through the RLS client, which may only
 * update the signed-in user's own row and only the columns granted to customers
 * (full_name, phone, reminder_emails_enabled).
 */

export type ProfileValues = { fullName: string; phone: string };
export type ProfileState =
  | { ok?: boolean; error?: string; fieldErrors?: Partial<Record<keyof ProfileValues, string>>; values?: ProfileValues; savedAt?: number }
  | undefined;

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

const profileSchema = z.object({
  fullName: z
    .string()
    .transform(collapse)
    .pipe(z.string().max(200, "Use 200 characters or fewer.")),
  phone: z
    .string()
    .transform(collapse)
    .pipe(
      z
        .string()
        .max(40, "Use 40 characters or fewer.")
        .refine(
          (v) => v === "" || (/^[0-9+().\-\s]+$/.test(v) && v.replace(/\D/g, "").length >= 7),
          "Enter a valid phone number, or leave it blank.",
        ),
    ),
});

export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser("/dashboard/settings");
  const raw = { fullName: String(formData.get("fullName") ?? ""), phone: String(formData.get("phone") ?? "") };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ProfileValues, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ProfileValues | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors, values: raw };
  }

  const db = await createClient();
  const { error } = await db
    .from("profiles")
    .update({ full_name: parsed.data.fullName || null, phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) return { error: "We couldn't save your changes. Please try again.", values: raw };

  refresh();
  return { ok: true, values: parsed.data, savedAt: Date.now() };
}

export type ReminderState = { ok?: boolean; enabled?: boolean; error?: string; savedAt?: number } | undefined;

export async function setReminderEmailsAction(_prev: ReminderState, formData: FormData): Promise<ReminderState> {
  const user = await requireUser("/dashboard/settings");
  const parsed = z.object({ enabled: z.enum(["true", "false"]) }).safeParse({ enabled: formData.get("enabled") });
  if (!parsed.success) return { error: "Something went wrong. Please try again." };
  const enabled = parsed.data.enabled === "true";

  const db = await createClient();
  const { data, error } = await db
    .from("profiles")
    .update({ reminder_emails_enabled: enabled })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "We couldn't update your email preferences. Please try again." };

  await audit({
    actorUserId: user.id,
    actorType: "customer",
    action: enabled ? "reminders.enabled" : "reminders.disabled",
    entityType: "profile",
    entityId: user.id,
    after: { reminder_emails_enabled: enabled },
  });
  refresh();
  return { ok: true, enabled, savedAt: Date.now() };
}
