"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { CHANNELS, ensureDailyList, PROSPECT_STATUSES, updateFounderProspect } from "@/lib/acquisition/founder";
import { PARTNER_KINDS, PARTNER_STATUSES, savePartner } from "@/lib/acquisition/partners";
import { EXPORT_SOURCES, importStateExport } from "@/lib/acquisition/state-cohort";
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

export async function buildDailyListAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const state = ["PA", "WA", "NV", "UT"].includes(String(formData.get("state") ?? "PA")) ? String(formData.get("state") ?? "PA") : "PA";
  try {
    const r = await ensureDailyList(undefined, undefined, state);
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

/**
 * Import an official state search export (CSV) that the operator downloaded in a browser.
 * Records the export date as the status timestamp. Contacts no one.
 */
export async function importStateExportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const state = String(formData.get("state") ?? "").toUpperCase();
  const meta = EXPORT_SOURCES[state];
  if (!meta?.available) return fail("Imports aren't available for this state.");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose the CSV file you downloaded.");
  if (file.size > 4 * 1024 * 1024) return fail("Files must be 4 MB or smaller. Narrow the search (for example one business type at a time).");
  const exportedOn = String(formData.get("exportedOn") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exportedOn)) return fail("Enter the date you downloaded the export.");
  try {
    const text = await file.text();
    const r = await importStateExport(state, text, `${exportedOn}T12:00:00Z`);
    await audit({ actorUserId: admin.id, actorType: "staff", action: "acquisition.state_export_imported", entityType: "state_entity_record", entityId: null, after: { state, ...r } });
    revalidatePath("/admin/acquisition/october");
    if (!r.imported) return fail(`Nothing imported. ${r.firstSkips.map((s) => `Line ${s.line}: ${s.reason}`).join("; ")}`);
    return ok(`Imported ${r.imported} ${state} records${r.skipped ? `, skipped ${r.skipped}` : ""}${r.unsupportedType ? ` (${r.unsupportedType} with a type Filewell doesn't cover yet)` : ""}.`, [
      { label: "Columns used", value: Object.entries(r.columns).map(([k, v]) => `${k}: ${v ?? "not found"}`).join(" · ") },
    ]);
  } catch (e) {
    return actionError(e);
  }
}
