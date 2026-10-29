import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Warning } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/domain/money";
import { SERVICE_DOCUMENT_KIND_LABELS } from "@/lib/registered-agent/documents";
import { PROVIDER_ORDER_STATUS_LABELS } from "@/lib/registered-agent/status";
import { SERVICES } from "@/lib/services/catalog";
import { loadServiceDetail } from "@/lib/services/customer-view";
import { reconcileServiceCheckoutReturn } from "@/lib/services/orders";
import { backLinkClass, DashboardSection, QuietEmpty } from "@/components/dashboard/section";
import { formatTimestampDate } from "@/components/dashboard/format";
import { RenewalForm } from "@/components/services/service-order-form";
import { Badge } from "@/components/ui/badge";
import { Card, Container, Facts, Notice } from "@/components/ui/surface";
import { setRenewalAction } from "../actions";

export const metadata: Metadata = {
  title: "Registered agent service",
  robots: { index: false, follow: false },
};

const SERVICE_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  pending_appointment: { label: "Being set up", tone: "info" },
  active: { label: "Active", tone: "success" },
  cancellation_requested: { label: "Ending", tone: "warning" },
  termination_pending: { label: "Ending", tone: "warning" },
  ended: { label: "Ended", tone: "neutral" },
};

const BILLING_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  pending: { label: "Awaiting payment", tone: "neutral" },
  incomplete: { label: "Payment incomplete", tone: "warning" },
  active: { label: "Paid", tone: "success" },
  past_due: { label: "Payment failed, retrying", tone: "danger" },
  unpaid: { label: "Unpaid", tone: "danger" },
  canceled: { label: "Not renewing", tone: "neutral" },
};

const KIND_LABEL = { registered_agent: "Registered agent", change_of_agent: "Change of agent filing", formation: "Formation filing" } as const;

function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" }) : "";
}

