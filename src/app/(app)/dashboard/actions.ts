"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { customerReply, FilingError, markFiledElsewhere, startFiling } from "@/lib/filings/customer";
import { createClient } from "@/lib/supabase/server";
import { FILE_STEPS } from "@/components/dashboard/steps";

/**
 * Customer dashboard actions. Each one re-authorizes the user, validates input with
 * zod, and confirms the record belongs to the user before calling a filing service.
 * Hidden form fields are never trusted for ownership.
 */

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid id");

/** Where to send the customer back to. Navigation only, restricted to dashboard pages. */
const returnTo = z
  .string()
  .regex(/^\/dashboard(\/businesses\/[0-9a-f-]{36})?$/i)
  .catch("/dashboard");

function withParam(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

async function ownsBusiness(userId: string, businessId: string): Promise<boolean> {
  const db = await createClient();
  const { data } = await db
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

/** "Have us file it": create (or reuse) the draft filing, then open the intake. */
export async function startFilingAction(formData: FormData): Promise<void> {
  const user = await requireUser("/dashboard");
  const parsed = z
    .object({ businessId: uuid, returnTo })
    .safeParse({ businessId: formData.get("businessId"), returnTo: formData.get("returnTo") ?? undefined });
  if (!parsed.success) redirect("/dashboard?error=invalid");
  const back = parsed.data.returnTo;

  if (!(await ownsBusiness(user.id, parsed.data.businessId))) redirect(withParam(back, "error", "not_found"));

  let filingId: string | null = null;
  let errorCode: string | null = null;
  try {
    filingId = await startFiling(user, parsed.data.businessId);
  } catch (error) {
    errorCode = error instanceof FilingError ? `start_${error.code}` : "start_error";
  }
  if (!filingId) redirect(withParam(back, "error", errorCode ?? "start_error"));
  redirect(FILE_STEPS.details(filingId));
}

/** "Mark as already filed": the customer filed this period on their own. */
export async function markFiledElsewhereAction(formData: FormData): Promise<void> {
  const user = await requireUser("/dashboard");
  const parsed = z
    .object({ requirementId: uuid, returnTo })
    .safeParse({ requirementId: formData.get("requirementId"), returnTo: formData.get("returnTo") ?? undefined });
  if (!parsed.success) redirect("/dashboard?error=invalid");
  const back = parsed.data.returnTo;

  const db = await createClient();
  const { data: requirement } = await db
    .from("filing_requirements")
    .select("id, status")
    .eq("id", parsed.data.requirementId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!requirement) redirect(withParam(back, "error", "not_found"));

  let errorCode: string | null = null;
  try {
    await markFiledElsewhere(user, parsed.data.requirementId);
  } catch (error) {
    errorCode = error instanceof FilingError && error.code === "not_allowed" ? "already_handling" : "mark_error";
  }
  if (errorCode) redirect(withParam(back, "error", errorCode));
  redirect(withParam(back, "marked", "1"));
}

export type ReplyState = { ok?: boolean; error?: string; fieldError?: string; sentAt?: number } | undefined;

const replySchema = z.object({
  body: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, "Write a message before sending.")
        .max(5000, "Messages can be up to 5,000 characters."),
    ),
});

/** Reply in a filing's message thread. The filing id is bound on the server. */
export async function replyToFilingAction(filingId: string, _prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const user = await requireUser("/dashboard");
  if (!uuid.safeParse(filingId).success) return { error: "We couldn't find this filing." };
  const parsed = replySchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) return { fieldError: parsed.error.issues[0]?.message ?? "Check your message." };

  const db = await createClient();
  const { data: filing } = await db
    .from("filings")
    .select("id")
    .eq("id", filingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!filing) return { error: "We couldn't find this filing." };

  try {
    await customerReply(user, filingId, parsed.data.body);
  } catch (error) {
    if (error instanceof FilingError && error.code === "not_found") return { error: "We couldn't find this filing." };
    return { error: "Your message wasn't sent. Please try again." };
  }
  refresh();
  return { ok: true, sentAt: Date.now() };
}
