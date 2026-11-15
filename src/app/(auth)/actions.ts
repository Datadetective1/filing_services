"use server";

import { redirect } from "next/navigation";
import { clearAfterAuth, pickAfterAuth, readAfterAuth, rememberAfterAuth } from "@/lib/auth/after-auth";
import { z } from "zod";
import { absoluteUrl } from "@/config/site";
import { safeNextPath } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; fieldErrors?: Record<string, string>; message?: string } | undefined;

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254));
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use 128 characters or fewer")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

async function throttle(bucket: string, limit: number): Promise<boolean> {
  const ip = (await clientIpHash()) ?? "unknown";
  return rateLimit(`auth:${bucket}:${ip}`, limit, 60);
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email, password, fullName: z.string().trim().max(200).optional() })
    .safeParse({ email: formData.get("email"), password: formData.get("password"), fullName: formData.get("fullName") || undefined });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!(await throttle("signup", 5))) return { error: "Too many attempts. Please wait a minute and try again." };

  const next = safeNextPath(String(formData.get("next") ?? ""), "/dashboard");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(next)}`),
      data: parsed.data.fullName ? { full_name: parsed.data.fullName } : undefined,
    },
  });
  // Don't reveal whether an account already exists.
  if (error && !/already registered/i.test(error.message)) {
    return { error: error.message.includes("rate") ? "Too many attempts. Please try again shortly." : "We couldn't create your account. Please try again." };
  }
  await rememberAfterAuth(next);
  redirect(`/check-email?email=1&next=${encodeURIComponent(next)}`);
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Enter your password").max(128) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!(await throttle("signin", 10))) return { error: "Too many attempts. Please wait a minute and try again." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/confirm/i.test(error.message)) return { error: "Please confirm your email address first. Check your inbox for the link." };
    return { error: "That email and password don't match." };
  }
  const target = pickAfterAuth(safeNextPath(String(formData.get("next") ?? ""), "/dashboard"), await readAfterAuth());
  await clearAfterAuth();
  redirect(target);
}

/**
 * Email a one-time sign-in link, no password needed. New emails get an account on first use,
 * so a customer can go from an order page to checkout without choosing a password. The link
 * goes through /auth/confirm (PKCE), so it only signs in the browser that asked for it.
 */
export async function sendSignInLink(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!(await throttle("link", 5))) return { error: "Too many attempts. Please wait a minute and try again." };
  const next = safeNextPath(String(formData.get("next") ?? ""), "/dashboard");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(next)}`), shouldCreateUser: true },
  });
  if (error) {
    return { error: /rate|seconds/i.test(error.message) ? "Too many attempts. Please try again shortly." : "We couldn't send the link. Please try again." };
  }
  await rememberAfterAuth(next);
  redirect(`/check-email?link=1&next=${encodeURIComponent(next)}`);
}

export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!(await throttle("reset", 5))) return { error: "Too many attempts. Please wait a minute and try again." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: absoluteUrl("/auth/confirm?next=/reset-password"),
  });
  // Same response whether or not the account exists.
  return { message: "If an account exists for that email, we've sent a link to reset your password." };
}

export async function updatePassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "We couldn't update your password. Try a different one." };
  redirect("/dashboard?password=updated");
}

/**
 * Start an order with just an email, no password and no confirmation first. Signs this
 * browser in as a guest (a Supabase anonymous user, so every row it creates is owned and
 * protected exactly like a normal account's), keeps the email as the order contact, and
 * asks Supabase to attach it to the account: the "confirm your email" message that follows
 * is how the customer keeps access later, but nothing waits on it.
 *
 * An email that already has an account is never attached to a guest: that customer signs
 * in instead. Where guest sign-in is off in Supabase, it falls back to the normal sign-up.
 */
export async function continueAsGuest(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!(await throttle("guest", 5))) return { error: "Too many attempts. Please wait a minute and try again." };
  const next = safeNextPath(String(formData.get("next") ?? ""), "/dashboard");
  const supabase = await createClient();

  const { data: current } = await supabase.auth.getUser();
  if (current.user && !current.user.is_anonymous) redirect(orderStep(next));

  const db = createAdminClient();
  // An existing customer gets a sign-in link instead, so their orders stay in one account and
  // a guest can never take over an email that belongs to someone else.
  let existing = db.from("profiles").select("id").eq("email", parsed.data.email).limit(1);
  if (current.user) existing = existing.neq("id", current.user.id);
  const { data: taken } = await existing;
  if (taken && taken.length > 0) {
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(next)}`), shouldCreateUser: false },
    });
    if (error) return { error: "We couldn't send your sign-in link. Please try again." };
    await rememberAfterAuth(next);
    redirect(`/check-email?link=1&next=${encodeURIComponent(next)}`);
  }

  let userId = current.user?.id;
  if (!userId) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      // Guest sign-in is off (or failing): the normal account path still works.
      redirect(`/signup?guest=off&next=${encodeURIComponent(next)}`);
    }
    userId = data.user.id;
  }

  // Links the email to the account once the customer confirms it. An email another account
  // already uses is never attached: that customer gets a sign-in link instead.
  const { error: emailError } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: absoluteUrl("/auth/confirm?next=/dashboard") },
  );
  if (emailError && /already|exists|registered/i.test(emailError.message)) {
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(next)}`), shouldCreateUser: false },
    });
    if (error) return { error: "We couldn't send your sign-in link. Please try again." };
    await rememberAfterAuth(next);
    redirect(`/check-email?link=1&next=${encodeURIComponent(next)}`);
  }
  const { error: profileError } = await db.from("profiles").update({ email: parsed.data.email }).eq("id", userId);
  if (profileError) return { error: "We couldn't save your email. Please try again." };
  redirect(orderStep(next));
}

/** An annual report order skips the separate confirm page: the email is the only stop. */
function orderStep(next: string): string {
  return next === "/file/start" ? "/file/start/go" : next;
}
