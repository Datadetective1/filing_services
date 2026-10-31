import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth/session";
import { textLinkClasses } from "@/components/ui/button";
import { SignUpForm } from "../auth-forms";
import { authLede, authTitle } from "../styles";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null, "/dashboard");
  const forAgent = next.startsWith("/dashboard/services/");
  return (
    <div className="grid gap-7">
      <div className="grid gap-2">
        <h1 className={authTitle}>Create your account</h1>
        <p className={authLede}>
          {forAgent
            ? "Create an account to order your registered agent. We'll email you a link to confirm your address, and it brings you back to your order."
            : "Keep your filings and deadlines in one place. We'll email you a link to confirm your address."}
        </p>
      </div>
      <SignUpForm next={next} />
      <p className="text-[15px] text-muted">
        Already have an account?{" "}
        <Link className={textLinkClasses} href={`/login?next=${encodeURIComponent(next)}`}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
