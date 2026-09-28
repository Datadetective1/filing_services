import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
      <p className="text-[15px] text-muted">
        We sent you a link to confirm your email address. Open it on this device to continue where you left off.
      </p>
      <p className="text-sm text-muted">
        Didn&apos;t get it? Check your spam folder, or{" "}
        <Link className="font-medium text-fg underline underline-offset-4" href="/signup">
          try again
        </Link>
        .
      </p>
    </div>
  );
}
