import { NextResponse, type NextRequest } from "next/server";
import { isEntityType } from "@/lib/domain/types";
import { clearServiceIntent } from "@/lib/services/intent";

export const dynamic = "force-dynamic";

/**
 * "Here for an annual report instead?": a visitor who opened the registered agent order earlier
 * keeps that choice for a day, which turns the lookup into the agent order. This forgets it and
 * reopens the lookup (or the result they already have) for the annual report.
 */
export async function GET(request: NextRequest) {
  const toResult = request.nextUrl.searchParams.get("next") === "result";
  const url = new URL(toResult ? "/find/result" : "/find", request.url);
  // Keep the state the visitor already picked (two letters only; /find ignores unknown codes).
  const state = request.nextUrl.searchParams.get("state")?.toUpperCase();
  if (!toResult && state && /^[A-Z]{2}$/.test(state)) url.searchParams.set("state", state);
  // And the entity type a state page's button was for (known types only).
  const entity = request.nextUrl.searchParams.get("entity");
  if (!toResult && isEntityType(entity)) url.searchParams.set("entity", entity);
  // A router prefetch must not change the cookie: only a real visit does.
  if (request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch") return new NextResponse(null, { status: 204 });
  await clearServiceIntent();
  return NextResponse.redirect(url);
}
