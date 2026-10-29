import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/domain/money";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { PROVIDER_LEGAL_NAME } from "@/lib/services/catalog";
import { isOrderableService, previewServiceOrder, ServiceOrderError, type OrderableService } from "@/lib/services/orders";
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
  const situation = first(sp.situation) === "new_entity" ? "new_entity" : "switching";

  let preview;
  try {
    preview = await previewServiceOrder(user, { businessId, service, situation });
  } catch (e) {
    if (e instanceof ServiceOrderError && e.code === "not_found") notFound();
    throw e;
  }
  const href = (s: OrderableService, sit: string) => `/dashboard/services/new?business=${businessId}&service=${s}&situation=${sit}`;

  return (
    <Container className="max-w-3xl py-8 sm:py-12">
      <Link href={`/dashboard/businesses/${preview.business.id}`} className={backLinkClass}>
        <ArrowLeft size={16} weight="bold" aria-hidden />
        {preview.business.legal_name}
      </Link>
      <h1 className="mt-4 text-[28px] font-semibold leading-tight text-fg sm:text-[34px]">Registered agent service in {preview.stateName}</h1>
      <p className="mt-2 max-w-[62ch] text-base text-muted">
        A registered agent receives legal documents and government notices for your business. Ours is provided through {PROVIDER_LEGAL_NAME},
        whose name and address appear on the state&apos;s record as your agent. We add what arrives to your dashboard and email you.
      </p>

      {first(sp.cancelled) ? (
        <Notice className="mt-6" tone="info" title="Checkout cancelled">
          <p>Nothing was charged. Your details weren&apos;t saved; you can start again below.</p>
        </Notice>
      ) : null}

      <div className="mt-8 grid gap-6">
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold text-fg">Does {preview.business.legal_name} already have a registered agent?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={href(service, "switching")} className={choiceClass(situation === "switching")}>
              <span className="font-semibold text-fg">I already have a business with an agent</span>
              <span className="text-sm text-muted">We file the change with the state. You pay the state&apos;s fee; our filing is included.</span>
            </Link>
            <Link href={href(service, "new_entity")} className={choiceClass(situation === "new_entity")}>
              <span className="font-semibold text-fg">I&apos;m starting a business</span>
              <span className="text-sm text-muted">You name us as the agent when you form the business.</span>
            </Link>
          </div>
        </section>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold text-fg">Choose your plan</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={href("registered_agent", situation)} className={choiceClass(service === "registered_agent")}>
              <span className="font-semibold text-fg">Registered agent</span>
              <span className="text-sm text-muted">One business, one state, per year.</span>
            </Link>
            <Link href={href("ra_annual_report_bundle", situation)} className={choiceClass(service === "ra_annual_report_bundle")}>
              <span className="font-semibold text-fg">Registered agent + annual report</span>
              <span className="text-sm text-muted">Includes our service for one annual report a year. The state&apos;s report fee is charged when you approve the filing.</span>
            </Link>
          </div>
        </section>

        {!preview.sale.ok || !preview.quote ? (
          <Notice tone="warning" title="Not available yet">
            <p>{preview.sale.reason ?? "This service isn't available for this business yet."} Nothing has been charged.</p>
          </Notice>
        ) : (
          <Card className="grid gap-6 p-5 sm:p-6">
            <section className="grid gap-3">
              <h2 className="text-lg font-semibold text-fg">Order summary</h2>
              <QuoteSummary quote={preview.quote} />
            </section>
            <ServiceOrderForm
              action={startServiceCheckoutAction}
              businessId={preview.business.id}
              service={service}
              situation={situation}
              dueTodayLabel={formatCents(preview.quote.dueTodayCents)}
              renewalTerms={preview.quote.disclosures}
            />
          </Card>
        )}
      </div>
    </Container>
  );
}
