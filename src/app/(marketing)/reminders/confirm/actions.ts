"use server";

import { redirect } from "next/navigation";
import { confirmSubscription } from "@/lib/reminders/subscribers";

export async function confirmReminders(formData: FormData): Promise<void> {
  const r = await confirmSubscription(String(formData.get("t") ?? ""));
  redirect(`/reminders/confirm?done=${r === "confirmed" ? "1" : "0"}`);
}
