"use server";

import { z } from "zod";
import { readPendingLookup } from "@/lib/lookup/pending";
import { subscribeToReminders } from "@/lib/reminders/subscribers";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";

export type ReminderOptInState =
  | { ok: true; email: string }
  | { ok: false; error?: string; fieldErrors?: { email?: string; consent?: string } }
  | undefined;

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254)),
  consent: z.literal("yes", { error: "Tick the box to confirm you want these reminders" }),
  fw_hp: z.string().max(0).optional(),
});

/**
 * Free reminder opt-in for the business the visitor just looked up (read from their own
 * signed lookup cookie, never from the form). Nothing is bought; a confirmation email is
 * sent and reminders start only after the visitor confirms.
 */
export async function optInToReminders(_: ReminderOptInState, formData: FormData): Promise<ReminderOptInState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? ""),
    consent: formData.get("consent") ?? undefined,
    fw_hp: (formData.get("fw_hp") as string | null) ?? undefined,
  });
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "fw_hp")) return { ok: true, email: "" };
    const fieldErrors: { email?: string; consent?: string } = {};
    for (const i of parsed.error.issues) {
      if (i.path[0] === "email") fieldErrors.email ??= i.message;
      if (i.path[0] === "consent") fieldErrors.consent ??= "Tick the box to confirm you want these reminders";
    }
    return { ok: false, fieldErrors };
  }
  const lookup = await readPendingLookup();
  if (!lookup) return { ok: false, error: "We lost track of the business you looked up. Search for it again, then sign up." };

  const ip = (await clientIpHash().catch(() => null)) ?? "unknown";
  if (!(await rateLimit(`reminder-optin:${ip}`, 5, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const r = await subscribeToReminders(parsed.data.email, lookup, true).catch(() => ({ status: "error" as const }));
  switch (r.status) {
    case "sent":
    case "throttled":
      return { ok: true, email: parsed.data.email };
    case "already_confirmed":
      return { ok: true, email: parsed.data.email };
    case "unsupported":
      return { ok: false, error: "We can't set up reminders for this business type yet." };
    default:
      return { ok: false, error: "We couldn't save that right now. Please try again later." };
  }
}
