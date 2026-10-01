import type { Metadata } from "next";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { site } from "@/config/site";
import { emailFromReminderUnsubToken } from "@/lib/reminders/subscribers";
import { confirmReminderUnsubscribe } from "./actions";

export const metadata: Metadata = {
  title: "Stop reminders",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Stop filing reminders. Opening the page changes nothing; one click unsubscribes for good. */
export default async function ReminderUnsubscribePage(props: PageProps<"/reminders/unsubscribe">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const done = sp.done === "1";
  const valid = Boolean(emailFromReminderUnsubToken(t));
  return (
    <section className="bg-surface-2">
      <Container className="grid place-items-center py-14 sm:py-24">
        <div className="w-full max-w-lg rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-lift sm:p-9">
          {done ? (
            <>
              <h1 className="text-2xl font-semibold text-fg">You&apos;re unsubscribed</h1>
              <p className="mt-3 text-muted">
                We won&apos;t send filing reminders to this address again unless you sign up and confirm again yourself.
              </p>
            </>
          ) : valid ? (
            <form action={confirmReminderUnsubscribe} className="grid gap-4">
              <h1 className="text-2xl font-semibold text-fg">Stop filing reminders?</h1>
              <p className="text-muted">This stops every Filewell filing reminder sent to this address.</p>
              <input type="hidden" name="t" value={t} />
              <button type="submit" className={buttonClasses("primary", "md", "justify-self-start")}>
                Unsubscribe
              </button>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-fg">This link isn&apos;t valid</h1>
              <p className="mt-3 text-muted">Reply to any reminder or write to {site.supportEmail} and we&apos;ll stop them.</p>
            </>
          )}
        </div>
      </Container>
    </section>
  );
}
