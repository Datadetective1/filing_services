import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { startOrderFromLookup } from "../start-order";

/**
 * One step from "Have us file it" to the order form: a new guest lands here right after
 * giving their email, and the order starts at once instead of on a separate confirm page.
 * Anything unusual (no lookup, an error) falls back to the confirm page, which explains it.
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const user = await getCurrentUser();
  if (!user || (user.isGuest && !user.email)) return to(`/signup?next=${encodeURIComponent("/file/start")}`);
  const outcome = await startOrderFromLookup(user, "file");
  return to("to" in outcome ? outcome.to : "/file/start");
}
