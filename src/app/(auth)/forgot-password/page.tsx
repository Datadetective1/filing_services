import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ForgotPasswordForm } from "../auth-forms";
import { authLede, authTitle } from "../styles";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-7">
      <div className="grid gap-2">
        <h1 className={authTitle}>Reset your password</h1>
        <p className={authLede}>Enter your email and we&apos;ll send you a link to choose a new one.</p>
      </div>
      <ForgotPasswordForm />
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-[15px] font-medium text-muted underline decoration-border-strong underline-offset-4 hover:text-fg hover:decoration-fg"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to sign in
      </Link>
    </div>
  );
}
