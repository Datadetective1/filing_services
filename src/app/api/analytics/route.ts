import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { AnalyticsEvent } from "@/lib/analytics/events";
import { trackServer } from "@/lib/analytics/server";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash, isSameOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";

/** Events the browser may report. Money/status events are recorded server-side only. */
const CLIENT_EVENTS = [
  "visit_started",
  "landing_viewed",
  "state_page_viewed",
  "lookup_started",
  "lookup_completed",
  "filing_cta_clicked",
  "checkout_cancelled",
] as const satisfies readonly AnalyticsEvent[];

const body = z.object({
  event: z.enum(CLIENT_EVENTS),
  anonymousId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/).nullable().optional(),
  path: z.string().max(300).optional(),
  stateCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  entityType: z.string().max(40).optional(),
});

/** First-party analytics ingest. No IPs or user agents are stored. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const ip = (await clientIpHash()) ?? "unknown";
  if (!(await rateLimit(`analytics:${ip}`, 120, 60))) return new NextResponse(null, { status: 429 });
  let json: unknown;
  try {
    json = JSON.parse((await request.text()).slice(0, 4096));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const user = await getCurrentUser().catch(() => null);
  await trackServer(parsed.data.event, {
    userId: user?.id ?? null,
    anonymousId: parsed.data.anonymousId ?? null,
    path: parsed.data.path?.split("?")[0] ?? null,
    stateCode: parsed.data.stateCode ?? null,
    entityType: parsed.data.entityType ?? null,
    // Browser-reported and unauthenticated: the funnel can tell these apart from server-attested steps.
    properties: { source: "client" },
  });
  return new NextResponse(null, { status: 204 });
}
