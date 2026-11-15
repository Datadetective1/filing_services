import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { findExistingBusiness } from "@/lib/filings/find-existing";
import { clearPendingLookup, readPendingLookup } from "@/lib/lookup/pending";
import { providerReportSaleCheck } from "@/lib/registered-agent/provider-report";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { hasRegistrySearch } from "@/lib/registry/sources";
import { linkRegistryRecord } from "@/lib/registry/state-records";
import { addBusinessForService } from "@/lib/services/business";
import { clearLookupHomeJurisdiction, readLookupHomeJurisdiction } from "@/app/(marketing)/find/lookup-extras";

export const dynamic = "force-dynamic";

/**
 * After the lookup (and the email step), turn the business the visitor looked up into a
 * business on their account and open its annual report order, filled in from the state's
 * register when they picked it there. Nothing is charged or started here.
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  // A router prefetch must never create anything: only a real visit does.
  if (request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch") return new NextResponse(null, { status: 204 });
  const user = await getCurrentUser();
  if (!user) return to(`/login?next=${encodeURIComponent("/dashboard/services/annual-report/start")}`);
  if (!businessServicesPagesEnabled()) return to("/dashboard");
  const lookup = await readPendingLookup();
  if (!lookup) return to("/dashboard/services/annual-report");
  const type = lookup.entityType;
  if ((type !== "llc" && type !== "corporation") || !providerReportSaleCheck(lookup.stateCode, type).ok) return to("/find/result");

  let businessId = await findExistingBusiness(user, lookup);
  if (!businessId) {
    try {
      businessId = await addBusinessForService(user, {
        legalName: lookup.legalName,
        stateCode: lookup.stateCode,
        entityType: type,
        isForeign: lookup.isForeign,
        isNonprofit: lookup.isNonprofit,
        formationDate: lookup.formationDate ?? null,
        entityNumber: lookup.entityNumber ?? lookup.registryEntityNumber ?? null,
        homeJurisdiction: lookup.isForeign ? await readLookupHomeJurisdiction() : null,
        alreadyFiledThisYear: lookup.alreadyFiledThisYear,
      });
    } catch (e) {
      console.error("[provider-report] could not add business", e);
      return to("/find/result");
    }
  }
  if (lookup.registryEntityNumber && hasRegistrySearch(lookup.stateCode)) {
    await linkRegistryRecord(user.id, businessId, lookup.stateCode, lookup.registryEntityNumber);
  }
  await clearPendingLookup();
  await clearLookupHomeJurisdiction();
  return to(`/dashboard/services/annual-report?state=${lookup.stateCode}&type=${type}&business=${businessId}`);
}
