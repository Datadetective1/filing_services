import { CheckCircle, Flask, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/domain/money";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import { cancelTest, declineTest, payTest } from "./actions";
import { SANDBOX_SESSION_RE, lineItemsOf, loadOwnedSession, localPath, sandboxProvider } from "./session";

export const metadata: Metadata = {
  title: "Test checkout",
  robots: { index: false, follow: false },
};

export default async function SandboxCheckoutPage({ params, searchParams }: PageProps<"/sandbox/checkout/[sessionId]">) {
  const { sessionId } = await params;
  const sp = await searchParams;
  if (!sandboxProvider()) notFound();
  if (!SANDBOX_SESSION_RE.test(sessionId)) notFound();
  const user = await requireUser(`/sandbox/checkout/${sessionId}`);
  const session = await loadOwnedSession(user.id, sessionId);
  if (!session) notFound();

  const items = lineItemsOf(session);
  const returnPath = localPath(session.success_url, "/dashboard");
  const cancelPath = localPath(session.cancel_url, "/dashboard");

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-[var(--radius-surface)] border-2 border-dashed border-warning/40 bg-surface shadow-card">
        <div className="grid gap-1 border-b border-dashed border-border-strong px-5 py-6 sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[11px] uppercase leading-5 tracking-wider text-subtle">
              Simulated checkout
              <span className="block">Pay {site.name}</span>
            </p>
            <span
              aria-hidden
              className="shrink-0 rotate-[6deg] rounded-[4px] border-2 border-warning px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warning"
            >
              Test only
            </span>
          </div>
          <p className="tnum mt-2 font-display text-[40px] font-semibold leading-none tracking-tight text-fg">{formatCents(session.amount_cents)}</p>
          {session.customer_email ? <p className="mt-1 text-sm text-subtle [overflow-wrap:anywhere]">{session.customer_email}</p> : null}
        </div>

        <div className="px-5 py-5 sm:px-7">
          <h1 className="sr-only">Test checkout</h1>
          <ul className="grid gap-3 text-[15px]">
            {items.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4">
                <span className="text-muted">{item.name}</span>
                <span className="tnum font-medium text-fg">{formatCents(item.amountCents)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <span className="font-semibold text-fg">Total</span>
            <span className="tnum text-lg font-semibold text-fg">{formatCents(session.amount_cents)}</span>
          </div>
        </div>

        <div className="grid gap-3 border-t border-border bg-warning-soft/50 px-5 py-5 sm:px-7">
          {sp.error === "1" ? (
            <Notice tone="danger" role="alert" title="The simulated payment couldn't be processed">
              Check the server logs, then try again.
            </Notice>
          ) : null}

          {session.status === "open" ? (
            <>
              <p className="flex items-start gap-2 text-sm leading-6 text-fg">
                <Flask size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-warning" />
                This page simulates a hosted checkout. There are no card fields and nothing is charged.
              </p>
              <form action={payTest.bind(null, session.id)}>
                <SubmitButton size="lg" className="w-full" pendingLabel="Processing…">
                  Pay (test)
                </SubmitButton>
              </form>
              <form action={declineTest.bind(null, session.id)}>
                <SubmitButton variant="secondary" size="lg" className="w-full" pendingLabel="Simulating…">
                  Simulate a declined card
                </SubmitButton>
              </form>
              <form action={cancelTest.bind(null, session.id)}>
                <SubmitButton variant="ghost" size="lg" className="w-full" pendingLabel="Returning…">
                  Cancel
                </SubmitButton>
              </form>
            </>
          ) : session.status === "completed" ? (
            <>
              <p className="flex items-center gap-2 text-[15px] font-medium text-fg">
                <CheckCircle size={20} weight="fill" className="text-accent" aria-hidden />
                This test payment is complete.
              </p>
              <ButtonLink href={`${returnPath}${returnPath.includes("?") ? "&" : "?"}session_id=${encodeURIComponent(session.id)}`} size="lg">
                Return to {site.name}
              </ButtonLink>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-[15px] font-medium text-fg">
                <XCircle size={20} weight="fill" className="text-muted" aria-hidden />
                {session.status === "failed" ? "This test payment was declined." : "This checkout session has expired."}
              </p>
              <ButtonLink href={cancelPath} variant="secondary" size="lg">
                Return to {site.name}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
