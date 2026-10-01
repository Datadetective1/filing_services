import type { Metadata } from "next";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { emailFromOutreachToken } from "@/lib/outreach/unsubscribe";
import { confirmOutreachUnsubscribe } from "./actions";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Unsubscribe from Filewell outreach emails. Opening the page changes nothing (mail
 * scanners prefetch links); one click on the button adds the address to the permanent
 * do-not-contact list. No account or extra information is needed.
 */
export default async function OutreachUnsubscribePage(props: PageProps<"/outreach/unsubscribe">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const done = sp.done === "1";
  const valid = Boolean(emailFromOutreachToken(t));
  return (
    <section className="bg-surface-2">
      <Container className="grid place-items-center py-14 sm:py-24">
        <div className="w-full max-w-lg rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-lift sm:p-9">
          {done ? (
            <>
              <h1 className="text-2xl font-semibold text-fg">You&apos;re unsubscribed</h1>
              <p className="mt-3 text-muted">Filewell won&apos;t send marketing emails to this address again.</p>
            </>
          ) : valid ? (
            <form action={confirmOutreachUnsubscribe} className="grid gap-4">
              <h1 className="text-2xl font-semibold text-fg">Stop emails from Filewell?</h1>
              <p className="text-muted">We&apos;ll add this address to our permanent do-not-contact list.</p>
              <input type="hidden" name="t" value={t} />
              <button type="submit" className={buttonClasses("primary", "md", "justify-self-start")}>
                Unsubscribe
              </button>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-fg">This link isn&apos;t valid</h1>
              <p className="mt-3 text-muted">
                Reply to the email or write to support@getfilewell.com and we&apos;ll remove your address.
              </p>
            </>
          )}
        </div>
      </Container>
    </section>
  );
}
