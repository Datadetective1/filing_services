"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { CHANNELS, ensureDailyList, PROSPECT_STATUSES, updateFounderProspect } from "@/lib/acquisition/founder";
import { PARTNER_KINDS, PARTNER_STATUSES, savePartner } from "@/lib/acquisition/partners";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { actionError, fail, ok, parseForm } from "../_lib/action-helpers";

/**
 * Founder research and referral-partner CRM. These actions only record what the operator
 * typed; none of them sends a message or looks anything up about a person.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\/[^\s]+$/i.test(v), "Links must start with http:// or https://");
const optionalDate = z
  .string()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date");

export async function buildDailyListAction(): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const r = await ensureDailyList();
    await audit({ actorUserId: admin.id, actorType: "staff", action: "acquisition.daily_list_built", entityType: "founder_prospect", entityId: null, after: r });
    revalidatePath("/admin/acquisition/prospects");
    if (r.added === 0 && r.available === 0) return ok("Today's list is already full, or there are no more register records to choose from. Import more from Outreach.");
    return ok(`Added ${r.added} businesses to today's research list.`);
  } catch (e) {
    return actionError(e);
  }
}

export async function updateProspectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      id: z.uuid(),
      status: z.enum(PROSPECT_STATUSES),
      websiteUrl: optionalUrl,
      contactPageUrl: optionalUrl,
      businessPhone: optionalText(40),
      linkedinUrl: optionalUrl,
      contactedOn: optionalDate,
      channel: z
        .enum(CHANNELS)
        .or(z.literal(""))
        .optional()
        .transform((v) => (v ? v : null)),
      response: optionalText(1000),
      interested: z
        .enum(["", "yes", "no"])
        .optional()
        .transform((v) => (v === "yes" ? true : v === "no" ? false : null)),
      converted: z
        .string()
        .optional()
        .transform((v) => v === "on"),
      notes: optionalText(2000),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  try {
    const { id, ...u } = parsed.data;
    await updateFounderProspect(id, u, admin.id);
    revalidatePath("/admin/acquisition/prospects");
    return ok("Saved.");
  } catch (e) {
    return actionError(e);
  }
}

export async function savePartnerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      id: z
        .string()
        .optional()
        .transform((v) => v || null)
        .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Invalid partner"),
      firmName: z.string().trim().min(1, "Enter the firm's name.").max(200),
      kind: z.enum(PARTNER_KINDS),
      websiteUrl: optionalUrl,
      publicContact: optionalText(300),
      status: z.enum(PARTNER_STATUSES),
      contactedOn: optionalDate,
      response: optionalText(1000),
      refCode: z
        .string()
        .trim()
        .toLowerCase()
        .optional()
        .transform((v) => v || null)
        .refine((v) => v === null || /^[a-z0-9-]{3,40}$/.test(v), "Referral codes use 3-40 lowercase letters, numbers and dashes"),
      notes: optionalText(2000),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  try {
    const { id, ...p } = parsed.data;
    await savePartner(id, p, admin.id);
    revalidatePath("/admin/acquisition/partners");
    return ok(id ? "Partner updated." : "Partner added.");
  } catch (e) {
    if (e instanceof Error && e.message.includes("referral code")) return fail(e.message);
    return actionError(e);
  }
}
