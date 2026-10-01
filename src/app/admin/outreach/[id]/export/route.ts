import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { buildMailPilot, mailCsv, postcardForRow } from "@/lib/outreach/mail-service";
import { postcardFrontHtml } from "@/lib/outreach/postcard";
import { createAdminClient } from "@/lib/supabase/admin";
import { COHORT_EXCLUSION_TEXT, type CohortExclusion } from "@/lib/outreach/mail";
import { cohortCsv, loadCohort } from "@/lib/outreach/mail-cohort";

export const dynamic = "force-dynamic";

/**
 * Admin-only export of a postcard pilot: every evaluated business with its exclusion
 * reason, provenance and unique landing URL (CSV), or the print-ready card template with
 * vendor merge fields (?format=html). Exporting buys and sends nothing.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/outreach/[id]/export">) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const { data: campaign } = await createAdminClient().from("marketing_campaigns").select("id, name, channel").eq("id", id).maybeSingle();
  if (!campaign || campaign.channel !== "mail") return new NextResponse("Not found", { status: 404 });

  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (request.nextUrl.searchParams.get("format") === "html") {
    const html = postcardFrontHtml(postcardForRow({ businessName: "Sample Partners LP", entityType: "lp", periodYear: null, landingUrl: "https://www.getfilewell.com/m/sample" }));
    return new NextResponse(html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="filewell-postcard-${id.slice(0, 8)}.html"` } });
  }

  const cohort = await loadCohort(id);
  if (cohort.length) {
    await audit({ actorUserId: admin.id, actorType: "staff", action: "outreach.mail_exported", entityType: "marketing_campaign", entityId: id, after: { rows: cohort.length, selected: cohort.filter((r) => r.selected).length } });
    const text = (r: string) => (r === "eligible_reserve" ? "Eligible, held in reserve" : (COHORT_EXCLUSION_TEXT[r as CohortExclusion] ?? r));
    return new NextResponse(cohortCsv(id, cohort, text), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="filewell-pa-dec31-cohort-${id.slice(0, 8)}.csv"` },
    });
  }
  const rows = await buildMailPilot(id, { persist: false });
  await audit({
    actorUserId: admin.id,
    actorType: "staff",
    action: "outreach.mail_exported",
    entityType: "marketing_campaign",
    entityId: id,
    after: { rows: rows.length, included: rows.filter((r) => r.included).length },
  });
  return new NextResponse(mailCsv(id, rows), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="filewell-pa-dec31-pilot-${id.slice(0, 8)}.csv"` },
  });
}
