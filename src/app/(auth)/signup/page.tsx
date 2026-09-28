import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth/session";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null, "/dashboard");
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-[15px] text-muted">We&apos;ll email you a link to confirm your address.</p>
      </div>
      <SignUpForm next={next} />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-medium text-fg underline underline-offset-4" href={`/login?next=${encodeURIComponent(next)}`}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
