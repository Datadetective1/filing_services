import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // Reached through /auth/confirm, which establishes a short-lived recovery session.
  const user = await getCurrentUser();
  if (!user) redirect("/forgot-password");
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-[15px] text-muted">For {user.email}</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
