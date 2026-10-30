import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, formatDateTime, money, opsToday, shortId } from "@/components/admin/format";
import { ConsoleHeader, EmptyRow, Panel, tableLink } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/surface";
import { requireStaff } from "@/lib/auth/session";
import { realPaymentsPossible } from "@/lib/compliance/registry";
import { escalationLevel, SERVICE_DOCUMENT_KIND_LABELS, type ServiceDocumentKind } from "@/lib/registered-agent/documents";
import { changeOfAgentFeeCents, formationFeeCents, RA_JURISDICTIONS, raFactsComplete } from "@/lib/registered-agent/jurisdictions";
import { BUNDLE_STATES, nationwideBlockers, raSwitchOn } from "@/lib/registered-agent/sales";
import {
  nextOperatorAction,
  PROVIDER_ORDER_STATUS_LABELS,
  providerCancellationDue,
  type BillingStatus,
  type ProviderOrderKind,
  type ProviderOrderStatus,
} from "@/lib/registered-agent/status";
import { SUBSCRIPTION_STRIPE_EVENTS } from "@/lib/payments/stripe-health";
import { createClient } from "@/lib/supabase/server";
import { one } from "../_lib/data";

export const metadata: Metadata = { title: "Registered agent" };

const WORK_STATUSES: ProviderOrderStatus[] = [
  "payment_confirmed",
  "information_needed",
  "ready_for_provider",
  "submitted_to_provider",
  "processing",
  "cancellation_requested",
  "provider_termination_pending",
];

const KIND_LABEL: Record<ProviderOrderKind, string> = {
  registered_agent: "Registered agent",
  change_of_agent: "Change of agent",
  formation: "Formation",
};

