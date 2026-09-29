import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth/session";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { textLinkClasses } from "@/components/ui/button";
import { SignInForm } from "../auth-forms";
import { authLede, authTitle } from "../styles";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null, "/dashboard");
  const confirmed = sp.confirmed === "1";
  const failed = sp.error === "link";
  return (
    <div className="grid gap-7">
      <div className="grid gap-2">
        <h1 className={authTitle}>Welcome back</h1>
        <p className={authLede}>Sign in to see your filings, deadlines and documents.</p>
      </div>
      {confirmed ? (
        <p role="status" className="flex items-start gap-2 rounded-[var(--radius-control)] border border-accent/25 bg-accent-soft px-4 py-3 text-sm text-accent-soft-fg">
          <CheckCircle size={18} weight="fill" aria-hidden className="mt-px shrink-0" />
          Email confirmed. Sign in to continue.
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="rounded-[var(--radius-control)] border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          That link is invalid or has expired. Sign in or request a new link.
        </p>
      ) : null}
      <SignInForm next={next} />
      <p className="text-[15px] text-muted">
        New here?{" "}
        <Link className={textLinkClasses} href={`/signup?next=${encodeURIComponent(next)}`}>
          Create an account
        </Link>
      </p>
    </div>
  );
}
