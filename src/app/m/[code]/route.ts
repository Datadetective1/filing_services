import { NextResponse, type NextRequest } from "next/server";
import { trackServer } from "@/lib/analytics/server";
import { findRule } from "@/lib/compliance/registry";
import { lookupSchema, setPendingLookup } from "@/lib/lookup/pending";
import { verifyLandingCode } from "@/lib/outreach/mail-codes";
import { getPaRecord } from "@/lib/registry/pa-open-data";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";
import { markMailEvent } from "@/lib/outreach/mail-cohort";
import { MAIL_COOKIE } from "@/lib/outreach/mail-codes";

export const dynamic = "force-dynamic";

/**
 * Landing for the printed URL on a postcard (getfilewell.com/m/<code>). Verifies the signed
 * code, records the visit, re-reads that entity from Pennsylvania's register server-side and
 * opens the usual result page for it. Any failure falls back to the normal lookup.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/m/[code]">) {
  const { code } = await ctx.params;
  const fallback = new URL("/find?state=PA", request.nextUrl.origin);
  const verified = verifyLandingCode(code);
  const ip = (await clientIpHash()) ?? "unknown";
  if (!verified || !(await rateLimit(`mail-landing:${ip}`, 30, 60))) return NextResponse.redirect(fallback, { status: 303 });

  await markMailEvent(verified, "visit");
  await trackServer("outreach_clicked", { stateCode: "PA", properties: { channel: "mail", campaign: verified.campaignShort } });

  try {
    const record = await getPaRecord(verified.entityNumber);
    if (!record?.entityType || !findRule("PA", record.entityType, "annual_report", Boolean(record.isForeign))) {
      return NextResponse.redirect(fallback, { status: 303 });
    }
    const parsed = lookupSchema.safeParse({
      stateCode: "PA",
      entityType: record.entityType,
      legalName: record.name,
      formationDate: record.formationDate,
      entityNumber: record.entityNumber,
      isForeign: Boolean(record.isForeign),
      isNonprofit: record.isNonprofit,
      alreadyFiledThisYear: false,
      registryEntityNumber: record.entityNumber,
    });
    if (!parsed.success) return NextResponse.redirect(fallback, { status: 303 });
    await setPendingLookup(parsed.data);
    const res = NextResponse.redirect(new URL(`/find/result?from=mail&c=${verified.campaignShort}`, request.nextUrl.origin), { status: 303 });
    // The signed code itself; read back on the result page and at "start filing" to attribute the funnel.
    res.cookies.set(MAIL_COOKIE, code, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  } catch {
    return NextResponse.redirect(fallback, { status: 303 });
  }
}
