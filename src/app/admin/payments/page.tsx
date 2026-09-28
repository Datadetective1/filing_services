import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/admin/badges";
import { formatDateTime, humanize, isoDaysAgo, money, shortId } from "@/components/admin/format";
import { EmptyRow, JsonDetails, Panel, ScrollArea, tableLink } from "@/components/admin/layout-bits";
import { PaymentStatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/surface";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { filingIdsByOrder, profilesByIds, type ProfileEntry } from "../_lib/data";

export const metadata: Metadata = { title: "Payments" };

interface PaymentRow {
  id: string;
  order_id: string;
  user_id: string;
  provider: string;
  mode: string;
  status: string;
  amount_cents: number;
  amount_refunded_cents: number;
  failure_reason: string | null;
  requires_review: boolean;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface RefundRow {
  id: string;
  order_id: string;
  user_id: string;
  amount_cents: number;
  government_fee_cents: number;
  service_fee_cents: number;
  reason: string;
  status: string;
  created_at: string;
}

interface EventRow {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  received_at: string;
  processed_at: string | null;
  processing_error: string | null;
  attempts: number;
  payload: unknown;
}

const SECTIONS = [
  { id: "review", label: "Needs review" },
  { id: "failed", label: "Failed" },
  { id: "recent", label: "Recent" },
  { id: "refunds", label: "Refunds" },
  { id: "webhooks", label: "Webhook errors" },
];

export default async function PaymentsPage() {
  await requireStaff();
  const db = await createClient();
  const thirtyDaysAgo = isoDaysAgo(30);
  const cols = "id, order_id, user_id, provider, mode, status, amount_cents, amount_refunded_cents, failure_reason, requires_review, review_reason, created_at, updated_at";

  const [reviewRes, failedRes, recentRes, refundsRes, eventsRes, redeliveredRes, errorCountRes] = await Promise.all([
    db.from("payments").select(cols).eq("requires_review", true).order("updated_at", { ascending: false }).limit(100),
    db.from("payments").select(cols).eq("status", "failed").gte("updated_at", thirtyDaysAgo).order("updated_at", { ascending: false }).limit(100),
    db.from("payments").select(cols).order("created_at", { ascending: false }).limit(50),
    db.from("refunds").select("id, order_id, user_id, amount_cents, government_fee_cents, service_fee_cents, reason, status, created_at").order("created_at", { ascending: false }).limit(50),
    db
      .from("payment_events")
      .select("id, provider, provider_event_id, event_type, received_at, processed_at, processing_error, attempts, payload")
      .not("processing_error", "is", null)
      .order("received_at", { ascending: false })
      .limit(50),
    db.from("payment_events").select("id", { count: "exact", head: true }).gt("attempts", 1),
    db.from("payment_events").select("id", { count: "exact", head: true }).not("processing_error", "is", null).is("processed_at", null),
  ]);

  const review = (reviewRes.data ?? []) as PaymentRow[];
  const failed = (failedRes.data ?? []) as PaymentRow[];
  const recent = (recentRes.data ?? []) as PaymentRow[];
  const refunds = (refundsRes.data ?? []) as RefundRow[];
  const events = (eventsRes.data ?? []) as EventRow[];

  const allOrders = [...review, ...failed, ...recent, ...refunds].map((r) => r.order_id);
  const [filingLinks, customers] = await Promise.all([
    filingIdsByOrder(allOrders),
    profilesByIds([...review, ...failed, ...recent, ...refunds].map((r) => r.user_id)),
  ]);

  return (
    <div className="grid gap-5">
      <PageHeader title="Payments" description="Payment attempts, refunds and processor webhooks. Rows link to their filing where one exists." />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-surface)] border border-border bg-border md:grid-cols-5">
        <Stat label="Needs review" value={review.length} danger={review.length > 0} />
        <Stat label="Failed, last 30 days" value={failed.length} danger={failed.length > 0} />
        <Stat label="Unresolved webhook errors" value={errorCountRes.count ?? 0} danger={(errorCountRes.count ?? 0) > 0} />
        <Stat label="Redelivered events" value={redeliveredRes.count ?? 0} hint="Attempted more than once. Repeats of processed events are ignored." />
        <Stat label="Recent refunds" value={refunds.length} />
      </dl>

      <nav aria-label="Sections" className="flex flex-wrap gap-1 text-sm">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-muted hover:bg-surface-2 hover:text-fg">
            {s.label}
          </a>
        ))}
      </nav>

      <Panel id="review" title="Payments requiring review" description="Amount or currency mismatches and other anomalies flagged while processing." bodyClassName="p-0">
        <PaymentsTable rows={review} links={filingLinks} customers={customers} empty="No payments need review." showReason />
      </Panel>

      <Panel id="failed" title="Failed payments, last 30 days" bodyClassName="p-0">
        <PaymentsTable rows={failed} links={filingLinks} customers={customers} empty="No failed payments in the last 30 days." showReason />
      </Panel>

      <Panel id="recent" title="Recent payments" description="The latest 50 payment attempts." bodyClassName="p-0">
        <PaymentsTable rows={recent} links={filingLinks} customers={customers} empty="No payments yet." />
      </Panel>

      <Panel id="refunds" title="Refunds" description="Government and service portions are recorded separately." bodyClassName="p-0">
        {refunds.length ? (
          <ScrollArea>
            <Table className="min-w-[56rem]">
              <THead>
                <tr>
                  <TH>Requested</TH>
                  <TH>Filing</TH>
                  <TH>Customer</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Government</TH>
                  <TH className="text-right">Service</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Reason</TH>
                </tr>
              </THead>
              <tbody>
                {refunds.map((r) => (
                  <TR key={r.id}>
                    <TD className="tnum whitespace-nowrap">{formatDateTime(r.created_at)}</TD>
                    <TD>
                      <FilingLink link={filingLinks.get(r.order_id)} orderId={r.order_id} />
                    </TD>
                    <TD className="max-w-48 truncate text-muted">{customers.get(r.user_id)?.email ?? "Unknown"}</TD>
                    <TD>
                      <StatusPill status={r.status} />
                    </TD>
                    <TD className="tnum text-right">{money(r.government_fee_cents)}</TD>
                    <TD className="tnum text-right">{money(r.service_fee_cents)}</TD>
                    <TD className="tnum text-right font-medium">{money(r.amount_cents)}</TD>
                    <TD className="max-w-72 text-muted">{r.reason}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="px-4 py-3">
            <EmptyRow>No refunds yet.</EmptyRow>
          </div>
        )}
      </Panel>

      <Panel
        id="webhooks"
        title="Webhook events with processing errors"
        description="The processor retries failed deliveries. Events stay here as a record even after a retry succeeds."
        bodyClassName="p-0"
      >
        {events.length ? (
          <ScrollArea>
            <Table className="min-w-[56rem]">
              <THead>
                <tr>
                  <TH>Received</TH>
                  <TH>Event</TH>
                  <TH>State</TH>
                  <TH className="text-right">Attempts</TH>
                  <TH>Error</TH>
                </tr>
              </THead>
              <tbody>
                {events.map((e) => (
                  <TR key={e.id}>
                    <TD className="tnum whitespace-nowrap">{formatDateTime(e.received_at)}</TD>
                    <TD>
                      <span className="font-mono text-xs">{e.event_type}</span>
                      <span className="block text-xs text-muted">
                        {humanize(e.provider)} {e.provider_event_id}
                      </span>
                    </TD>
                    <TD>{e.processed_at ? <StatusPill status="resolved" tone="success" /> : <StatusPill status="unresolved" tone="danger" />}</TD>
                    <TD className="tnum text-right">{e.attempts}</TD>
                    <TD className="max-w-96">
                      <p className="text-danger">{e.processing_error}</p>
                      <JsonDetails label="Payload" value={e.payload} />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="px-4 py-3">
            <EmptyRow>No webhook processing errors.</EmptyRow>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value, hint, danger }: { label: string; value: number; hint?: string; danger?: boolean }) {
  return (
    <div className="grid gap-1 bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={danger ? "tnum text-xl font-semibold text-danger" : "tnum text-xl font-semibold text-fg"}>{value}</dd>
      {hint ? <dd className="text-xs text-subtle">{hint}</dd> : null}
    </div>
  );
}

function FilingLink({ link, orderId }: { link: { filingId: string; businessName: string | null } | undefined; orderId: string }) {
  if (!link) return <span className="font-mono text-xs text-muted">Order {shortId(orderId)}</span>;
  return (
    <Link className={`${tableLink} inline-block max-w-48 truncate align-top`} href={`/admin/filings/${link.filingId}#payment`}>
      {link.businessName ?? `Filing ${shortId(link.filingId)}`}
    </Link>
  );
}

function PaymentsTable({
  rows,
  links,
  customers,
  empty,
  showReason = false,
}: {
  rows: PaymentRow[];
  links: Map<string, { filingId: string; businessName: string | null }>;
  customers: Map<string, ProfileEntry>;
  empty: string;
  showReason?: boolean;
}) {
  if (!rows.length) {
    return (
      <div className="px-4 py-3">
        <EmptyRow>{empty}</EmptyRow>
      </div>
    );
  }
  return (
    <ScrollArea>
      <Table className="min-w-[60rem]">
        <THead>
          <tr>
            <TH>Created</TH>
            <TH>Filing</TH>
            <TH>Customer</TH>
            <TH>Provider</TH>
            <TH>Status</TH>
            <TH className="text-right">Amount</TH>
            <TH className="text-right">Refunded</TH>
            {showReason ? <TH>Reason</TH> : null}
          </tr>
        </THead>
        <tbody>
          {rows.map((p) => (
            <TR key={p.id}>
              <TD className="tnum whitespace-nowrap">{formatDateTime(p.created_at)}</TD>
              <TD>
                <FilingLink link={links.get(p.order_id)} orderId={p.order_id} />
              </TD>
              <TD className="max-w-48 truncate text-muted">{customers.get(p.user_id)?.email ?? "Unknown"}</TD>
              <TD className="whitespace-nowrap">
                {humanize(p.provider)} <span className="text-muted">({p.mode})</span>
              </TD>
              <TD>
                <div className="flex flex-wrap items-center gap-1">
                  <PaymentStatusBadge status={p.status} />
                  {p.requires_review ? <StatusPill status="needs review" tone="danger" /> : null}
                </div>
              </TD>
              <TD className="tnum text-right">{money(p.amount_cents)}</TD>
              <TD className="tnum text-right">{money(p.amount_refunded_cents)}</TD>
              {showReason ? <TD className="max-w-72 text-muted">{p.review_reason ?? p.failure_reason ?? ""}</TD> : null}
            </TR>
          ))}
        </tbody>
      </Table>
    </ScrollArea>
  );
}
