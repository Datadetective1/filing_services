"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { absoluteUrl } from "@/config/site";
import { safeNextPath } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";
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
  redirect(safeNextPath(String(formData.get("next") ?? ""), "/dashboard"));
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
