"use server";

import { redirect } from "next/navigation";
import { unsubscribeReminders } from "@/lib/reminders/subscribers";

export async function confirmReminderUnsubscribe(formData: FormData): Promise<void> {
  const r = await unsubscribeReminders(String(formData.get("t") ?? ""));
  redirect(`/reminders/unsubscribe?done=${r === "ok" ? "1" : "0"}`);
}
