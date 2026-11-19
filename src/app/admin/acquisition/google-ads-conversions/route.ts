import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { googleAdsClickId, parseAttribution } from "@/lib/analytics/attribution";
import { cleanConversionName, type ConversionRow, conversionsCsv, UPLOAD_WINDOW_DAYS } from "@/lib/acquisition/google-ads";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Admin-only CSV of live paid orders that came from a Google Ads click, in Google Ads'
 * offline conversion upload format. Download, then upload it in Google Ads under
 * Goals > Conversions > Uploads. Exporting sends nothing anywhere.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  const name = cleanConversionName(request.nextUrl.searchParams.get("name"));
  const since = new Date(Date.now() - UPLOAD_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const db = createAdminClient();
  const { data: orders } = await db
    .from("orders")
    .select("business_id, service_fee_cents, paid_at")
    .in("status", ["paid", "partially_refunded"])
    .eq("payment_mode", "live")
    .gte("paid_at", since)
    .limit(5000);
  const businessIds = [...new Set((orders ?? []).map((o) => o.business_id as string))];
  const clickByBusiness = new Map<string, string>();
  if (businessIds.length) {
    const { data: attrs } = await db.from("business_attribution").select("business_id, attribution").in("business_id", businessIds);
    for (const a of attrs ?? []) {
      const click = googleAdsClickId(parseAttribution(JSON.stringify(a.attribution)));
      if (click) clickByBusiness.set(a.business_id as string, click);
    }
  }
  const rows: ConversionRow[] = [];
  for (const o of orders ?? []) {
    const clickId = clickByBusiness.get(o.business_id as string);
    if (clickId && o.paid_at) rows.push({ clickId, paidAt: String(o.paid_at), valueCents: Number(o.service_fee_cents) });
  }
  await audit({ actorUserId: admin.id, actorType: "staff", action: "acquisition.google_ads_conversions_exported", entityType: "orders", entityId: "google_ads", after: { rows: rows.length } });
  return new NextResponse(conversionsCsv(rows, name), {
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="filewell-google-ads-conversions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
