"use server";

import { redirect } from "next/navigation";
import { unsubscribeOutreach } from "@/lib/outreach/unsubscribe";

export async function confirmOutreachUnsubscribe(formData: FormData): Promise<void> {
  const token = String(formData.get("t") ?? "");
  const r = await unsubscribeOutreach(token);
  redirect(`/outreach/unsubscribe?done=${r === "ok" ? "1" : "0"}`);
}
