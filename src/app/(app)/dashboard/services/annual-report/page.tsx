import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/domain/money";
import { providerReportOpenStates } from "@/lib/registered-agent/provider-report";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { loadOrderPrefill, loadOwnedBusiness } from "@/lib/services/orders";
import { previewProviderReport } from "@/lib/services/provider-report";
import { backLinkClass } from "@/components/dashboard/section";
import { ProviderReportOrderForm } from "@/components/services/provider-report-order-form";
import { QuoteSummary } from "@/components/services/quote-summary";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Card, Container, Notice } from "@/components/ui/surface";
import { startProviderReportCheckoutAction } from "../actions";

export const metadata: Metadata = {
  title: "File your annual report",
  robots: { index: false, follow: false },
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Annual reports in the states Filewell doesn't file itself, filed by our partner. Two short
 * steps on one page: pick the state and type (the price appears), then the report's details.
 * Only states whose report fee is verified and switched on are listed.
 */
export default async function ProviderReportPage(props: PageProps<"/dashboard/services/annual-report">) {
  if (!businessServicesPagesEnabled()) notFound();
  const sp = await props.searchParams;
  const stateParam = (first(sp.state) ?? "").toUpperCase();
  const typeParam = first(sp.type) === "corporation" ? "corporation" : "llc";
  const businessParam = first(sp.business) ?? "";
  const user = await requireUser(
    `/dashboard/services/annual-report${stateParam ? `?state=${stateParam}&type=${typeParam}` : ""}`,
  );
  const states = providerReportOpenStates();
  const chosen = states.find((s) => s.code === stateParam);
  const preview = chosen ? await previewProviderReport({ stateCode: chosen.code, entityType: typeParam }) : null;
  const quote = preview?.sale.ok ? preview.quote : null;
  const owned = businessParam ? await loadOwnedBusiness(user.id, businessParam) : null;
  const business = owned && chosen && owned.state_code === chosen.code && owned.entity_type === typeParam ? owned : null;
  const prefill = quote ? await loadOrderPrefill(user.id, business?.id ?? "") : null;

  return (
    <Container className="max-w-2xl py-6 sm:py-12">
      <Link href="/dashboard" className={backLinkClass}>
        <ArrowLeft size={16} weight="bold" aria-hidden />
        Dashboard
      </Link>
      <h1 className="mt-3 text-[26px] font-semibold leading-tight text-fg sm:text-[34px]">File your annual report</h1>
      {quote && preview ? (
        <p className="mt-2 text-[17px] text-fg">
          <span className="tnum font-semibold">{formatCents(quote.dueTodayCents)}</span>
          <span className="text-muted"> all in, including the {preview.jurisdiction.name} state fee. Nothing renews.</span>
        </p>
      ) : (
        <p className="mt-2 max-w-[60ch] text-[15px] text-muted">
          Our $99 service plus the state&apos;s fee, each on its own line. We file it and tell you when the state accepts it.
        </p>
      )}
      {first(sp.cancelled) ? (
        <Notice className="mt-5" tone="info" title="Checkout cancelled">
          <p>Nothing was charged.</p>
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-5">
        {states.length === 0 ? (
          <Notice tone="warning" title="Not open yet">
            <p>Annual report filing in more states isn&apos;t open yet. Nothing on this page is an offer to file today.</p>
          </Notice>
        ) : (
          <Card className="p-4 sm:p-6">
            <form method="get" className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              {business ? <input type="hidden" name="business" value={business.id} /> : null}
              <Field label="State" htmlFor="state">
                <Select id="state" name="state" required defaultValue={chosen?.code ?? ""}>
                  <option value="" disabled>
                    Choose a state
                  </option>
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Type" htmlFor="type">
                <Select id="type" name="type" defaultValue={typeParam}>
                  <option value="llc">LLC</option>
                  <option value="corporation">Corporation</option>
                </Select>
              </Field>
              <Button type="submit" variant="secondary">
                {chosen ? "Update price" : "See price"}
              </Button>
            </form>
          </Card>
        )}

        {chosen && (!preview || !quote) ? (
          <Notice tone="warning" title="Not available yet">
            <p>{preview?.sale.reason ?? `We can't file this report in ${chosen.name} for this type of business yet.`} Nothing has been charged.</p>
          </Notice>
        ) : null}

        {quote && prefill && preview ? (
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
            <ProviderReportOrderForm
              action={startProviderReportCheckoutAction}
              stateCode={preview.jurisdiction.code}
              stateName={preview.jurisdiction.name}
              entityType={typeParam}
              totalLabel={formatCents(quote.dueTodayCents)}
              prefill={{
                businessId: business?.id ?? null,
                businessName: business?.legal_name ?? "",
                entityNumber: "",
                contactName: prefill.contactName,
                contactPhone: prefill.contactPhone,
              }}
            />
          </Card>
        ) : null}
      </div>
    </Container>
  );
}
