import { Flask, LockSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { findRule } from "@/lib/compliance/registry";
import { formatLongDate } from "@/lib/domain/dates";
import { deadlineLabel } from "@/lib/domain/deadline-copy";
import { hasVerifiedNoLateFee } from "@/lib/domain/deadline-copy";
import { formatCents } from "@/lib/domain/money";
import type { Quote } from "@/lib/domain/pricing";
import type { EntityType } from "@/lib/domain/types";
import { governmentFeeDetails, quoteForFiling } from "@/lib/filings/customer";
import { validateAll } from "@/lib/intake/validate";
import { getPaymentReadiness, requiresApprovedPrice } from "@/lib/payments";
import { TrackView } from "@/components/analytics/track-view";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import { ActionForm } from "@/components/funnel/action-form";
import { FilingContext } from "@/components/funnel/filing-context";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { NextSteps } from "@/components/funnel/next-steps";
import { Badge } from "@/components/ui/badge";
import { Container, Notice } from "@/components/ui/surface";
import { DateTile } from "@/components/visual/date-tile";
import { Receipt } from "@/components/visual/receipt";
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
  const fees = await governmentFeeDetails(loaded.filing, loaded.business).catch(() => null);
  const payments = getPaymentReadiness();
  const sandbox = payments.mode === "sandbox";
  // Only an approved service price is shown and charged on production or in live mode.
  const priceBlocked = quote !== null && !quote.servicePriceApproved && requiresApprovedPrice(payments.mode);
  const canPay = quote !== null && payments.ready && !priceBlocked;

  const cancelled = sp.cancelled === "1";
  const lastAttemptFailed = loaded.order?.status === "payment_failed";
  const urgent = summary.daysRemaining <= 30;
  // Plain facts for a report due today or already past due. "No state late fee" only
  // when the verified rule proves it (the same test the dashboard copy uses).
  const rule = findRule(loaded.filing.state_code, loaded.business.entity_type as EntityType, "annual_report", Boolean(loaded.business.is_foreign));
  const noStateLateFee = hasVerifiedNoLateFee(rule);
  const deadlineTitle =
    summary.daysRemaining === 0
      ? "The due date for this report is today"
      : summary.daysRemaining < 0
        ? `The due date for this report passed on ${formatLongDate(summary.dueDate)}`
        : null;
  const directUrl = summary.officialFilingUrl;
  const directHost = (() => {
    try {
      return directUrl ? new URL(directUrl).host : null;
    } catch {
      return null;
    }
  })();

  const receiptMeta = `${summary.stateName} ${summary.filingName} ${summary.periodYear}`;
  // A new registered agent who isn't the signer must sign the state's consent before we file.
  const { data: latestAuth } = await (await createClient())
    .from("filing_authorizations")
    .select("registered_agent_consent")
    .eq("filing_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pendingAgent = (latestAuth?.registered_agent_consent as { mode?: string; agentName?: string } | null)?.mode === "agent_to_sign"
    ? ((latestAuth?.registered_agent_consent as { agentName?: string }).agentName ?? "your new registered agent")
    : null;

  return (
    <Container className="max-w-5xl pt-8 sm:pt-10">
      {cancelled ? <TrackView event="checkout_cancelled" stateCode={summary.stateCode} /> : null}
      <FunnelSteps current="payment" className="mb-10" />

      <div className="grid gap-2.5">
        <FilingContext
          businessName={summary.businessName}
          stateName={summary.stateName}
          filingName={summary.filingName}
          periodYear={summary.periodYear}
        />
        <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[38px]">Payment</h1>
        <p className="max-w-[58ch] text-[16px] leading-relaxed text-muted">
          Check the total, then pay on our payment provider&apos;s secure checkout page.
        </p>
      </div>

      {pendingAgent ? (
        <Notice tone="info" role="status" title="We'll need the new agent's signed consent" className="mt-6">
          Washington requires {pendingAgent} to consent to serve as registered agent. After you pay, ask them to sign the state&apos;s
          Consent to Serve statement and send it to us. We won&apos;t file until we have it.
        </Notice>
      ) : null}

      {lastAttemptFailed || cancelled || deadlineTitle ? (
        <div className="mt-6 grid gap-3">
          {lastAttemptFailed ? (
            <Notice tone="warning" role="alert" title="Your last payment didn't go through">
              You weren&apos;t charged. You can try again below.
            </Notice>
          ) : cancelled ? (
            <Notice tone="neutral" role="status" title="Checkout cancelled">
              You weren&apos;t charged. Your details are saved, so you can pay whenever you&apos;re ready.
            </Notice>
          ) : null}
          {deadlineTitle ? (
            <Notice tone="neutral" title={deadlineTitle}>
              {noStateLateFee ? `${summary.stateName} charges no state late fee, and the report can still be filed. ` : null}
              We submit orders in the order they&apos;re received.
            </Notice>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-14">
        <div className="grid gap-5 md:sticky md:top-6 md:order-2">
          {sandbox ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-dashed border-highlight-strong/60 bg-highlight-soft px-4 py-3.5">
              <Flask size={20} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-highlight-fg" />
              <div className="grid gap-0.5 text-[15px]">
                <p className="font-semibold text-fg">Test mode: no real payment will be taken</p>
                <p className="text-sm leading-6 text-fg/75">
                  Payments run in a sandbox right now. You&apos;ll see a simulated checkout page and no card is charged.
                </p>
              </div>
            </div>
          ) : null}

          <Receipt title="Your order" meta={receiptMeta} className="w-full">
            {quote ? (
              <>
                {priceBlocked ? null : <PriceBreakdown quote={quote} stateName={summary.stateName} />}
                {fees && fees.evaluation.possible.length > 0 ? (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {fees.evaluation.possible
                      .map((l) => `${summary.stateName} adds a ${formatCents(l.cents)} ${l.label.toLowerCase()} only if its own record shows the business as ${(l.requiresStatus ?? ["late"]).join(" or ")}.`)
                      .join(" ")}{" "}
                    We check the state&apos;s record before filing and contact you before any extra state charge.
                  </p>
                ) : null}
                {canPay ? (
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
                      <p className="text-center text-[13px] leading-5 text-muted">
                        You&apos;ll finish on a secure checkout page. {site.name} never sees or stores your card number.
                      </p>
                    }
                  />
                ) : (
                  <Notice tone="neutral" role="status" title="Online payment isn't open yet" className={priceBlocked ? undefined : "mt-6"}>
                    Your details and authorization are saved, and nothing has been charged. You can place the order from this page once it opens. Questions? See our{" "}
                    <Link href="/help" className="font-semibold text-accent underline decoration-accent/30 decoration-2 underline-offset-4 hover:decoration-accent">
                      help page
                    </Link>
                    .
                  </Notice>
                )}
              </>
            ) : (
              <Notice tone="warning" title="Pricing isn't available right now">
                Please try again in a few minutes. Nothing has been charged.
              </Notice>
            )}
          </Receipt>
        </div>

        <div className="grid min-w-0 gap-6 md:order-1">
          <section aria-labelledby="order-title" className="rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-7">
            <h2 id="order-title" className="font-display text-lg font-semibold text-fg">
              What you&apos;re ordering
            </h2>
            <div className="mt-5 flex items-center gap-4 rounded-[var(--radius-control)] bg-surface-2 p-3.5">
              <DateTile date={summary.dueDate} size="sm" />
              <div className="grid min-w-0 gap-1">
                <p className="text-[15px] font-semibold leading-snug text-fg">
                  {summary.stateName} {summary.filingName.toLowerCase()}, <span className="tnum">{summary.periodYear}</span>
                </p>
                <p className="tnum flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                  Due {formatLongDate(summary.dueDate)}
                  <Badge tone={summary.daysRemaining < 0 ? "warning" : urgent ? "info" : "neutral"}>
                    <span className="tnum">{deadlineLabel(summary.daysRemaining, summary.dueDate)}</span>
                  </Badge>
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-[15px]">
              <dt className="text-muted">Business</dt>
              <dd className="font-medium text-fg [overflow-wrap:anywhere]">{summary.businessName}</dd>
              <dt className="text-muted">Filed with</dt>
              <dd className="font-medium text-fg">{summary.agencyName}</dd>
              <dt className="text-muted">Details</dt>
              <dd className="font-medium text-fg">Reviewed and signed by you</dd>
            </dl>
          </section>

          <section aria-labelledby="after-title" className="px-1">
            <h2 id="after-title" className="font-display text-lg font-semibold text-fg">
              After you pay
            </h2>
            <NextSteps
              className="mt-4"
              steps={[
                { state: "current", title: "We review your details", body: "A person on our team checks everything before it's filed." },
                { state: "upcoming", title: `We submit it to the ${summary.agencyName}`, body: "We email you when it's on its way." },
                { state: "upcoming", title: "You get the state's confirmation", body: "A copy stays in your dashboard." },
              ]}
            />
          </section>
        </div>
      </div>

      <p className="mt-10 max-w-[70ch] text-sm leading-6 text-subtle">
        {site.disclaimer} You can file directly with the {summary.agencyName}
        {directUrl && directHost ? (
          <>
            {" "}at{" "}
            <a href={directUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
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
