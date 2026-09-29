import { NextResponse, type NextRequest } from "next/server";
import { optOutOfReminders } from "@/app/(marketing)/unsubscribe/_lib/opt-out";

export const dynamic = "force-dynamic";

const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

/**
 * RFC 8058 one-click unsubscribe (the List-Unsubscribe-Post target in reminder
 * emails). Mail providers POST here cross-origin, so there is no Origin check: the
 * signed token is the credential, and the only effect is the idempotent reminder
 * opt-out. Nothing else can be triggered from this endpoint.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  try {
    const result = await optOutOfReminders(token);
    if (result === "invalid") {
      return new NextResponse("This unsubscribe link is invalid or has expired.", { status: 400, headers: TEXT_HEADERS });
    }
    return new NextResponse("You have been unsubscribed from deadline reminder emails.", { status: 200, headers: TEXT_HEADERS });
  } catch {
    return new NextResponse("We couldn't update your preferences right now. Please try again later.", {
      status: 500,
      headers: TEXT_HEADERS,
    });
  }
}

/** A plain visit (for example, a mail client opening the link) goes to the confirmation page. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const target = request.nextUrl.clone();
  target.pathname = "/unsubscribe";
  target.search = "";
  if (token) target.searchParams.set("token", token);
  const res = NextResponse.redirect(target, { status: 303 });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
