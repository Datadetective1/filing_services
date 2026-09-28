import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth/session";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null, "/dashboard");
  const confirmed = sp.confirmed === "1";
  const failed = sp.error === "link";
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-[15px] text-muted">Track your filings, deadlines and documents.</p>
      </div>
      {confirmed ? <p role="status" className="rounded-[var(--radius-surface)] bg-accent-soft px-4 py-3 text-sm text-accent-soft-fg">Email confirmed. Sign in to continue.</p> : null}
      {failed ? <p role="alert" className="rounded-[var(--radius-surface)] bg-danger-soft px-4 py-3 text-sm text-danger">That link is invalid or has expired. Sign in or request a new link.</p> : null}
      <SignInForm next={next} />
      <p className="text-sm text-muted">
        New here?{" "}
        <Link className="font-medium text-fg underline underline-offset-4" href={`/signup?next=${encodeURIComponent(next)}`}>
          Create an account
        </Link>
      </p>
    </div>
  );
}
