import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { confirmReminders } from "./actions";

export const metadata: Metadata = {
  title: "Confirm reminders",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Double opt-in. Opening the link changes nothing (mail scanners prefetch links); the
 * subscription starts only when the person clicks the button.
 */
export default async function ConfirmRemindersPage(props: PageProps<"/reminders/confirm">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const done = sp.done;
  return (
    <section className="bg-surface-2">
      <Container className="grid place-items-center py-14 sm:py-24">
        <div className="w-full max-w-lg rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-lift sm:p-9">
          {done === "1" ? (
            <>
              <h1 className="text-2xl font-semibold text-fg">Reminders confirmed</h1>
              <p className="mt-3 text-muted">
                We&apos;ll email you about 60, 30 and 7 days before the next due date. Every email has a one-click unsubscribe.
              </p>
              <Link href="/find" className={`${textLinkClasses} mt-5 inline-block`}>
                Look up another business
              </Link>
            </>
          ) : done === "0" || !t ? (
            <>
              <h1 className="text-2xl font-semibold text-fg">This link isn&apos;t valid</h1>
              <p className="mt-3 text-muted">
                It may have expired or been replaced by a newer one. You can sign up again from{" "}
                <Link href="/find" className={textLinkClasses}>
                  Find my business
                </Link>
                .
              </p>
            </>
          ) : (
            <form action={confirmReminders} className="grid gap-4">
              <h1 className="text-2xl font-semibold text-fg">Confirm your filing reminders</h1>
              <p className="text-muted">
                You&apos;ll get up to three reminders a year for this business&apos;s Pennsylvania annual report, and nothing else.
              </p>
              <input type="hidden" name="t" value={t} />
              <button type="submit" className={buttonClasses("primary", "md", "justify-self-start")}>
                Yes, send me reminders
              </button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
