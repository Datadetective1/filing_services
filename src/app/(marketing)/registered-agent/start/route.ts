import { NextResponse, type NextRequest } from "next/server";
import { getJurisdiction } from "@/lib/compliance/registry";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { getCurrentUser } from "@/lib/auth/session";
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
  // A router prefetch must not set the cookie: only a real visit does.
  if (request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch") return new NextResponse(null, { status: 204 });
  if (request.nextUrl.searchParams.get("for") === "new") {
    // Forming a new business: nothing to look up. A new visitor creates an account first,
    // a signed-in one goes straight to the order.
    await setServiceIntent("registered_agent");
    const order = "/dashboard/services/new-business";
    const dest = (await getCurrentUser()) ? order : `/signup?next=${encodeURIComponent(order)}`;
    return NextResponse.redirect(new URL(dest, request.url));
  }
  const state = request.nextUrl.searchParams.get("state")?.toUpperCase() ?? "";
  if (/^[A-Z]{2}$/.test(state) && getJurisdiction(state)) url.searchParams.set("state", state);
  await setServiceIntent("registered_agent");
  return NextResponse.redirect(url);
}
