import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/domain/money";
import { getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import { bundleSaleCheck, businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { isOrderableService, loadOrderPrefill, previewServiceOrder, ServiceOrderError, type OrderableService } from "@/lib/services/orders";
import { backLinkClass } from "@/components/dashboard/section";
import { ServiceOrderForm } from "@/components/services/service-order-form";
import { QuoteSummary } from "@/components/services/quote-summary";
import { cn } from "@/components/ui/cn";
import { Card, Container, Notice } from "@/components/ui/surface";
import { startServiceCheckoutAction } from "../actions";

export const metadata: Metadata = {
  title: "Registered agent service",
  robots: { index: false, follow: false },
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const choiceClass = (active: boolean) =>
  cn(
    "grid gap-0.5 rounded-[var(--radius-control)] border px-4 py-3 text-left transition-colors",
    active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong",
  );

export default async function NewServicePage(props: PageProps<"/dashboard/services/new">) {
  if (!businessServicesPagesEnabled()) notFound();
  const sp = await props.searchParams;
  const businessId = first(sp.business) ?? "";
  const user = await requireUser(`/dashboard/services/new?business=${encodeURIComponent(businessId)}`);
  const serviceParam = first(sp.service);
  const service: OrderableService = isOrderableService(serviceParam) ? serviceParam : "registered_agent";

  let preview;
  try {
    preview = await previewServiceOrder(user, { businessId, service });
  } catch (e) {
    if (e instanceof ServiceOrderError && e.code === "not_found") notFound();
    throw e;
  }
  const { business } = preview;
  // Offer the bundle only where it can actually be bought for this business.
  const bundleOffered =
    service === "ra_annual_report_bundle" ||
    bundleSaleCheck(business.state_code, { entityType: business.entity_type, isForeign: business.is_foreign, isNonprofit: business.is_nonprofit }, preview.situation).ok;
  const prefill = preview.sale.ok ? await loadOrderPrefill(user.id, business.id) : null;
  const href = (s: OrderableService) => `/dashboard/services/new?business=${business.id}&service=${s}`;
  const quote = preview.sale.ok ? preview.quote : null;

  return (
    <Container className="max-w-2xl py-6 sm:py-12">
      <Link href={`/dashboard/businesses/${business.id}`} className={backLinkClass}>
        <ArrowLeft size={16} weight="bold" aria-hidden />
        {business.legal_name}
      </Link>
      <h1 className="mt-3 text-[26px] font-semibold leading-tight text-fg [overflow-wrap:anywhere] sm:text-[34px]">
        Registered agent in {preview.stateName}
      </h1>
      {quote ? (
        <p className="mt-2 text-[17px] text-fg">
          <span className="tnum font-semibold">{formatCents(quote.dueTodayCents)} today</span>
          {quote.renewal ? (
            <span className="text-muted">
              , then <span className="tnum">{formatCents(quote.renewal.amountCents)}</span> a year. Turn off renewal any time.
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="mt-2 max-w-[60ch] text-[15px] text-muted">
        {preview.situation === "switching"
          ? `We become ${business.legal_name}'s agent and file the change with the state for you. `
          : "Name us as your agent when you form the business. "}
        Legal papers and state notices land in your dashboard, and we email you when they arrive.
      </p>

      {first(sp.cancelled) ? (
        <Notice className="mt-5" tone="info" title="Checkout cancelled">
          <p>Nothing was charged. Your details are still filled in below.</p>
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-5">
        {bundleOffered ? (
          <section className="grid gap-2" aria-label="Plan">
            <div className="grid gap-2 sm:grid-cols-2">
              <Link href={href("registered_agent")} className={choiceClass(service === "registered_agent")} aria-current={service === "registered_agent" ? "true" : undefined}>
                <span className="font-semibold text-fg">Registered agent</span>
                <span className="text-sm text-muted">Agent service only.</span>
              </Link>
              <Link href={href("ra_annual_report_bundle")} className={choiceClass(service === "ra_annual_report_bundle")} aria-current={service === "ra_annual_report_bundle" ? "true" : undefined}>
                <span className="font-semibold text-fg">Agent + annual report</span>
                <span className="text-sm text-muted">We also file your yearly report. The state&apos;s report fee is charged when you approve it.</span>
              </Link>
            </div>
          </section>
        ) : null}

        {!quote || !prefill ? (
          <Notice tone="warning" title="Not available yet">
            <p>{preview.sale.reason ?? "This service isn't available for this business yet."} Nothing has been charged.</p>
          </Notice>
        ) : (
          <Card className="grid gap-6 p-4 sm:p-6">
            <details className="group" open>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
                Order summary
                <span className="tnum text-[16px]">{formatCents(quote.dueTodayCents)}</span>
              </summary>
              <div className="mt-2">
                <QuoteSummary quote={quote} />
              </div>
            </details>
            <ServiceOrderForm
              action={startServiceCheckoutAction}
              businessId={business.id}
              service={service}
              situation={preview.situation}
              dueTodayLabel={formatCents(quote.dueTodayCents)}
              renewalLabel={quote.renewal ? formatCents(quote.renewal.amountCents) : null}
              renewalTerms={quote.disclosures}
              prefill={prefill}
              askOwners={getRaJurisdiction(business.state_code)?.extraIntake.beneficialOwners ?? false}
            />
          </Card>
        )}

        {preview.situation === "switching" ? (
          <p className="text-sm text-muted">
            Not formed yet?{" "}
            <Link href="/dashboard/services/new-business" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
              Get an agent for a new business
            </Link>{" "}
            or{" "}
            <Link href="/dashboard/services/formation" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
              let us form it
            </Link>
            .
          </p>
        ) : null}
      </div>
    </Container>
  );
}
