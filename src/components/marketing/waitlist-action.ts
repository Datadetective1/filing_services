"use server";

import { z } from "zod";
import { getJurisdiction, isStateVerified } from "@/lib/compliance/registry";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

export type WaitlistState =
  | { ok: true; stateName: string }
  | { ok: false; error?: string; fieldErrors?: { email?: string } }
  | undefined;

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254)),
  stateCode: z.string().regex(/^[A-Z]{2}$/),
  // Honeypot: real visitors never see or fill this field.
  fw_hp: z.string().max(0).optional(),
});

/**
 * Public, unauthenticated waitlist signup for states we haven't verified yet.
 * Validated with zod, rate limited per hashed IP, written with the service role
 * (the waitlist table has no public insert policy). Duplicates are ignored.
 */
export async function joinWaitlist(_: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? ""),
    stateCode: String(formData.get("stateCode") ?? "").toUpperCase(),
    fw_hp: (formData.get("fw_hp") as string | null) ?? undefined,
  });
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.find((i) => i.path[0] === "email");
    if (emailIssue) return { ok: false, fieldErrors: { email: emailIssue.message } };
    const honeypot = parsed.error.issues.some((i) => i.path[0] === "fw_hp");
    // Pretend success to bots; nothing is stored.
    if (honeypot) return { ok: true, stateName: "" };
    return { ok: false, error: "Something went wrong. Please reload the page and try again." };
  }

  const jurisdiction = getJurisdiction(parsed.data.stateCode);
  if (!jurisdiction) return { ok: false, error: "Something went wrong. Please reload the page and try again." };
  if (isStateVerified(jurisdiction.code)) {
    return { ok: false, error: `${jurisdiction.name} is already supported. You can start from the annual report page.` };
  }

  let ip = "unknown";
  try {
    ip = (await clientIpHash()) ?? "unknown";
  } catch {
    ip = "unknown";
  }
  if (!(await rateLimit(`waitlist:${ip}`, 5, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  try {
    const { error } = await createAdminClient()
      .from("waitlist")
      .insert({ email: parsed.data.email, state_code: jurisdiction.code });
    // 23505 = unique_violation: already on the list for this state. Treat as success.
    if (error && error.code !== "23505") {
      return { ok: false, error: "We couldn't save that right now. Please try again later." };
    }
  } catch {
    return { ok: false, error: "We couldn't save that right now. Please try again later." };
  }

  return { ok: true, stateName: jurisdiction.name };
}
