import type { Metadata } from "next";
import { Container } from "@/components/ui/surface";
import { userIdFromUnsubscribeToken } from "./_lib/opt-out";
import { InvalidLink, UnsubscribeConfirm } from "./confirm-form";

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Confirmation page behind the "Stop deadline reminders" link in reminder emails.
 * Opening the page changes nothing; the opt-out happens only on confirm (mail
 * scanners that prefetch links can't unsubscribe anyone).
 */
export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const { token } = await props.searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  const valid = Boolean(userIdFromUnsubscribeToken(value));

  return (
    <section className="grain bg-surface-2">
      <Container className="grid place-items-center py-14 sm:py-24">
        <div className="relative w-full max-w-lg">
          {/* A small stack of letters behind the card: this page is about your email. */}
          <div aria-hidden className="absolute inset-x-8 -top-3 h-10 rounded-t-[18px] border border-border bg-surface/60" />
          <div aria-hidden className="absolute inset-x-4 -top-1.5 h-10 rounded-t-[18px] border border-border bg-surface/80" />
          <div className="relative rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-lift sm:p-9">
            {valid && value ? <UnsubscribeConfirm token={value} /> : <InvalidLink />}
          </div>
        </div>
      </Container>
    </section>
  );
}
