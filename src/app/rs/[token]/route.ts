import { NextResponse, type NextRequest } from "next/server";
import { trackServer } from "@/lib/analytics/server";
import { parseAttribution } from "@/lib/analytics/attribution";
import { lookupSchema, setPendingLookup } from "@/lib/lookup/pending";
import { getPaRecord } from "@/lib/registry/pa-open-data";
import { lookupForReminderLink } from "@/lib/reminders/subscribers";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";

export const dynamic = "force-dynamic";

/**
 * Link in a subscriber reminder email. Verifies the signed token, restores that business's
 * lookup (re-reading Pennsylvania's register when it came from there) and opens the usual
 * result page, tagged as a reminder visit. Any failure falls back to the normal lookup.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/rs/[token]">) {
  const { token } = await ctx.params;
  const result = new URL("/find/result?utm_source=reminder&utm_medium=email&utm_campaign=subscriber_reminder", request.nextUrl.origin);
  const fallback = new URL("/find?utm_source=reminder&utm_medium=email&utm_campaign=subscriber_reminder", request.nextUrl.origin);
  const ip = (await clientIpHash()) ?? "unknown";
  if (!(await rateLimit(`reminder-link:${ip}`, 30, 60))) return NextResponse.redirect(fallback, { status: 303 });
  const sub = await lookupForReminderLink(token).catch(() => null);
  if (!sub) return NextResponse.redirect(fallback, { status: 303 });

  await trackServer("reminder_clicked", {
    stateCode: sub.state_code,
    entityType: sub.entity_type,
    attribution: parseAttribution(sub.attribution ? JSON.stringify(sub.attribution) : null),
    properties: { channel: "subscriber" },
  });

  let value: unknown = {
    stateCode: sub.state_code,
    entityType: sub.entity_type,
    legalName: sub.legal_name,
    formationDate: sub.formation_date,
    entityNumber: sub.entity_number,
    isForeign: sub.is_foreign,
    isNonprofit: sub.is_nonprofit,
    alreadyFiledThisYear: false,
  };
  if (sub.state_code === "PA" && sub.entity_number && /^\d{1,10}$/.test(sub.entity_number)) {
    const record = await getPaRecord(sub.entity_number).catch(() => null);
    if (record?.entityType === sub.entity_type) {
      value = { ...(value as object), legalName: record.name, formationDate: record.formationDate, entityNumber: record.entityNumber, registryEntityNumber: record.entityNumber };
    }
  }
  const parsed = lookupSchema.safeParse(value);
  if (!parsed.success) return NextResponse.redirect(fallback, { status: 303 });
  await setPendingLookup(parsed.data);
  return NextResponse.redirect(result, { status: 303 });
}
