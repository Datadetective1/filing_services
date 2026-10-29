import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { alertStaffOfPaymentsNeedingReview } from "@/lib/payments/review-alerts";
import { runServiceCycle } from "@/lib/registered-agent/operations";
import { runReminderCycle } from "@/lib/reminders/engine";
import { runSubscriberReminderCycle } from "@/lib/reminders/subscribers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily reminder cycle, then one staff email per payment flagged for review (at most once a
 * day each). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
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
  // Staff alerts for stuck payments; never throws, and never affects the reminders above.
  const paymentReview = await alertStaffOfPaymentsNeedingReview();
  // Registered agent renewals, provider cancellations and document escalations; never throws.
  // Urgent documents also need the hourly /api/cron/services check (docs/REGISTERED_AGENT.md).
  const services = await runServiceCycle();
  return NextResponse.json({ ok: true, summary, subscribers, paymentReview, services });
}
