"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { contentSha256, DEFAULT_SUBJECTS, subjectProblem } from "@/lib/outreach/email";
import { buildMailPilot } from "@/lib/outreach/mail-service";
import { POSTCARD_TEMPLATE_VERSION } from "@/lib/outreach/postcard";
import { dryRunCampaign, importPaProspects, suppressEmail, type CampaignRow } from "@/lib/outreach/service";
import { RegistryUnavailableError } from "@/lib/registry/pa-open-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, fail, ok, parseForm } from "../_lib/action-helpers";

/**
 * Outreach admin actions. None of them sends email: approval records the exact content an
 * admin reviewed, and the dry run records who WOULD receive it and why not.
 */

const SEGMENTS = ["approaching_deadline", "deadline_passed_outstanding", "unknown_status"] as const;
const GROUPS = ["all", "llc", "corporation", "other"] as const;

export async function importProspectsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      group: z.enum(["llc", "corporation", "other"]),
      county: z.string().trim().max(40).optional().default(""),
      limit: z.coerce.number().int().min(1).max(500),
      offset: z.coerce.number().int().min(0).max(5_000_000).default(0),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  try {
    const r = await importPaProspects({ group: parsed.data.group, county: parsed.data.county || null, limit: parsed.data.limit, offset: parsed.data.offset });
    await audit({ actorUserId: admin.id, actorType: "staff", action: "outreach.prospects_imported", entityType: "prospect", entityId: null, after: { ...parsed.data, ...r } });
    revalidatePath("/admin/outreach");
    return ok(`Imported ${r.imported} businesses from the Department of State open register${r.customers ? ` (${r.customers} already Filewell customers, excluded from outreach)` : ""}.`);
  } catch (e) {
    if (e instanceof RegistryUnavailableError) return fail("data.pa.gov didn't respond. Try again in a minute.");
    return actionError(e);
  }
}

export async function createCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseForm(
    z.object({
      name: z.string().trim().min(1, "Name the campaign.").max(120),
      segment: z.enum(SEGMENTS),
      entityGroup: z.enum(GROUPS),
      subject: z.string().trim().max(150).optional().default(""),
    }),
    formData,
  );
  if (!parsed.ok) return fail(parsed.error);
  const subject = parsed.data.subject || DEFAULT_SUBJECTS[parsed.data.segment];
  const problem = subjectProblem(subject);
  if (problem) return fail(`Subject: ${problem}`);
  const { data, error } = await createAdminClient()
    .from("marketing_campaigns")
    .insert({ name: parsed.data.name, state_code: "PA", segment: parsed.data.segment, entity_group: parsed.data.entityGroup, subject, status: "draft", created_by: admin.id })
    .select("id")
    .single();
  if (error || !data) return fail(`Could not create the campaign: ${error?.message ?? "unknown"}`);
  await audit({ actorUserId: admin.id, actorType: "staff", action: "outreach.campaign_created", entityType: "marketing_campaign", entityId: data.id, after: { ...parsed.data, subject } });
  revalidatePath("/admin/outreach");
  return ok("Campaign created as a draft. Open it to preview recipients and the exact email.");
}

async function loadCampaign(id: string): Promise<CampaignRow | null> {
  const { data } = await createAdminClient()
    .from("marketing_campaigns")
    .select("id, name, segment, entity_group, subject, status, approved_content_sha256, approved_at")
    .eq("id", id)
    .maybeSingle();
  return (data as CampaignRow | null) ?? null;
}

export async function dryRunAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("campaignId") ?? "");
  const campaign = /^[0-9a-f-]{36}$/.test(id) ? await loadCampaign(id) : null;
  if (!campaign) return fail("Campaign not found.");
  const r = await dryRunCampaign(campaign, { persist: true });
  const would = r.recipients.filter((x) => x.wouldSend).length;
  await audit({ actorUserId: admin.id, actorType: "staff", action: "outreach.dry_run", entityType: "marketing_campaign", entityId: id, after: { prospects: r.recipients.length, would_send: would, campaign_gates: r.campaignGates } });
  revalidatePath(`/admin/outreach/${id}`);
  return ok(`Dry run done: ${r.recipients.length} businesses evaluated, ${would} would receive it. Nothing was sent.`);
}

