import { EnvelopeSimpleOpen } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { textLinkClasses } from "@/components/ui/button";
import { authLede, authTitle } from "../styles";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const sp = await searchParams;
  const signInLink = sp.link === "1";
  return (
    <div className="grid gap-6">
      <span className="grid size-14 place-items-center rounded-full bg-highlight-soft text-highlight-fg" aria-hidden>
        <EnvelopeSimpleOpen size={28} weight="fill" />
      </span>
      <div className="grid gap-2">
        <h1 className={authTitle}>Check your email</h1>
        <p className={authLede}>
          {signInLink
            ? "We sent you a sign-in link. Open it on this device and it signs you in where you left off."
            : "We sent you a link to confirm your email address. Open it on this device to continue where you left off."}
        </p>
      </div>
      <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3.5 text-[15px] leading-6 text-muted">
        Didn&apos;t get it? Check your spam folder, or{" "}
        <Link className={textLinkClasses} href={signInLink ? "/login" : "/signup"}>
          try again
        </Link>
        .
      </p>
    </div>
  );
}
