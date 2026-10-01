import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runReminderCycle } from "@/lib/reminders/engine";
import { runSubscriberReminderCycle } from "@/lib/reminders/subscribers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily reminder cycle. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok =
    !!secret && header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runReminderCycle();
  // Voluntary (non-customer) subscribers; a failure here never affects customer reminders.
  const subscribers = await runSubscriberReminderCycle().catch(() => null);
  return NextResponse.json({ ok: true, summary, subscribers });
}
