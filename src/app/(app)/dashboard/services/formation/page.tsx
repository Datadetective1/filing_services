import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/domain/money";
import { RA_JURISDICTIONS } from "@/lib/registered-agent/jurisdictions";
import {
  businessServicesPagesEnabled,
  formationSaleCheck,
} from "@/lib/registered-agent/sales";
import { previewFormation } from "@/lib/services/formation";
import { loadOrderPrefill } from "@/lib/services/orders";
import { backLinkClass } from "@/components/dashboard/section";
import { FormationOrderForm } from "@/components/services/formation-order-form";
import { QuoteSummary } from "@/components/services/quote-summary";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Card, Container, Notice } from "@/components/ui/surface";
import { startFormationCheckoutAction } from "../actions";

export const metadata: Metadata = {
  title: "Form your business",
  robots: { index: false, follow: false },
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Formation in two short steps on one page: pick the state and type (the price appears), then
 * the few details the filing needs. Only states open for formation are listed.
 */
export default async function FormationPage(
  props: PageProps<"/dashboard/services/formation">,
) {
  if (!businessServicesPagesEnabled()) notFound();
  const sp = await props.searchParams;
  const stateParam = (first(sp.state) ?? "").toUpperCase();
  const typeParam = first(sp.type) === "corporation" ? "corporation" : "llc";
  const user = await requireUser(
    `/dashboard/services/formation${stateParam ? `?state=${stateParam}&type=${typeParam}` : ""}`,
  );
  const states = RA_JURISDICTIONS.filter(
    (j) =>
      formationSaleCheck(j.code, "llc").ok ||
      formationSaleCheck(j.code, "corporation").ok,
  ).map((j) => ({
    code: j.code,
    name: j.name,
  }));
  const chosen = states.find((s) => s.code === stateParam);
  const preview = chosen
    ? await previewFormation({ stateCode: chosen.code, entityType: typeParam })
    : null;
  const quote = preview?.sale.ok ? preview.quote : null;
  const prefill = quote ? await loadOrderPrefill(user.id, "") : null;

  return (
    <Container className="max-w-2xl py-6 sm:py-12">
      <Link href="/dashboard" className={backLinkClass}>
        <ArrowLeft size={16} weight="bold" aria-hidden />
        Dashboard
      </Link>
      <h1 className="mt-3 text-[26px] font-semibold leading-tight text-fg sm:text-[34px]">
        Form your business
      </h1>
      {quote ? (
        <p className="mt-2 text-[17px] text-fg">
          <span className="tnum font-semibold">
            {formatCents(quote.dueTodayCents)}
          </span>
          <span className="text-muted">
            {" "}
            all in, including the {preview?.jurisdiction.name} filing fee.
            Nothing renews unless you add registered agent service.
          </span>
        </p>
      ) : (
        <p className="mt-2 max-w-[60ch] text-[15px] text-muted">
          Our service fee plus the state&apos;s filing fee, each on its own
          line. We file it for you and tell you when the state approves it.
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
            <p>
              Business formation isn&apos;t open yet. Nothing on this page is an
              offer to file today.
            </p>
          </Notice>
        ) : (
          <Card className="p-4 sm:p-6">
            <form
              method="get"
              className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            >
              <Field label="State" htmlFor="state">
                <Select
                  id="state"
                  name="state"
                  required
                  defaultValue={chosen?.code ?? ""}
                >
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

        {chosen && preview && !quote ? (
          <Notice tone="warning" title="Not available yet">
            <p>
              {preview.sale.reason ?? "Formation isn't open here yet."} Nothing
              has been charged.
            </p>
          </Notice>
        ) : null}

        {quote && prefill && preview ? (
          <Card className="grid gap-6 p-4 sm:p-6">
            <details className="group" open>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
                Order summary
                <span className="tnum text-[16px]">
                  {formatCents(quote.dueTodayCents)}
                </span>
              </summary>
              <div className="mt-2">
                <QuoteSummary quote={quote} />
              </div>
            </details>
            <FormationOrderForm
              action={startFormationCheckoutAction}
              stateCode={preview.jurisdiction.code}
              entityType={typeParam}
              totalLabel={formatCents(quote.dueTodayCents)}
              totalWithAgentLabel={
                preview.addOnQuote
                  ? formatCents(preview.addOnQuote.dueTodayCents)
                  : null
              }
              agentRenewalLabel={
                preview.addOnQuote?.renewal
                  ? formatCents(preview.addOnQuote.renewal.amountCents)
                  : null
              }
              agentTerms={preview.addOnQuote?.disclosures ?? []}
              askOwnerAddresses={
                preview.jurisdiction.extraIntake.beneficialOwners
              }
              prefill={{
                contactName: prefill.contactName,
                contactPhone: prefill.contactPhone,
              }}
            />
          </Card>
        ) : null}

        <p className="text-sm text-muted">
          Forming it yourself and just need an agent?{" "}
          <Link
            href="/dashboard/services/new-business"
            className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
          >
            Registered agent for a new business
          </Link>
        </p>
      </div>
    </Container>
  );
}