export async function approveCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("campaignId") ?? "");
  const campaign = /^[0-9a-f-]{36}$/.test(id) ? await loadCampaign(id) : null;
  if (!campaign) return fail("Campaign not found.");
  const problem = subjectProblem(campaign.subject);
  if (problem) return fail(`Subject: ${problem}`);
  const expected = String(formData.get("contentSha") ?? "");
  const sha = contentSha256({ subject: campaign.subject, segment: campaign.segment, entityGroup: campaign.entity_group });
  if (expected !== sha) return fail("The campaign changed since this page loaded. Reload and review it again.");
  const { error } = await createAdminClient()
    .from("marketing_campaigns")
    .update({ status: "approved", approved_by: admin.id, approved_at: new Date().toISOString(), approved_content_sha256: sha })
    .eq("id", id);
  if (error) return fail(`Could not approve: ${error.message}`);
  await audit({ actorUserId: admin.id, actorType: "staff", action: "outreach.campaign_approved", entityType: "marketing_campaign", entityId: id, after: { content_sha256: sha, subject: campaign.subject } });
  revalidatePath(`/admin/outreach/${id}`);
  return ok("Content approved. Sending stays off until every gate on this page passes (postal address, approved provider, sends switch).");
}

export async function suppressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "");
  if (!(await suppressEmail(email, "manual", `admin:${admin.id}`))) return fail("Enter a valid email address.");
  await audit({ actorUserId: admin.id, actorType: "staff", action: "outreach.suppressed", entityType: "marketing_suppression", entityId: null, after: { reason: "manual" } });
  revalidatePath("/admin/outreach");
  return ok("Added to the permanent do-not-contact list.");
}

// ---------------------------------------------------------------------------
// Physical-mail pilot (design and export only: nothing is purchased or mailed)
// ---------------------------------------------------------------------------

export async function createMailPilotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return fail("Name the pilot.");
  const { data, error } = await createAdminClient()
    .from("marketing_campaigns")
    .insert({
      name,
      state_code: "PA",
      channel: "mail",
      segment: "upcoming_deadline",
      entity_group: "other",
      template_key: "pa_dec31_postcard",
      subject: "Postcard: Pennsylvania December 31 annual report",
      status: "draft",
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !data) return fail(`Could not create the pilot: ${error?.message ?? "unknown"}`);
  await audit({ actorUserId: admin.id, actorType: "staff", action: "outreach.mail_pilot_created", entityType: "marketing_campaign", entityId: data.id, after: { name } });
  revalidatePath("/admin/outreach");
  return ok("Postcard pilot created. Open it to see who would get a card, the exclusions, the card and the export.");
}

export async function mailDryRunAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("campaignId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Pilot not found.");
  const rows = await buildMailPilot(id, { persist: true });
  const included = rows.filter((r) => r.included).length;
  await audit({ actorUserId: admin.id, actorType: "staff", action: "outreach.mail_dry_run", entityType: "marketing_campaign", entityId: id, after: { evaluated: rows.length, included } });
  revalidatePath(`/admin/outreach/${id}`);
  return ok(`Dry run recorded: ${rows.length} businesses evaluated, ${included} would get a card. Nothing was purchased or mailed.`);
}

export async function approveMailPilotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("campaignId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Pilot not found.");
  const sha = createHash("sha256").update(POSTCARD_TEMPLATE_VERSION).digest("hex");
  const { error } = await createAdminClient()
    .from("marketing_campaigns")
    .update({ status: "approved", approved_by: admin.id, approved_at: new Date().toISOString(), approved_content_sha256: sha })
    .eq("id", id)
    .eq("channel", "mail");
  if (error) return fail(`Could not approve: ${error.message}`);
  await audit({ actorUserId: admin.id, actorType: "staff", action: "outreach.mail_pilot_approved", entityType: "marketing_campaign", entityId: id, after: { template: POSTCARD_TEMPLATE_VERSION } });
  revalidatePath(`/admin/outreach/${id}`);
  return ok("Card content approved. Nothing is purchased or mailed: a vendor, a return address and the mail switch are still required.");
}
