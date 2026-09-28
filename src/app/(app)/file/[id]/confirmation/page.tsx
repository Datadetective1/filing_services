import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/domain/money";
import { reconcileCheckoutReturn } from "@/lib/filings/customer";
import { FilingContext } from "@/components/funnel/filing-context";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { PaymentPoller } from "@/components/funnel/payment-poller";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Notice } from "@/components/ui/surface";
import { FILING_ID_RE } from "../../_lib/errors";
import { filingSummary, type LoadedFiling, loadOwnFiling } from "../../_lib/filing";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

export default async function FilingConfirmationPage({ params, searchParams }: PageProps<"/file/[id]/confirmation">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!FILING_ID_RE.test(id)) notFound();
  const user = await requireUser(`/file/${id}/confirmation`);
  const rawSession = typeof sp.session_id === "string" ? sp.session_id : null;
  const sessionId = rawSession && /^[A-Za-z0-9_]{1,255}$/.test(rawSession) ? rawSession : null;

  // Verify with the provider server-side; never trust the redirect alone.
  let loaded: LoadedFiling | null;
  try {
    loaded = (await reconcileCheckoutReturn(user, id, sessionId)) as LoadedFiling | null;
  } catch (e) {
    console.error("[checkout] reconcile failed", e);
    loaded = await loadOwnFiling(user, id);
  }
  if (!loaded || loaded.filing.user_id !== user.id) notFound();

  const status = String(loaded.filing.status);
  if (status === "draft" && !sessionId) redirect(`/file/${id}/checkout`);

  const summary = filingSummary(loaded);
  const order = loaded.order as { total_cents?: number; status?: string; payment_mode?: string } | null;
  const context = (
    <FilingContext
      businessName={summary.businessName}
      stateName={summary.stateName}
      filingName={summary.filingName}
      periodYear={summary.periodYear}
    />
  );

  if (status === "draft") {
    const failed = order?.status === "payment_failed";
    return (
      <Container className="max-w-2xl py-8 sm:py-12">
        <FunnelSteps current="payment" className="mb-8" />
        <div className="grid gap-1.5">
          {context}
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">
            {failed ? "Your payment didn't go through" : "We're confirming your payment"}
          </h1>
        </div>
        <Card className="mt-8 p-5 sm:p-6">
          {failed ? (
            <div className="grid gap-4">
              <p className="text-[15px] text-muted">You weren&apos;t charged. Your details are saved, so you can try again.</p>
              <div>
                <ButtonLink href={`/file/${id}/checkout`} size="lg">
                  Back to payment
                </ButtonLink>
              </div>
            </div>
          ) : (
            <PaymentPoller dashboardHref="/dashboard" />
          )}
        </Card>
      </Container>
    );
  }

  const needsInfo = status === "needs_information";
  return (
    <Container className="max-w-2xl py-8 sm:py-12">
      <FunnelSteps current="done" paid className="mb-8" />
      <div className="grid justify-items-start gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-accent-soft" aria-hidden>
          <CheckCircle size={28} weight="fill" className="text-accent" />
        </span>
        <div className="grid gap-1.5">
          {context}
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">Order confirmed</h1>
          <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted">
            Thank you. We&apos;ve received your order and will email a confirmation to{" "}
            <span className="font-medium text-fg [overflow-wrap:anywhere]">{user.email}</span>.
          </p>
        </div>
      </div>

      {needsInfo ? (
        <Notice tone="warning" title="We need a few more details" className="mt-6">
          Some information is still missing.{" "}
          <Link href={`/file/${id}/details`} className="font-medium text-fg underline underline-offset-4">
            Add the missing details
          </Link>{" "}
          so we can prepare the filing.
        </Notice>
      ) : null}

      <Card className="mt-8 grid gap-5 p-5 sm:p-6">
        {typeof order?.total_cents === "number" ? (
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
            <p className="text-[15px] text-muted">
              Paid today
              {order.payment_mode === "sandbox" ? <span className="block text-xs text-subtle">Test payment. No real charge.</span> : null}
            </p>
            <p className="tnum text-lg font-semibold text-fg">{formatCents(order.total_cents)}</p>
          </div>
        ) : null}
        <div>
          <h2 className="text-base font-semibold tracking-tight text-fg">What happens next</h2>
          <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[15px] leading-relaxed text-muted">
            <li>We review your details and contact you if anything needs attention.</li>
            <li>We prepare and submit your {summary.filingName.toLowerCase()} to the {summary.agencyName}.</li>
            <li>We send you the state&apos;s confirmation and keep a copy in your dashboard.</li>
          </ol>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href={`/dashboard/filings/${id}`} size="lg">
            View your filing
          </ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary" size="lg">
            Go to your dashboard
          </ButtonLink>
        </div>
      </Card>
    </Container>
  );
}
