import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { loadCohort } from "@/lib/outreach/mail-cohort";
import { postcardForRow } from "@/lib/outreach/mail-service";
import { postcardBackHtml, postcardFrontHtml } from "@/lib/outreach/postcard";

export const dynamic = "force-dynamic";

/** Admin-only print HTML for one side of one selected card (?send=<id>&side=front|back). */
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/outreach/[id]/card">) {
  await requireAdmin();
  const { id } = await ctx.params;
  const sendId = request.nextUrl.searchParams.get("send") ?? "";
  const side = request.nextUrl.searchParams.get("side") === "back" ? "back" : "front";
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const row = (await loadCohort(id)).find((r) => r.selected && (r.sendId === sendId || !sendId));
  if (!row?.landingUrl) return new NextResponse("Not found", { status: 404 });
  const copy = postcardForRow(row);
  const html = side === "front" ? postcardFrontHtml(copy) : postcardBackHtml(copy, `${row.landingUrl}/qr.png`);
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
