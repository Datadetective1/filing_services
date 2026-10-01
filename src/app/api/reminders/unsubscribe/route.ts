import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeReminders } from "@/lib/reminders/subscribers";

export const dynamic = "force-dynamic";

const TEXT = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } as const;

/** RFC 8058 one-click unsubscribe for subscriber reminders. The signed token is the credential. */
export async function POST(request: NextRequest) {
  const r = await unsubscribeReminders(request.nextUrl.searchParams.get("t")).catch(() => "error" as const);
  if (r === "invalid") return new NextResponse("This unsubscribe link is invalid.", { status: 400, headers: TEXT });
  if (r === "error") return new NextResponse("Please try again later.", { status: 500, headers: TEXT });
  return new NextResponse("You have been unsubscribed from Filewell filing reminders.", { status: 200, headers: TEXT });
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.clone();
  target.pathname = "/reminders/unsubscribe";
  return NextResponse.redirect(target, { status: 303 });
}
