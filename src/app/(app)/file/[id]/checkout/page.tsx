import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { site } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { describeDaysRemaining, formatLongDate } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import type { Quote } from "@/lib/domain/pricing";
import { quoteForFiling } from "@/lib/filings/customer";
import { validateAll } from "@/lib/intake/validate";
import { getPaymentProvider } from "@/lib/payments";
import { TrackView } from "@/components/analytics/track-view";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import { ActionForm } from "@/components/funnel/action-form";
import { FilingContext } from "@/components/funnel/filing-context";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { Badge } from "@/components/ui/badge";
import { Card, Container, Facts, Notice } from "@/components/ui/surface";
import { authorizationStatus, filingSummary, loadOwnFiling } from "../../_lib/filing";
import { payAction } from "./actions";

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

export default async function FilingCheckoutPage({ params, searchParams }: PageProps<"/file/[id]/checkout">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/file/${id}/checkout`);
  const loaded = await loadOwnFiling(user, id);
  if (!loaded) notFound();
  if (loaded.filing.status !== "draft") redirect(`/dashboard/filings/${id}`);
  if (!validateAll(loaded.schema, loaded.answers).ok) redirect(`/file/${id}/review`);

  const auth = await authorizationStatus(id, loaded.schema, loaded.answers);
  if (auth !== "current") redirect(`/file/${id}/review${auth === "stale" ? "?changed=1" : ""}`);

  const summary = filingSummary(loaded);
  let quote: Quote | null = null;
  try {
    quote = await quoteForFiling(loaded.filing, loaded.business);
  } catch {
    quote = null;
  }
  let sandbox = false;
  try {
    sandbox = getPaymentProvider().mode === "sandbox";
  } catch {
    sandbox = false;
  }

  const cancelled = sp.cancelled === "1";
  const lastAttemptFailed = loaded.order?.status === "payment_failed";
  const urgent = summary.daysRemaining <= 30;
  const directUrl = summary.officialFilingUrl;
  const directHost = (() => {
    try {
      return directUrl ? new URL(directUrl).host : null;
    } catch {
      return null;
    }
  })();

  return (
    <Container className="max-w-4xl py-8 sm:py-10">
      {cancelled ? <TrackView event="checkout_cancelled" stateCode={summary.stateCode} /> : null}
      <FunnelSteps current="payment" className="mb-8" />

      <div className="grid gap-1.5">
        <FilingContext
          businessName={summary.businessName}
          stateName={summary.stateName}
          filingName={summary.filingName}
          periodYear={summary.periodYear}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">Payment</h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">
          Check the total, then pay on our payment provider&apos;s secure checkout page.
        </p>
      </div>

      <div className="mt-6 grid gap-3 empty:hidden">
        {sandbox ? (
          <Notice tone="info" title="Test mode: no real payment will be taken">
            Payments run in a sandbox right now. You&apos;ll see a simulated checkout page and no card is charged.
          </Notice>
        ) : null}
        {lastAttemptFailed ? (
          <Notice tone="warning" role="alert" title="Your last payment didn't go through">
            You weren&apos;t charged. You can try again below.
          </Notice>
        ) : cancelled ? (
          <Notice tone="neutral" role="status" title="Checkout cancelled">
            You weren&apos;t charged. Your details are saved, so you can pay whenever you&apos;re ready.
          </Notice>
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem] md:items-start">
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold tracking-tight text-fg">Your order</h2>
          <Facts
            className="mt-4"
            items={[
              { term: "Business", value: <span className="[overflow-wrap:anywhere]">{summary.businessName}</span> },
              { term: "State", value: summary.stateName },
              { term: "Filing", value: summary.filingName },
              { term: "Report year", value: <span className="tnum">{summary.periodYear}</span> },
              {
                term: "Due date",
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tnum">{formatLongDate(summary.dueDate)}</span>
                    <Badge tone={summary.daysRemaining < 0 ? "warning" : urgent ? "info" : "neutral"}>
                      <span className="tnum">{describeDaysRemaining(summary.daysRemaining)}</span>
                    </Badge>
                  </span>
                ),
              },
            ]}
          />
          <div className="mt-6 border-t border-border pt-5 text-sm leading-relaxed text-muted">
            <p className="font-medium text-fg">What happens next</p>
            <ol className="mt-2 grid list-decimal gap-1 pl-5">
              <li>We review your details.</li>
              <li>We prepare and submit the filing to the {summary.agencyName}.</li>
              <li>We send you the state&apos;s confirmation and keep a copy in your dashboard.</li>
            </ol>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold tracking-tight text-fg">Price</h2>
          {quote ? (
            <>
              <PriceBreakdown className="mt-4" quote={quote} stateName={summary.stateName} />
              <ActionForm
                className="mt-6 grid gap-3"
                action={payAction.bind(null, id)}
                label={
                  <>
                    <LockSimple size={18} weight="bold" aria-hidden />
                    Pay <span className="tnum">{formatCents(quote.totalCents)}</span>
                  </>
                }
                pendingLabel="Opening checkout…"
                errorTitle="We couldn't start checkout"
                footer={
                  <p className="text-xs leading-relaxed text-subtle">
                    You&apos;ll finish on a secure checkout page. {site.name} never sees or stores your card number.
                  </p>
                }
              />
            </>
          ) : (
            <Notice tone="warning" className="mt-4" title="Pricing isn't available right now">
              Please try again in a few minutes. Nothing has been charged.
            </Notice>
          )}
        </Card>
      </div>

      <p className="mt-8 max-w-[70ch] text-sm leading-relaxed text-muted">
        {site.disclaimer} You can file directly with the {summary.agencyName}
        {directUrl && directHost ? (
          <>
            {" "}at{" "}
            <a href={directUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-fg underline underline-offset-4">
              {directHost}
            </a>
          </>
        ) : null}
        {quote
          ? quote.governmentFeeCents > 0
            ? ` for the ${formatCents(quote.governmentFeeCents)} state fee alone.`
            : ", where there is no state fee for your business."
          : " for the state fee alone."}
      </p>
    </Container>
  );
}
