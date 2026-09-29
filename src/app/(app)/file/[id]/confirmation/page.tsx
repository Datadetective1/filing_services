import { ArrowRight, Check, Flask } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/domain/money";
import { reconcileCheckoutReturn } from "@/lib/filings/customer";
import { FilingContext } from "@/components/funnel/filing-context";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { NextSteps } from "@/components/funnel/next-steps";
import { PaymentPoller } from "@/components/funnel/payment-poller";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import { Photo } from "@/components/media/photo";
import { ButtonLink } from "@/components/ui/button";
import { Container, Notice } from "@/components/ui/surface";
import { Receipt } from "@/components/visual/receipt";
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
  const order = loaded.order as {
    total_cents?: number;
    government_fee_cents?: number;
    service_fee_cents?: number;
    status?: string;
    payment_mode?: string;
  } | null;
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
      <Container className="max-w-2xl pt-8 sm:pt-10">
        <FunnelSteps current="payment" className="mb-10" />
        <div className="grid gap-2.5">
          {context}
          <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[38px]">
            {failed ? "Your payment didn't go through" : "We're confirming your payment"}
          </h1>
        </div>
        <div className="mt-8 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-7">
          {failed ? (
            <div className="grid gap-4">
              <p className="text-[15px] leading-6 text-muted">You weren&apos;t charged. Your details are saved, so you can try again.</p>
              <div>
                <ButtonLink href={`/file/${id}/checkout`} size="lg">
                  Back to payment
                </ButtonLink>
              </div>
            </div>
          ) : (
            <PaymentPoller dashboardHref="/dashboard" />
          )}
        </div>
      </Container>
    );
  }

  const needsInfo = status === "needs_information";
  const hasFees =
    typeof order?.total_cents === "number" &&
    typeof order?.government_fee_cents === "number" &&
    typeof order?.service_fee_cents === "number";
  const testPayment = order?.payment_mode === "sandbox";

  const receipt =
    typeof order?.total_cents === "number" ? (
      <Receipt
        title="Payment received"
        meta={`${summary.stateName} ${summary.filingName} ${summary.periodYear}`}
        className="w-full"
        footer={
          testPayment ? (
            <span className="flex items-start gap-2">
              <Flask size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-highlight-strong" />
              Test payment. No real charge.
            </span>
          ) : null
        }
      >
        {hasFees ? (
          <PriceBreakdown
            quote={{
              governmentFeeCents: order.government_fee_cents as number,
              serviceFeeCents: order.service_fee_cents as number,
              totalCents: order.total_cents as number,
            }}
            stateName={summary.stateName}
            totalLabel="Paid today"
          />
        ) : (
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-semibold text-fg">Paid today</p>
            <p className="tnum font-display text-2xl font-semibold text-fg">{formatCents(order.total_cents)}</p>
          </div>
        )}
      </Receipt>
    ) : null;

  return (
    <Container className="max-w-6xl pt-8 sm:pt-10">
      <FunnelSteps current="done" paid className="mb-10" />

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="grid min-w-0 content-start gap-8">
          <div className="grid justify-items-start gap-5">
            <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_8px_20px_-8px_rgb(31_90_67/0.6)]" aria-hidden>
              <Check size={28} weight="bold" />
            </span>
            <div className="grid gap-3">
              {context}
              <h1 className="text-[36px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg sm:text-[52px]">
                Order <span className="mark-highlight">confirmed</span>
              </h1>
              <p className="max-w-[48ch] text-[17px] leading-relaxed text-muted">
                {needsInfo ? "Thank you. We've received your order." : "Thank you. We'll take it from here."} We&apos;ll email a
                confirmation to{" "}
                <span className="font-semibold text-fg [overflow-wrap:anywhere]">{user.email}</span>.
              </p>
            </div>
          </div>

          {needsInfo ? (
            <Notice tone="warning" title="We need a few more details">
              Some information is still missing.{" "}
              <Link href={`/file/${id}/details`} className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                Add the missing details
              </Link>{" "}
              so we can prepare the filing.
            </Notice>
          ) : null}

          <div className="lg:hidden">{receipt}</div>

          <section aria-labelledby="next-title" className="grid gap-4">
            <h2 id="next-title" className="font-display text-xl font-semibold text-fg">
              What happens next
            </h2>
            <NextSteps
              steps={[
                { state: "done", title: "Order received", body: "Your details are signed and your payment went through." },
                {
                  state: "current",
                  title: "We review your details",
                  body: "We contact you if anything needs attention.",
                },
                {
                  state: "upcoming",
                  title: `We prepare and submit your ${summary.filingName.toLowerCase()}`,
                  body: `Filed with the ${summary.agencyName}.`,
                },
                {
                  state: "upcoming",
                  title: "You get the state's confirmation",
                  body: "We email it to you and keep a copy in your dashboard.",
                },
              ]}
            />
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={`/dashboard/filings/${id}`} size="lg">
              View your filing
              <ArrowRight size={18} weight="bold" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary" size="lg">
              Go to your dashboard
            </ButtonLink>
          </div>
        </div>

        <div className="relative max-lg:hidden">
          <Photo
            photo="reliefDocument"
            priority
            sizes="(min-width: 1024px) 45vw, 1px"
            className="aspect-[4/5] w-full"
            focus="60% 35%"
          />
          {receipt ? <div className="relative z-10 -mt-40 ml-auto mr-6 w-[82%] max-w-sm rotate-[1.2deg]">{receipt}</div> : null}
        </div>
      </div>
    </Container>
  );
}
