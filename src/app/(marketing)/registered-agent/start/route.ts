import { NextResponse, type NextRequest } from "next/server";
import { getJurisdiction } from "@/lib/compliance/registry";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { setServiceIntent } from "@/lib/services/intent";

export const dynamic = "force-dynamic";

/**
 * "Get a registered agent" from a public page: remember that's why the visitor came, then
 * open the business lookup with their state already chosen. After the lookup (and signup if
 * needed) they land on the registered agent order with their business filled in.
 */
export async function GET(request: NextRequest) {
  const url = new URL("/find", request.url);
  if (!businessServicesPagesEnabled()) return NextResponse.redirect(url);
  const state = request.nextUrl.searchParams.get("state")?.toUpperCase() ?? "";
  if (/^[A-Z]{2}$/.test(state) && getJurisdiction(state)) url.searchParams.set("state", state);
  await setServiceIntent("registered_agent");
  return NextResponse.redirect(url);
}
