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
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-lg rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card sm:p-8">
        {valid && value ? <UnsubscribeConfirm token={value} /> : <InvalidLink />}
      </div>
    </Container>
  );
}
