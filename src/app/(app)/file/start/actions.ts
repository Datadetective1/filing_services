"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type SessionUser, requireUser } from "@/lib/auth/session";
import { findRule, getJurisdiction } from "@/lib/compliance/registry";
import { todayInTimeZone } from "@/lib/domain/dates";
import { addBusiness, periodFor, startFiling } from "@/lib/filings/customer";
import { clearPendingLookup, type PendingLookup, readPendingLookup } from "@/lib/lookup/pending";
import { createClient } from "@/lib/supabase/server";
import type { ActionMessageState } from "@/components/funnel/types";
import { clearLookupHomeJurisdiction, readLookupHomeJurisdiction } from "@/app/(marketing)/find/lookup-extras";
import { filingErrorCode, friendlyError } from "../_lib/errors";

const modeSchema = z.enum(["file", "track"]).catch("file");

/** An existing, non-archived business of this user matching the lookup (case-insensitive name). */
async function findExistingBusiness(user: SessionUser, lookup: PendingLookup): Promise<string | null> {
  const db = await createClient();
  const { data } = await db
    .from("businesses")
    .select("id, legal_name")
    .eq("owner_user_id", user.id)
    .eq("state_code", lookup.stateCode)
    .eq("entity_type", lookup.entityType)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(200);
  const wanted = lookup.legalName.replace(/\s+/g, " ").trim().toLowerCase();
  const match = (data ?? []).find((b) => String(b.legal_name).replace(/\s+/g, " ").trim().toLowerCase() === wanted);
  return match ? String(match.id) : null;
}

async function clearLookup() {
  await clearPendingLookup();
  await clearLookupHomeJurisdiction();
}

/**
 * Turn the visitor's pending lookup into a business on their account, then either
 * start the filing draft or (reminders only / nothing due yet) go to the business.
 */
export async function confirmStart(_prev: ActionMessageState, formData: FormData): Promise<ActionMessageState> {
  const user = await requireUser("/file/start");
  const lookup = await readPendingLookup();
  if (!lookup) redirect("/find?missing=1");
  const mode = modeSchema.parse(formData.get("mode"));

  const rule = findRule(lookup.stateCode, lookup.entityType, "annual_report", lookup.isForeign);
  if (!rule) {
    return { error: "We don't support filings for this state and entity type yet.", href: "/find", hrefLabel: "Check another business" };
  }

  let businessId: string;
  let track = mode === "track";
  try {
    const existing = await findExistingBusiness(user, lookup);
    if (existing) {
      businessId = existing;
    } else {
      const created = await addBusiness(user, {
        legalName: lookup.legalName,
        stateCode: lookup.stateCode,
        entityType: lookup.entityType,
        isForeign: lookup.isForeign,
        isNonprofit: lookup.isNonprofit,
        formationDate: lookup.formationDate ?? null,
        entityNumber: lookup.entityNumber ?? null,
        homeJurisdiction: lookup.isForeign ? await readLookupHomeJurisdiction() : null,
        alreadyFiledThisYear: lookup.alreadyFiledThisYear,
      });
      businessId = created.businessId;
    }
    // A report for a future year can't be filed yet: add the business and remind instead.
    const period = periodFor(rule, { formationDate: lookup.formationDate ?? null, alreadyFiledThisYear: lookup.alreadyFiledThisYear });
    const currentYear = Number(todayInTimeZone(getJurisdiction(rule.stateCode)?.timezone ?? "America/New_York").slice(0, 4));
    if (period.phase === "first_report_later" || period.periodYear > currentYear) track = true;
  } catch (e) {
    return { error: friendlyError(e), href: "/find", hrefLabel: "Review your details" };
  }

  if (track) {
    await clearLookup();
    redirect(`/dashboard/businesses/${businessId}?added=1`);
  }

  let filingId: string;
  try {
    filingId = await startFiling(user, businessId);
  } catch (e) {
    const code = filingErrorCode(e);
    if (code === "not_allowed" || code === "not_found") {
      await clearLookup();
      return {
        error: `${friendlyError(e)} Your business is saved to your account.`,
        href: `/dashboard/businesses/${businessId}`,
        hrefLabel: "Go to the business",
      };
    }
    return { error: friendlyError(e) };
  }

  await clearLookup();
  redirect(`/file/${filingId}/details`);
}
