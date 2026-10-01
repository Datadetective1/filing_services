import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeOutreach } from "@/lib/outreach/unsubscribe";

export const dynamic = "force-dynamic";

const TEXT = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } as const;

/**
 * RFC 8058 one-click unsubscribe for outreach emails (List-Unsubscribe-Post target). Mail
 * providers POST cross-origin; the signed token is the credential and the only effect is
 * adding the address to the do-not-contact list.
 */
export async function POST(request: NextRequest) {
  const r = await unsubscribeOutreach(request.nextUrl.searchParams.get("t")).catch(() => "error" as const);
  if (r === "invalid") return new NextResponse("This unsubscribe link is invalid.", { status: 400, headers: TEXT });
  if (r === "error") return new NextResponse("Please try again later.", { status: 500, headers: TEXT });
  return new NextResponse("You have been unsubscribed from Filewell emails.", { status: 200, headers: TEXT });
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.clone();
  target.pathname = "/outreach/unsubscribe";
  return NextResponse.redirect(target, { status: 303 });
}
