import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runServiceCycle } from "@/lib/registered-agent/operations";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Registered agent checks (urgent document escalation, renewal reminders, provider
 * cancellations). Safe to run as often as hourly: every message is deduplicated. Callers
 * send `Authorization: Bearer $CRON_SECRET`, like the daily reminders cron.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = !!secret && header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const services = await runServiceCycle();
  return NextResponse.json({ ok: true, services });
}
