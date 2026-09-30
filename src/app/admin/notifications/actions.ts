"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/session";
import { sendNotification } from "@/lib/notifications/send";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Send one delivery test to the signed-in staff member, through the same
 * render/record/provider path as customer notifications. Touches no filing,
 * order or payment. Limited to one per staff member every 10 minutes.
 */
export async function sendTestEmailAction(): Promise<void> {
  const staff = await requireStaff();
  if (!(await rateLimit(`email-test:${staff.id}`, 1, 600))) redirect("/admin/notifications?test=limited");
  const result = await sendNotification({
    userId: staff.id,
    templateKey: "staff_email_test",
    dedupeKey: `staff_email_test:${staff.id}:${Date.now()}`,
    vars: {},
  });
  await audit({
    actorUserId: staff.id,
    actorType: "staff",
    action: "email.test_sent",
    entityType: "notification",
    entityId: result.notificationId,
    after: { status: result.status },
  });
  redirect(`/admin/notifications?test=${result.status}`);
}
