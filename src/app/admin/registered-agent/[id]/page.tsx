import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { formatDate, formatDateTime, isUuid, money, opsToday, shortId } from "@/components/admin/format";
import { ConsoleHeader, EmptyRow, KeyValues, Panel } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { requireStaff } from "@/lib/auth/session";
import { SERVICE_DOCUMENT_KIND_LABELS, SERVICE_DOCUMENT_KINDS, type ServiceDocumentKind } from "@/lib/registered-agent/documents";
import { getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import { providerEntrySheet } from "@/lib/registered-agent/manual-provider";
import { ENTITY_TYPE_LABELS, isEntityType } from "@/lib/domain/types";
import {
  nextOperatorAction,
  PROVIDER_ORDER_STATUS_LABELS,
  PROVIDER_ORDER_TRANSITIONS,
  providerCancellationDue,
  type BillingStatus,
  type ProviderOrderKind,
  type ProviderOrderStatus,
} from "@/lib/registered-agent/status";
import { PROVIDER_LEGAL_NAME, SERVICES } from "@/lib/services/catalog";
import { createClient } from "@/lib/supabase/server";
import { one } from "../../_lib/data";
import {
  notificationAttemptAction,
  providerCancelledAction,
  providerRenewalDateAction,
  replacementAgentAction,
  retryDocumentEmailAction,
  transitionAction,
  uploadDocumentAction,
} from "../actions";

export const metadata: Metadata = { title: "Registered agent service" };

const KIND_LABEL: Record<ProviderOrderKind, string> = {
  registered_agent: "Registered agent appointment",
  change_of_agent: "Change of agent filing",
  formation: "Formation filing",
};

export default async function RegisteredAgentDetailPage(props: PageProps<"/admin/registered-agent/[id]">) {
  await requireStaff();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const db = await createClient();
  const { data: sub } = await db.from("ra_subscriptions").select("*, businesses(legal_name, entity_type, state_entity_number)").eq("id", id).maybeSingle();
  if (!sub) notFound();
  const PAYMENT_COLUMNS = "id, order_id, status, amount_cents, purpose, mode, created_at, provider_invoice_id";
  const [{ data: orders }, { data: docs }, { data: years }, { data: firstPayments }, { data: renewalPayments }] = await Promise.all([
    db.from("provider_orders").select("*").eq("ra_subscription_id", id).order("created_at"),
    db.from("service_documents").select("*, document_notification_attempts(channel, status, note, created_at)").eq("ra_subscription_id", id).order("created_at", { ascending: false }),
    db.from("bundle_filing_periods").select("*").eq("ra_subscription_id", id).order("period_start"),
    sub.order_id ? db.from("payments").select(PAYMENT_COLUMNS).eq("order_id", sub.order_id) : Promise.resolve({ data: [] }),
    sub.provider_subscription_id
      ? db.from("payments").select(PAYMENT_COLUMNS).eq("provider_subscription_id", sub.provider_subscription_id).eq("purpose", "renewal")
      : Promise.resolve({ data: [] }),
  ]);
  const payments = [...((firstPayments ?? []) as { id: string; order_id: string; status: string; amount_cents: number; purpose: string; mode: string; created_at: string }[]), ...((renewalPayments ?? []) as { id: string; order_id: string; status: string; amount_cents: number; purpose: string; mode: string; created_at: string }[])].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const orderIds = (orders ?? []).map((o) => o.id as string);
  const { data: events } = orderIds.length
    ? await db.from("provider_order_events").select("*").in("provider_order_id", orderIds).order("created_at", { ascending: false })
    : { data: [] as Record<string, unknown>[] };
  const business = one(sub.businesses as { legal_name: string; entity_type: string; state_entity_number: string | null } | null);
  const stateName = getRaJurisdiction(sub.state_code)?.name ?? sub.state_code;
  const cancel = providerCancellationDue({
    billingStatus: sub.billing_status as BillingStatus,
    providerRenewalDate: sub.provider_renewal_date,
    providerCancelledAt: sub.provider_cancelled_at,
    today: opsToday(),
  });

  return (
    <div className="grid gap-6">
      <ConsoleHeader
        eyebrow={<Link href="/admin/registered-agent">Registered agent</Link>}
        title={`${business?.legal_name ?? "Business"} · ${stateName}`}
        description={`${SERVICES[sub.plan as "registered_agent" | "ra_annual_report_bundle"].name}, ${sub.origin === "switching" ? "switching from another agent" : "new entity"}. Agent of record: ${PROVIDER_LEGAL_NAME}.`}
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone={sub.service_status === "active" ? "success" : sub.service_status === "ended" ? "neutral" : "info"}>Service: {sub.service_status}</Badge>
          <Badge tone={sub.billing_status === "active" ? "success" : sub.billing_status === "pending" ? "neutral" : "danger"}>Billing: {sub.billing_status}</Badge>
          {sub.cancel_at_period_end ? <Badge tone="warning">Renewal off</Badge> : null}
        </div>
      </ConsoleHeader>

      {cancel.due ? (
        <Notice tone={cancel.late ? "danger" : "warning"} title="Cancel with the provider">
          <p>
            The customer hasn&apos;t paid and the provider renews this entity on {formatDate(sub.provider_renewal_date)} ({cancel.daysLeft} days). Cancel it in the partner dashboard
            {cancel.late ? " now: the 30-day notice window has started" : ""}, then record it below.
          </p>
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Service">
          <KeyValues
            items={[
              { term: "Entity", value: `${business?.entity_type ?? ""}${business?.state_entity_number ? ` · ${business.state_entity_number}` : ""}` },
              { term: "Billing period", value: sub.current_period_start ? `${formatDate(sub.current_period_start)} to ${formatDate(sub.current_period_end)}` : "Not started" },
              { term: "Renewal price", value: money(sub.renewal_price_cents) },
              { term: "Failed payments", value: String(sub.failed_payment_count) },
              { term: "Appointment confirmed", value: sub.appointment_confirmed_at ? `${formatDate(sub.appointment_confirmed_at)}: ${sub.appointment_evidence}` : "Not yet" },
              { term: "Provider renewal date", value: sub.provider_renewal_date ? formatDate(sub.provider_renewal_date) : "Not recorded" },
              { term: "Cancelled with provider", value: sub.provider_cancelled_at ? formatDateTime(sub.provider_cancelled_at) : "No" },
              { term: "Replacement agent", value: sub.replacement_agent_name ?? "None recorded" },
            ]}
          />
        </Panel>
        <Panel title="Contact for the provider" description="The provider may ask for these with 12 hours to answer. Give them from here.">
          <KeyValues
            items={[
              { term: "Name", value: sub.contact_name ?? "Missing" },
              { term: "Phone", value: sub.contact_phone ?? "Missing" },
              { term: "Address", value: sub.contact_address ?? "Missing" },
            ]}
          />
        </Panel>
      </div>

      {(orders ?? []).map((o) => {
        const kind = o.kind as ProviderOrderKind;
        const status = o.status as ProviderOrderStatus;
        const next = PROVIDER_ORDER_TRANSITIONS[status];
        return (
          <Panel
            key={o.id}
            title={`${KIND_LABEL[kind]} · ${PROVIDER_ORDER_STATUS_LABELS[status]}`}
            description={nextOperatorAction(kind, status) ?? undefined}
          >
            {status === "payment_confirmed" || status === "information_needed" || status === "ready_for_provider" ? (
              (() => {
                const sheet = providerEntrySheet({
                  kind,
                  legalName: business?.legal_name ?? "",
                  stateName,
                  entityTypeLabel: business && isEntityType(business.entity_type) ? ENTITY_TYPE_LABELS[business.entity_type] : (business?.entity_type ?? ""),
                  entityNumber: business?.state_entity_number ?? null,
                  contactName: sub.contact_name,
                  contactPhone: sub.contact_phone,
                  contactAddress: sub.contact_address,
                  currentAgentName: o.details?.current_agent_name ? String(o.details.current_agent_name) : null,
                });
                return (
                  <div className="mb-5 grid gap-2 rounded-[var(--radius-control)] border border-border bg-bg p-4">
                    <p className="text-sm font-semibold text-fg">Partner dashboard entry sheet</p>
                    {sheet.missing.length > 0 ? <p className="text-sm text-danger">Missing: {sheet.missing.join(", ")}. Ask the customer first.</p> : null}
                    <KeyValues items={sheet.rows.map((r) => ({ term: r.label, value: r.value || "Missing" }))} />
                  </div>
                );
              })()
            ) : null}
            <div className="grid gap-5 lg:grid-cols-2">
              <KeyValues
                items={[
                  { term: "Provider order number", value: o.provider_reference ?? "Not placed" },
                  { term: "Submitted", value: o.submitted_at ? formatDateTime(o.submitted_at) : "" },
                  { term: "Confirmed on", value: o.confirmed_on ? `${formatDate(o.confirmed_on)}: ${o.evidence}` : "" },
                  { term: "State fee collected", value: money(o.government_fee_cents) },
                  { term: "State fee paid", value: o.government_fee_remitted_cents === null ? "Not recorded" : money(o.government_fee_remitted_cents) },
                  { term: "Wholesale cost", value: money(o.wholesale_cost_cents) },
                  ...(o.details?.current_agent_name ? [{ term: "Current agent (from customer)", value: String(o.details.current_agent_name) }] : []),
                ]}
              />
              {next.length > 0 ? (
                <ActionForm action={transitionAction} submitLabel="Update order" pendingLabel="Saving...">
                  <input type="hidden" name="subscriptionId" value={sub.id} />
                  <input type="hidden" name="providerOrderId" value={o.id} />
                  <input type="hidden" name="expectedFrom" value={status} />
                  <Field label="Move to" htmlFor={`to-${o.id}`}>
                    <Select id={`to-${o.id}`} name="to" defaultValue={next[0]}>
                      {next.map((s) => (
                        <option key={s} value={s}>
                          {PROVIDER_ORDER_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Provider order number" htmlFor={`ref-${o.id}`} optional>
                    <Input id={`ref-${o.id}`} name="providerReference" maxLength={100} defaultValue={o.provider_reference ?? ""} />
                  </Field>
                  <Field label="Confirmed on (YYYY-MM-DD)" htmlFor={`conf-${o.id}`} optional hint="Required to mark active, completed or terminated.">
                    <Input id={`conf-${o.id}`} name="confirmedOn" type="date" />
                  </Field>
                  <Field label="Evidence" htmlFor={`ev-${o.id}`} optional hint="What you saw: the provider's confirmation, or the state record and the date you checked it.">
                    <Textarea id={`ev-${o.id}`} name="evidence" rows={2} maxLength={2000} />
                  </Field>
                  {kind !== "registered_agent" ? (
                    <Field label="State fee paid (dollars)" htmlFor={`fee-${o.id}`} optional>
                      <Input id={`fee-${o.id}`} name="governmentFeeRemitted" inputMode="decimal" />
                    </Field>
                  ) : null}
                  <Field label="Note" htmlFor={`note-${o.id}`} optional hint="Required when asking the customer for information; it is emailed to them.">
                    <Textarea id={`note-${o.id}`} name="note" rows={2} maxLength={2000} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="customerVisible" defaultChecked /> Show this update to the customer
                  </label>
                </ActionForm>
              ) : (
                <EmptyRow>No further steps.</EmptyRow>
              )}
            </div>
          </Panel>
        );
      })}

      <Panel title="Documents" description="Upload what the provider received. The customer is emailed at once; record calls for legal documents.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {(docs ?? []).length === 0 ? (
            <EmptyRow>No documents yet.</EmptyRow>
          ) : (
            <ul className="grid gap-4">
              {(docs ?? []).map((d) => (
                <li key={d.id} className="grid gap-2 rounded-[var(--radius-control)] border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={d.urgency === "urgent" ? "danger" : d.urgency === "high" ? "warning" : "neutral"}>{SERVICE_DOCUMENT_KIND_LABELS[d.kind as ServiceDocumentKind]}</Badge>
                    <a className="text-sm font-semibold underline" href={`/api/service-documents/${d.id}`}>
                      {d.file_name}
                    </a>
                  </div>
                  <p className="text-sm text-muted">
                    Provider received {d.provider_received_at ? formatDateTime(d.provider_received_at) : "(not recorded)"} · available {formatDateTime(d.available_to_filewell_at)} · customer notified{" "}
                    {d.customer_notified_at ? formatDateTime(d.customer_notified_at) : "not yet"}
                    {d.billable_mail ? " · billable mail item" : ""}
                  </p>
                  {d.summary ? <p className="text-sm">{d.summary}</p> : null}
                  {(d.document_notification_attempts ?? []).length > 0 ? (
                    <ul className="text-xs text-muted">
                      {(d.document_notification_attempts as { channel: string; status: string; note: string | null; created_at: string }[]).map((a, i) => (
                        <li key={i}>
                          {formatDateTime(a.created_at)}: {a.channel} {a.status}
                          {a.note ? ` (${a.note})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {!d.customer_notified_at ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ActionForm action={retryDocumentEmailAction} submitLabel="Retry email" resetOnSuccess={false}>
                        <input type="hidden" name="subscriptionId" value={sub.id} />
                        <input type="hidden" name="documentId" value={d.id} />
                      </ActionForm>
                      <ActionForm action={notificationAttemptAction} submitLabel="Record contact">
                        <input type="hidden" name="subscriptionId" value={sub.id} />
                        <input type="hidden" name="documentId" value={d.id} />
                        <Select name="channel" aria-label="Channel" defaultValue="phone">
                          <option value="phone">Phone</option>
                          <option value="sms">Text</option>
                          <option value="email">Email</option>
                        </Select>
                        <Select name="status" aria-label="Result" defaultValue="delivered">
                          <option value="delivered">Reached the customer</option>
                          <option value="acknowledged">Customer confirmed receipt</option>
                          <option value="failed">Couldn&apos;t reach them</option>
                          <option value="sent">Left a message</option>
                        </Select>
                        <Input name="note" aria-label="Note" maxLength={1000} placeholder="Note (optional)" />
                      </ActionForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={uploadDocumentAction} submitLabel="Upload and notify" pendingLabel="Uploading...">
            <input type="hidden" name="subscriptionId" value={sub.id} />
            <Field label="Kind" htmlFor="doc-kind">
              <Select id="doc-kind" name="kind" defaultValue="service_of_process">
                {SERVICE_DOCUMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SERVICE_DOCUMENT_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="File (PDF, PNG or JPEG, 4 MB max)" htmlFor="doc-file">
              <Input id="doc-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required />
            </Field>
            <Field label="When the provider received it" htmlFor="doc-received" optional>
              <Input id="doc-received" name="providerReceivedAt" type="datetime-local" />
            </Field>
            <Field label="Short summary for the customer" htmlFor="doc-summary" optional>
              <Textarea id="doc-summary" name="summary" rows={2} maxLength={1000} />
            </Field>
          </ActionForm>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Provider renewal date" description="From the partner dashboard. Unpaid entities must be cancelled 30 days before it.">
          <ActionForm action={providerRenewalDateAction} submitLabel="Save date" resetOnSuccess={false}>
            <input type="hidden" name="subscriptionId" value={sub.id} />
            <Input name="date" type="date" aria-label="Provider renewal date" defaultValue={sub.provider_renewal_date ?? ""} required />
          </ActionForm>
        </Panel>
        <Panel title="Replacement agent" description="Before ending service, record who the customer named instead.">
          <ActionForm action={replacementAgentAction} submitLabel="Record">
            <input type="hidden" name="subscriptionId" value={sub.id} />
            <Input name="name" aria-label="New agent's name" maxLength={200} required />
          </ActionForm>
        </Panel>
        <Panel title="Cancelled with provider" description="Only for a customer who hasn't paid or has left.">
          <ActionForm action={providerCancelledAction} submitLabel="Record cancellation" variant="danger" confirmLabel="I cancelled this entity in the partner dashboard">
            <input type="hidden" name="subscriptionId" value={sub.id} />
            <Input name="note" aria-label="What you did" maxLength={500} required placeholder="Date and dashboard confirmation" />
          </ActionForm>
        </Panel>
      </div>

      {(years ?? []).length > 0 ? (
        <Panel title="Bundle years" description="Billing years and the annual report each includes. The state fee is charged only when the customer authorizes that filing.">
          <ul className="grid gap-1 text-sm">
            {(years ?? []).map((y) => (
              <li key={y.id}>
                {formatDate(y.period_start)} to {formatDate(y.period_end)}: {y.reporting_year ? `${y.reporting_year} report` : "no report"} · {y.status} · state fee {y.state_fee_collection}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Payments" bodyClassName="p-0">
        <TableScroll variant="inset" className="rounded-none border-0">
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Purpose</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Mode</TH>
              </tr>
            </THead>
            <tbody>
              {payments.map((p) => (
                <TR key={p.id}>
                  <TD>{formatDateTime(p.created_at)}</TD>
                  <TD>{p.purpose}</TD>
                  <TD className="tnum">{money(p.amount_cents)}</TD>
                  <TD>{p.status}</TD>
                  <TD>
                    {p.mode} · order {shortId(p.order_id)}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </Panel>

      <Panel title="History" description="Every status change, including internal ones.">
        <ul className="grid gap-1 text-sm">
          {(events ?? []).map((e) => (
            <li key={String(e.id)}>
              {formatDateTime(String(e.created_at))}: {PROVIDER_ORDER_STATUS_LABELS[e.to_status as ProviderOrderStatus]} ({String(e.actor_type)}
              {e.customer_visible ? "" : ", internal"}){e.note ? `: ${String(e.note)}` : ""}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