export default async function ServicePage(props: PageProps<"/dashboard/services/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/dashboard/services/${encodeURIComponent(id)}`);
  const sp = await props.searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  if (sessionId) await reconcileServiceCheckoutReturn(user, id, sessionId).catch((e) => console.error("[services] reconcile failed", e));
  const s = await loadServiceDetail(user.id, id);
  if (!s) notFound();
  const service = SERVICE_STATUS[s.serviceStatus];
  const billing = BILLING_STATUS[s.billingStatus];
  const canChangeRenewal = (s.billingStatus === "active" || s.billingStatus === "past_due") && s.serviceStatus !== "ended";

  return (
    <Container className="max-w-4xl py-8 sm:py-12">
      <Link href={`/dashboard/businesses/${s.businessId}`} className={backLinkClass}>
        <ArrowLeft size={16} weight="bold" aria-hidden />
        {s.businessName}
      </Link>
      <header className="mt-4 grid gap-2">
        <h1 className="text-[28px] font-semibold leading-tight text-fg sm:text-[34px]">
          {SERVICES[s.plan].name} in {s.stateName}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Badge tone={service.tone}>Service: {service.label}</Badge>
          <Badge tone={billing.tone}>Billing: {billing.label}</Badge>
        </div>
      </header>

      {s.billingStatus === "pending" ? (
        <Notice className="mt-6" tone="info" title="We're confirming your payment">
          <p>This page updates once your payment is confirmed. If you closed checkout early, nothing was charged.</p>
        </Notice>
      ) : s.serviceStatus === "pending_appointment" ? (
        <Notice className="mt-6" tone="info" title="Your service is being set up">
          <p>
            Payment received. Your service is not active yet: we place the order with our provider and confirm the appointment
            {s.origin === "switching" ? " and the state's change of agent filing" : ""} before we mark it active. If we need anything, we&apos;ll ask here.
          </p>
        </Notice>
      ) : null}
      {s.billingStatus === "past_due" || s.billingStatus === "unpaid" ? (
        <Notice className="mt-4" tone="danger" title="Your renewal payment didn't go through">
          <p>Your service has not been cancelled. Update your card when the payment email arrives, or contact us.</p>
        </Notice>
      ) : null}

      <div className="mt-8 grid gap-10">
        <DashboardSection id="documents" title="Documents received" description="Legal documents, government notices and mail our provider received for your business.">
          {s.documents.length === 0 ? (
            <QuietEmpty>Nothing has arrived yet.</QuietEmpty>
          ) : (
            <ul className="grid gap-2">
              {s.documents.map((d) => (
                <li key={d.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      {d.urgency === "urgent" ? (
                        <Warning size={22} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                      ) : (
                        <FileText size={22} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                      )}
                      <div className="grid min-w-0">
                        <span className="font-semibold text-fg">{SERVICE_DOCUMENT_KIND_LABELS[d.kind]}</span>
                        <span className="text-sm text-muted">
                          Added {formatTimestampDate(d.createdAt)}
                          {d.summary ? `: ${d.summary}` : ""}
                        </span>
                      </div>
                    </div>
                    <a href={`/api/service-documents/${d.id}`} className="text-sm font-semibold text-accent underline underline-offset-4">
                      Download
                    </a>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection id="plan" title="Plan and renewal">
          <Card className="grid gap-5 p-5">
            <Facts
              items={[
                { term: "Renewal price", value: `${formatCents(s.renewalPriceCents)} per year` },
                {
                  term: s.cancelAtPeriodEnd ? "Service ends" : "Renews on",
                  value: s.currentPeriodEnd ? date(s.currentPeriodEnd) : "Set when payment is confirmed",
                },
                { term: "Registered agent of record", value: `${s.providerName} (our provider)` },
                ...(s.appointmentConfirmedAt ? [{ term: "Appointment confirmed", value: date(s.appointmentConfirmedAt) }] : []),
              ]}
            />
            {s.bundleYears.length > 0 ? (
              <div className="grid gap-1 text-[15px]">
                <p className="font-semibold text-fg">Annual reports included</p>
                {s.bundleYears.map((y) => (
                  <p key={y.periodStart} className="text-muted">
                    {date(y.periodStart)} to {date(y.periodEnd)}:{" "}
                    {y.reportingYear ? `${y.reportingYear} annual report (state fee charged when you approve the filing)` : "no annual report falls in this year"}
                  </p>
                ))}
              </div>
            ) : null}
            {canChangeRenewal ? (
              s.cancelAtPeriodEnd ? (
                <div className="grid gap-2">
                  <p className="text-sm text-muted">
                    Renewal is off. Before your service ends, name a new registered agent with the state. If we are still listed after it ends, our provider may resign as your agent, which can affect your good standing.
                  </p>
                  <RenewalForm action={setRenewalAction} subscriptionId={s.id} renew label="Turn renewal back on" />
                </div>
              ) : (
                <div className="grid gap-2">
                  <p className="text-sm text-muted">
                    Turning off renewal stops future charges. Your service stays in place until the end of the year you paid for. It doesn&apos;t change the state&apos;s record by itself.
                  </p>
                  <RenewalForm action={setRenewalAction} subscriptionId={s.id} renew={false} label="Turn off renewal" />
                </div>
              )
            ) : null}
          </Card>
        </DashboardSection>

        <DashboardSection id="contact" title="Contact for this business" description="The person we and our provider contact about this business.">
          <Card className="p-5">
            <Facts
              items={[
                { term: "Name", value: s.contactName ?? "Not provided" },
                { term: "Phone", value: s.contactPhone ?? "Not provided" },
                { term: "Address", value: s.contactAddress ?? "Not provided" },
              ]}
            />
          </Card>
        </DashboardSection>

        <DashboardSection id="history" title="Order history">
          {s.history.length === 0 ? (
            <QuietEmpty>No updates yet.</QuietEmpty>
          ) : (
            <ol className="grid gap-2">
              {s.history.map((h) => (
                <li key={h.id} className="text-[15px]">
                  <span className="font-medium text-fg">
                    {KIND_LABEL[h.kind]}: {PROVIDER_ORDER_STATUS_LABELS[h.toStatus]}
                  </span>
                  <span className="text-muted"> · {formatTimestampDate(h.createdAt)}</span>
                  {h.note ? <p className="text-muted">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </DashboardSection>
      </div>
    </Container>
  );
}
