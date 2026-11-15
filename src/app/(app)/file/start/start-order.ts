import "server-only";
import { saveBusinessAttribution } from "@/lib/analytics/attribution-server";
import type { SessionUser } from "@/lib/auth/session";
import { findRule, getJurisdiction } from "@/lib/compliance/registry";
import { todayInTimeZone } from "@/lib/domain/dates";
import { addBusiness, periodFor, startFiling } from "@/lib/filings/customer";
import { findExistingBusiness } from "@/lib/filings/find-existing";
import { clearPendingLookup, readPendingLookup } from "@/lib/lookup/pending";
import { hasRegistrySearch } from "@/lib/registry/sources";
import { linkRegistryRecord } from "@/lib/registry/state-records";
import { mailAttributionFor, markMailEvent } from "@/lib/outreach/mail-cohort";
import { clearLookupHomeJurisdiction, readLookupHomeJurisdiction } from "@/app/(marketing)/find/lookup-extras";
import { filingErrorCode, friendlyError } from "../_lib/errors";

export type StartOutcome = { to: string } | { error: string; href?: string; hrefLabel?: string };

async function clearLookup() {
  await clearPendingLookup();
  await clearLookupHomeJurisdiction();
}

/**
 * Turn the visitor's pending lookup into a business on their account, then either
 * start the filing draft or (reminders only / nothing due yet) go to the business.
 * Returns where to send the customer next; never redirects itself.
 */
export async function startOrderFromLookup(user: SessionUser, mode: "file" | "track"): Promise<StartOutcome> {
  const lookup = await readPendingLookup();
  if (!lookup) return { to: "/find?missing=1" };

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
    await saveBusinessAttribution(businessId, user.id);
    if (lookup.registryEntityNumber && hasRegistrySearch(lookup.stateCode)) {
      await linkRegistryRecord(user.id, businessId, lookup.stateCode, lookup.registryEntityNumber);
      if (lookup.stateCode === "PA") {
        const attribution = await mailAttributionFor(lookup.registryEntityNumber);
        if (attribution) await markMailEvent(attribution, "started", businessId).catch(() => undefined);
      }
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
    return { to: `/dashboard/businesses/${businessId}?added=1` };
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
  return { to: `/file/${filingId}/details` };
}
