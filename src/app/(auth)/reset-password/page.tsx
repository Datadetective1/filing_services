import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "../auth-forms";
import { authLede, authTitle } from "../styles";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // Reached through /auth/confirm, which establishes a short-lived recovery session.
  const user = await getCurrentUser();
  if (!user) redirect("/forgot-password");
  return (
    <div className="grid gap-7">
      <div className="grid gap-2">
        <h1 className={authTitle}>Choose a new password</h1>
        <p className={`${authLede} [overflow-wrap:anywhere]`}>For {user.email}</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
