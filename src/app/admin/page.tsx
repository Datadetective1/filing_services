import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import { AdminStatusBadge } from "@/components/admin/badges";
import { formatDate, formatDateTime, isoDaysAgo, money, opsDayStartIso, opsToday } from "@/components/admin/format";
import { MetricTile, Panel, tableLink, TileGrid } from "@/components/admin/layout-bits";
import { CRITICAL_DAYS, DEADLINE_SENSITIVE_STATUSES, SOON_DAYS } from "@/components/admin/urgency";
import { PageHeader } from "@/components/ui/surface";
import { requireStaff } from "@/lib/auth/session";
import { addDays, daysBetween, describeDaysRemaining, formatLongDate } from "@/lib/domain/dates";
import { ACTIVE_OPERATIONS_STATUSES } from "@/lib/domain/filing-status";
import { createClient } from "@/lib/supabase/server";
import { filingIdsByOrder, one } from "./_lib/data";

export const metadata: Metadata = { title: "Today" };

interface CriticalFiling {
  id: string;
  due_date: string;
  status: string;
  businesses: { legal_name: string } | { legal_name: string }[] | null;
}

interface ReviewPayment {
  id: string;
  order_id: string;
  amount_cents: number;
  review_reason: string | null;
  updated_at: string;
}

interface EventError {
  id: string;
  provider: string;
  event_type: string;
  processing_error: string | null;
  received_at: string;
}

