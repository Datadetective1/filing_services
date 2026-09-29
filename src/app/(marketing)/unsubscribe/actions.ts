"use server";

import { z } from "zod";
import { optOutOfReminders } from "./_lib/opt-out";

export type UnsubscribeState = { status?: "done" | "invalid"; error?: string } | undefined;

const tokenSchema = z.string().trim().min(1).max(4096);

/**
 * Confirm button on /unsubscribe. There is no session here: the signed token from
 * the email is the credential, and it is re-verified on the server on every call.
 */
export async function confirmUnsubscribeAction(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const parsed = tokenSchema.safeParse(formData.get("token"));
  if (!parsed.success) return { status: "invalid" };
  try {
    const result = await optOutOfReminders(parsed.data);
    return result === "invalid" ? { status: "invalid" } : { status: "done" };
  } catch {
    return { error: "We couldn't update your preferences just now. Please try again in a moment." };
  }
}
