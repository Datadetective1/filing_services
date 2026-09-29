import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

export type StaffRole = "operator" | "admin";

export interface StaffUser extends SessionUser {
  role: StaffRole;
  displayName: string | null;
}

/**
 * The verified current user. Uses getUser(), which validates the session with the
 * Auth server, rather than trusting cookie contents.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  };
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/**
 * Staff role comes from the staff_members table (server-side, per request), never
 * from a client flag or a JWT claim — revoking a staff member takes effect at once.
 */
export const getStaff = cache(async (): Promise<StaffUser | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("role, display_name, active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data || !data.active) return null;
  return { ...user, role: data.role as StaffRole, displayName: data.display_name };
});

/** For admin pages and actions. Non-staff get a 404 so the console's existence isn't revealed. */
export async function requireStaff(): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  const staff = await getStaff();
  if (!staff) notFound();
  return staff;
}

export async function requireAdmin(): Promise<StaffUser> {
  const staff = await requireStaff();
  if (staff.role !== "admin") notFound();
  return staff;
}

/** Validate a post-login redirect target: same-origin relative paths only. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  if (next.length > 300) return fallback;
  // Browsers and the WHATWG URL parser strip ASCII tab/CR/LF ("/\t/evil.com" becomes "//evil.com"),
  // so reject every control character, all whitespace and any backslash outright.
  if (/[\u0000-\u001F\u007F\s\\]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  const base = "https://same-origin.invalid";
  try {
    if (new URL(next, base).origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return next;
}