export default async function RegisteredAgentQueuePage() {
  await requireStaff();
  const db = await createClient();
  const today = opsToday();
  const [{ data: orders }, { data: docs }, { data: subs }, { data: alerts }] = await Promise.all([
    db
      .from("provider_orders")
      .select("id, kind, status, state_code, created_at, updated_at, ra_subscription_id, businesses(legal_name)")
      .in("status", WORK_STATUSES)
      .order("created_at"),
    db
      .from("service_documents")
      .select("id, kind, urgency, available_to_filewell_at, customer_notified_at, ra_subscription_id, businesses(legal_name)")
      .is("customer_notified_at", null)
      .order("available_to_filewell_at"),
    db
      .from("ra_subscriptions")
      .select("id, state_code, billing_status, service_status, failed_payment_count, provider_renewal_date, provider_cancelled_at, current_period_end, businesses(legal_name)")
      .neq("service_status", "ended")
      .in("billing_status", ["past_due", "unpaid", "canceled"]),
    db
      .from("provider_document_events")
      .select("id, provider_document_id, provider_company_id, provider_company_name, match_status, received_at, ra_subscription_id, businesses(legal_name)")
      .is("handled_at", null)
      .order("received_at"),
  ]);
  const now = new Date().toISOString();
  const nationwide = nationwideBlockers();

  return (
    <div className="grid gap-6">
      <ConsoleHeader
        title="Registered agent"
        description="Provider orders to work, documents to deliver and billing to review. Payment never activates service: record the provider's confirmation (or the state record) first."
      />

      {nationwide.length > 0 ? (
        <Notice tone="warning" title="Not launched">
          <p>{realPaymentsPossible() ? "No real-money business services sale can open here until these are done:" : "This environment can run test orders only. Before real money:"}</p>
          <ul className="mt-2 list-disc pl-5">
            {nationwide.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-2">The Stripe webhook must also send {SUBSCRIPTION_STRIPE_EVENTS.join(", ")} before any sale.</p>
        </Notice>
      ) : null}

      <Panel title="Orders to work" description="Oldest first. Each row says what to do next." bodyClassName="p-0">
        {(orders ?? []).length === 0 ? (
          <div className="px-5 py-4">
            <EmptyRow>Nothing to work.</EmptyRow>
          </div>
        ) : (
          <TableScroll variant="inset" className="rounded-none border-0">
            <Table>
              <THead>
                <tr>
                  <TH>Business</TH>
                  <TH>Work</TH>
                  <TH>Status</TH>
                  <TH>Next step</TH>
                  <TH>Since</TH>
                </tr>
              </THead>
              <tbody>
                {(orders ?? []).map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link
                        className={tableLink}
                        href={o.ra_subscription_id ? `/admin/registered-agent/${o.ra_subscription_id}` : `/admin/registered-agent/formation/${o.id}`}
                      >
                        {one(o.businesses)?.legal_name ?? shortId(o.id)}
                      </Link>
                    </TD>
                    <TD>
                      {KIND_LABEL[o.kind as ProviderOrderKind]} · {o.state_code}
                    </TD>
                    <TD>
                      <Badge tone={o.status === "information_needed" ? "warning" : "info"}>{PROVIDER_ORDER_STATUS_LABELS[o.status as ProviderOrderStatus]}</Badge>
                    </TD>
                    <TD className="max-w-md text-muted">{nextOperatorAction(o.kind as ProviderOrderKind, o.status as ProviderOrderStatus)}</TD>
                    <TD className="whitespace-nowrap">{formatDateTime(o.updated_at)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      <Panel
        title="Partner document alerts to upload"
        description="Registered Agents Inc. reported these documents. Pull each one from the partner portal and upload it on the subscription. An unmatched alert needs the partner company ID saved on the right subscription first."
        bodyClassName="p-0"
      >
        {(alerts ?? []).length === 0 ? (
          <div className="px-5 py-4">
            <EmptyRow>No open partner alerts.</EmptyRow>
          </div>
        ) : (
          <TableScroll variant="inset" className="rounded-none border-0">
            <Table>
              <THead>
                <tr>
                  <TH>Business</TH>
                  <TH>Partner IDs</TH>
                  <TH>Received</TH>
                  <TH>Match</TH>
                </tr>
              </THead>
              <tbody>
                {(alerts ?? []).map((a) => (
                  <TR key={a.id}>
                    <TD>
                      {a.ra_subscription_id ? (
                        <Link className={tableLink} href={`/admin/registered-agent/${a.ra_subscription_id}`}>
                          {one(a.businesses)?.legal_name ?? a.provider_company_name ?? shortId(a.id)}
                        </Link>
                      ) : (
                        (a.provider_company_name ?? "Unknown company")
                      )}
                    </TD>
                    <TD className="text-sm">
                      Document {a.provider_document_id}
                      <br />
                      Company {a.provider_company_id ?? "(none sent)"}
                    </TD>
                    <TD className="whitespace-nowrap">{formatDateTime(a.received_at)}</TD>
                    <TD>
                      <Badge tone={a.match_status === "matched" ? "neutral" : "warning"}>
                        {a.match_status === "matched" ? "Matched" : a.match_status === "ambiguous" ? "Two subscriptions share this ID" : "No subscription has this ID"}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      <Panel
        title="Documents not yet delivered"
        description="Legal documents and government notices escalate to the backup operator and then the owner when they miss the internal target. Call the customer for legal documents."
        bodyClassName="p-0"
      >
        {(docs ?? []).length === 0 ? (
          <div className="px-5 py-4">
            <EmptyRow>Every document has reached its customer.</EmptyRow>
          </div>
        ) : (
          <TableScroll variant="inset" className="rounded-none border-0">
            <Table>
              <THead>
                <tr>
                  <TH>Business</TH>
                  <TH>Document</TH>
                  <TH>Available since</TH>
                  <TH>Escalation</TH>
                </tr>
              </THead>
              <tbody>
                {(docs ?? []).map((d) => {
                  const level = escalationLevel({ kind: d.kind as ServiceDocumentKind, availableAt: d.available_to_filewell_at, customerNotifiedAt: null, now });
                  return (
                    <TR key={d.id}>
                      <TD>
                        <Link className={tableLink} href={`/admin/registered-agent/${d.ra_subscription_id}`}>
                          {one(d.businesses)?.legal_name ?? shortId(d.id)}
                        </Link>
                      </TD>
                      <TD>
                        <Badge tone={d.urgency === "urgent" ? "danger" : d.urgency === "high" ? "warning" : "neutral"}>
                          {SERVICE_DOCUMENT_KIND_LABELS[d.kind as ServiceDocumentKind]}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap">{formatDateTime(d.available_to_filewell_at)}</TD>
                      <TD>{level === "owner" ? "Owner" : level === "backup_operator" ? "Backup operator" : level === "pending" ? "Within target" : "None"}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      <Panel
        title="Billing to review"
        description="A failed or ended subscription never ends service by itself. Confirm the customer's next agent before asking the provider to end service, and cancel unpaid entities with the provider at least 30 days before its renewal."
        bodyClassName="p-0"
      >
        {(subs ?? []).length === 0 ? (
          <div className="px-5 py-4">
            <EmptyRow>No billing problems.</EmptyRow>
          </div>
        ) : (
          <TableScroll variant="inset" className="rounded-none border-0">
            <Table>
              <THead>
                <tr>
                  <TH>Business</TH>
                  <TH>Billing</TH>
                  <TH>Failed attempts</TH>
                  <TH>Provider renewal</TH>
                </tr>
              </THead>
              <tbody>
                {(subs ?? []).map((s) => {
                  const cancel = providerCancellationDue({
                    billingStatus: s.billing_status as BillingStatus,
                    providerRenewalDate: s.provider_renewal_date,
                    providerCancelledAt: s.provider_cancelled_at,
                    today,
                  });
                  return (
                    <TR key={s.id}>
                      <TD>
                        <Link className={tableLink} href={`/admin/registered-agent/${s.id}`}>
                          {one(s.businesses)?.legal_name ?? shortId(s.id)}
                        </Link>{" "}
                        · {s.state_code}
                      </TD>
                      <TD>{s.billing_status}</TD>
                      <TD className="tnum">{s.failed_payment_count}</TD>
                      <TD>
                        {s.provider_cancelled_at
                          ? `Cancelled with provider ${formatDate(s.provider_cancelled_at)}`
                          : s.provider_renewal_date
                            ? `${formatDate(s.provider_renewal_date)}${cancel.due ? (cancel.late ? " · cancel now (late)" : " · cancel with provider") : ""}`
                            : "Not recorded"}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      <Panel
        title="Launch readiness by jurisdiction"
        description="Facts are verified on each state's own site (sources in src/lib/registered-agent/jurisdiction-facts.ts). Ready means only the nationwide gates remain: the signed agreement, one provider test order, the switch and an approved price."
        bodyClassName="p-0"
      >
        <TableScroll variant="inset" className="rounded-none border-0">
          <Table>
            <THead>
              <tr>
                <TH>Jurisdiction</TH>
                <TH>Switch</TH>
                <TH>Change fee (LLC / corp.)</TH>
                <TH>Formation fee (LLC / corp.)</TH>
                <TH>New business</TH>
                <TH>Facts</TH>
                <TH>What is missing</TH>
              </tr>
            </THead>
            <tbody>
              {RA_JURISDICTIONS.map((j) => {
                const feeText = (llc: number | null, corp: number | null) => `${llc === null ? "?" : money(llc)} / ${corp === null ? "?" : money(corp)}`;
                const complete = raFactsComplete(j);
                return (
                  <TR key={j.code}>
                    <TD className="whitespace-nowrap">
                      {j.name} ({j.code}){(BUNDLE_STATES as readonly string[]).includes(j.code) ? " · bundle" : ""}
                    </TD>
                    <TD>{raSwitchOn(j.code) ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}</TD>
                    <TD className="whitespace-nowrap">{feeText(changeOfAgentFeeCents(j.code, "llc"), changeOfAgentFeeCents(j.code, "corporation"))}</TD>
                    <TD className="whitespace-nowrap">{feeText(formationFeeCents(j.code, "llc"), formationFeeCents(j.code, "corporation"))}</TD>
                    <TD>{j.appointmentProcess ? "Verified" : <span className="text-muted">Not verified</span>}</TD>
                    <TD>{complete ? <Badge tone="success">Verified, ready</Badge> : <Badge tone="warning">Not verified</Badge>}</TD>
                    <TD valign="top" className="max-w-xl text-muted">
                      {j.knownBlockers.length === 0 && j.providerCoverage !== "not_confirmed"
                        ? "Nothing in this jurisdiction"
                        : [...(j.providerCoverage === "not_confirmed" ? ["Provider coverage not confirmed."] : []), ...j.knownBlockers].join(" ")}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
      </Panel>
    </div>
  );
}
