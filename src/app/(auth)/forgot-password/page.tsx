import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-[15px] text-muted">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
