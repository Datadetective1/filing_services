import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { findExistingBusiness } from "@/lib/filings/find-existing";
import { clearPendingLookup, readPendingLookup } from "@/lib/lookup/pending";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { addBusinessForService } from "@/lib/services/business";
import { clearServiceIntent } from "@/lib/services/intent";
import { clearLookupHomeJurisdiction, readLookupHomeJurisdiction } from "@/app/(marketing)/find/lookup-extras";

export const dynamic = "force-dynamic";

/**
 * After the lookup (and signup), turn the business the visitor looked up into a business on
 * their account, or reuse the one they already have, and open its registered agent order.
 * Nothing is charged or started here; the order page shows the price before anything else.
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  // A router prefetch must never create anything: only a real visit does.
  if (request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch") return new NextResponse(null, { status: 204 });
  const user = await getCurrentUser();
  if (!user) return to(`/login?next=${encodeURIComponent("/dashboard/services/start")}`);
  if (!businessServicesPagesEnabled()) return to("/dashboard");
  const lookup = await readPendingLookup();
  // Confirmed the email on another device: the lookup stayed in the first browser, so look it up again.
  if (!lookup) return to("/registered-agent/start");

  let businessId = await findExistingBusiness(user, lookup);
  if (!businessId) {
    try {
      businessId = await addBusinessForService(user, {
        legalName: lookup.legalName,
        stateCode: lookup.stateCode,
        entityType: lookup.entityType,
        isForeign: lookup.isForeign,
        isNonprofit: lookup.isNonprofit,
        formationDate: lookup.formationDate ?? null,
        entityNumber: lookup.entityNumber ?? lookup.registryEntityNumber ?? null,
        homeJurisdiction: lookup.isForeign ? await readLookupHomeJurisdiction() : null,
        alreadyFiledThisYear: lookup.alreadyFiledThisYear,
      });
    } catch (e) {
      console.error("[services] could not add business", e);
      return to("/find/result");
    }
  }
  await clearPendingLookup();
  await clearLookupHomeJurisdiction();
  await clearServiceIntent();
  return to(`/dashboard/services/new?business=${businessId}`);
}