export default async function TodayPage() {
  await requireStaff();
  const db = await createClient();
  const today = opsToday();
  const startOfToday = opsDayStartIso(0);
  const sevenDaysAgo = isoDaysAgo(7);
  const soonDate = addDays(today, SOON_DAYS);
  const criticalDate = addDays(today, CRITICAL_DAYS);

  const [upcoming, paidToday, ready, waiting, failedPayments, rejected, criticalFilings, reviewPayments, eventErrors, failedReminders, completedToday, checkoutStarts, paymentsCompleted] =
    await Promise.all([
      db
        .from("filings")
        .select("id", { count: "exact", head: true })
        .in("status", [...ACTIVE_OPERATIONS_STATUSES])
        .gte("due_date", today)
        .lte("due_date", soonDate),
      db.from("orders").select("id, service_fee_cents, government_fee_cents").gte("paid_at", startOfToday).limit(5000),
      db.from("filings").select("id", { count: "exact", head: true }).in("status", ["ready_for_review", "ready_to_file"]),
      db.from("filings").select("id", { count: "exact", head: true }).in("status", ["needs_information", "needs_customer_action"]),
      db.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed").gte("updated_at", sevenDaysAgo),
      db.from("filings").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      db
        .from("filings")
        .select("id, due_date, status, businesses(legal_name)", { count: "exact" })
        .in("status", [...DEADLINE_SENSITIVE_STATUSES])
        .lte("due_date", criticalDate)
        .order("due_date", { ascending: true })
        .limit(25),
      db.from("payments").select("id, order_id, amount_cents, review_reason, updated_at", { count: "exact" }).eq("requires_review", true).order("updated_at", { ascending: false }).limit(25),
      db
        .from("payment_events")
        .select("id, provider, event_type, processing_error, received_at", { count: "exact" })
        .not("processing_error", "is", null)
        .is("processed_at", null)
        .order("received_at", { ascending: false })
        .limit(10),
      db.from("reminders").select("id", { count: "exact", head: true }).eq("status", "failed").gte("processed_at", sevenDaysAgo),
      db.from("filings").select("id", { count: "exact", head: true }).gte("completed_at", startOfToday),
      db.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "checkout_started").gte("created_at", sevenDaysAgo),
      db.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "payment_completed").gte("created_at", sevenDaysAgo),
    ]);

  const paidRows = (paidToday.data ?? []) as { id: string; service_fee_cents: number; government_fee_cents: number }[];
  const revenueToday = paidRows.reduce((s, o) => s + o.service_fee_cents, 0);
  const govToday = paidRows.reduce((s, o) => s + o.government_fee_cents, 0);

  const critical = (criticalFilings.data ?? []) as CriticalFiling[];
  const review = (reviewPayments.data ?? []) as ReviewPayment[];
  const errors = (eventErrors.data ?? []) as EventError[];
  const criticalFilingCount = criticalFilings.count ?? critical.length;
  const reviewCount = reviewPayments.count ?? review.length;
  const errorCount = eventErrors.count ?? errors.length;
  const failedReminderCount = failedReminders.count ?? 0;
  const exceptions = criticalFilingCount + reviewCount + errorCount + failedReminderCount;
  const reviewLinks = await filingIdsByOrder(review.map((p) => p.order_id));

  const n = (v: number | null | undefined) => v ?? 0;
  const queueHref = (qs: Record<string, string>) => `/admin/queue?${new URLSearchParams(qs).toString()}`;

  return (
    <div className="grid gap-6">
      <PageHeader title="Today" description={`${formatLongDate(today)}. Counts use Eastern Time.`} />

      <TileGrid>
        <MetricTile
          label="Upcoming deadlines"
          value={n(upcoming.count)}
          hint={`Active filings due in ${SOON_DAYS} days`}
          href={queueHref({ due_from: today, due_to: soonDate })}
          tone={n(upcoming.count) > 0 ? "warning" : "neutral"}
        />
        <MetricTile label="Orders today" value={paidRows.length} hint="Paid since midnight" href="/admin/payments#recent" />
        <MetricTile
          label="Revenue today"
          value={money(revenueToday)}
          hint={`Service fees. Government fees collected: ${money(govToday)}`}
          href="/admin/payments#recent"
          tone={revenueToday > 0 ? "success" : "neutral"}
        />
        <MetricTile label="Ready to file" value={n(ready.count)} hint="Ready for review or ready to file" href={queueHref({ status: "ready_for_review,ready_to_file" })} />
        <MetricTile
          label="Needs customer information"
          value={n(waiting.count)}
          hint="Waiting on the customer"
          href={queueHref({ status: "needs_information,needs_customer_action" })}
        />
        <MetricTile
          label="Failed payments"
          value={n(failedPayments.count)}
          hint="Last 7 days"
          href="/admin/payments#failed"
          tone={n(failedPayments.count) > 0 ? "danger" : "neutral"}
        />
        <MetricTile
          label="Rejected filings"
          value={n(rejected.count)}
          hint="Need a fix and resubmission"
          href={queueHref({ status: "rejected" })}
          tone={n(rejected.count) > 0 ? "danger" : "neutral"}
        />
        <MetricTile
          label="Critical exceptions"
          value={exceptions}
          hint="See the list below"
          href="#attention"
          tone={exceptions > 0 ? "danger" : "neutral"}
        />
        <MetricTile label="Completed today" value={n(completedToday.count)} hint="Receipts delivered" href={queueHref({ status: "completed" })} tone={n(completedToday.count) > 0 ? "success" : "neutral"} />
        <Link
          href="/admin/analytics"
          className="group grid min-h-[5.75rem] content-between gap-2 bg-surface px-4 py-3 transition-colors hover:bg-surface-2"
        >
          <span className="flex items-start justify-between gap-2 text-sm text-muted">
            Funnel, last 7 days
            <ArrowRight size={14} weight="bold" className="mt-1 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
          <span className="tnum text-sm text-fg">
            <span className="text-lg font-semibold">{n(checkoutStarts.count)}</span> checkouts started
            <br />
            <span className="text-lg font-semibold">{n(paymentsCompleted.count)}</span> payments completed
          </span>
        </Link>
      </TileGrid>

      <Panel
        id="attention"
        title="Needs attention"
        description={exceptions ? `${exceptions} critical ${exceptions === 1 ? "item" : "items"}` : undefined}
        bodyClassName="p-0"
      >
        {exceptions === 0 ? (
          <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted">
            <CheckCircle size={18} weight="fill" className="text-accent" aria-hidden />
            Nothing critical right now.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {critical.map((f) => {
              const days = daysBetween(today, f.due_date);
              return (
                <AttentionItem key={f.id} href={`/admin/filings/${f.id}`} kind="Deadline">
                  <span className="font-medium text-fg">{one(f.businesses)?.legal_name ?? "Unknown business"}</span>
                  <span className="text-muted">
                    {" "}
                    due {formatDate(f.due_date)},{" "}
                    <span className={days < 0 ? "font-medium text-danger" : "text-warning"}>{describeDaysRemaining(days).toLowerCase()}</span>
                  </span>
                  <span className="ml-2 inline-block align-middle">
                    <AdminStatusBadge status={f.status} />
                  </span>
                </AttentionItem>
              );
            })}
            {criticalFilingCount > critical.length ? (
              <li className="px-4 py-2 text-sm text-muted">
                And {criticalFilingCount - critical.length} more.{" "}
                <Link className={tableLink} href={queueHref({ due_to: criticalDate, status: DEADLINE_SENSITIVE_STATUSES.join(",") })}>
                  Open in the queue
                </Link>
              </li>
            ) : null}
            {review.map((p) => {
              const link = reviewLinks.get(p.order_id);
              return (
                <AttentionItem key={p.id} href={link ? `/admin/filings/${link.filingId}#payment` : "/admin/payments#review"} kind="Payment review">
                  <span className="font-medium text-fg">{link?.businessName ?? "Payment"}</span>
                  <span className="text-muted">
                    {" "}
                    {money(p.amount_cents)}: {p.review_reason ?? "Flagged for review"}
                  </span>
                </AttentionItem>
              );
            })}
            {errors.map((e) => (
              <AttentionItem key={e.id} href="/admin/payments#webhooks" kind="Webhook error">
                <span className="font-medium text-fg">
                  {e.provider} {e.event_type}
                </span>
                <span className="text-muted">
                  {" "}
                  {formatDateTime(e.received_at)}: {e.processing_error}
                </span>
              </AttentionItem>
            ))}
            {errorCount > errors.length ? (
              <li className="px-4 py-2 text-sm text-muted">
                And {errorCount - errors.length} more webhook errors.{" "}
                <Link className={tableLink} href="/admin/payments#webhooks">
                  View all
                </Link>
              </li>
            ) : null}
            {failedReminderCount > 0 ? (
              <AttentionItem href="/admin/reminders#recent" kind="Reminders">
                <span className="font-medium text-fg">
                  {failedReminderCount} reminder {failedReminderCount === 1 ? "email" : "emails"} failed
                </span>
                <span className="text-muted"> in the last 7 days</span>
              </AttentionItem>
            ) : null}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AttentionItem({ href, kind, children }: { href: string; kind: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex min-h-11 items-start gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
        <Warning size={16} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-hidden />
        <span className="w-28 shrink-0 text-xs font-medium text-muted">{kind}</span>
        <span className="min-w-0 flex-1">{children}</span>
      </Link>
    </li>
  );
}
