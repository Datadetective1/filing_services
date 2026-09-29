import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CaretRight,
  CheckCircle,
  Clock,
  CreditCard,
  EnvelopeSimple,
  Lightning,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { AdminStatusBadge } from "@/components/admin/badges";
import { opsButton } from "@/components/admin/button-classes";
import { formatDate, formatDateTime, isoDaysAgo, money, opsDayStartIso, opsToday } from "@/components/admin/format";
import { ConsoleHeader, MetricTile, tableLink, TileGrid } from "@/components/admin/layout-bits";
import { CRITICAL_DAYS, DEADLINE_SENSITIVE_STATUSES, SOON_DAYS } from "@/components/admin/urgency";
import { cn } from "@/components/ui/cn";
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
    <div className="grid grid-cols-1 gap-8">
      <ConsoleHeader
        title="Today"
        description={`${formatLongDate(today)}. Counts use Eastern Time.`}
        actions={
          <Link href="/admin/queue" className={opsButton("primary")}>
            Open the queue
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section
          id="attention"
          aria-labelledby="attention-title"
          className="scroll-mt-6 rounded-[var(--radius-surface)] border border-border bg-surface shadow-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div className="grid gap-0.5">
              <h2 id="attention-title" className="text-[19px] font-semibold leading-snug text-fg">
                Needs attention first
              </h2>
              <p className="text-sm text-muted">Deadlines within {CRITICAL_DAYS} days, flagged payments, webhook errors and failed reminders.</p>
            </div>
            <span
              className={cn(
                "tnum inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold",
                exceptions ? "bg-highlight text-highlight-fg" : "bg-accent-soft text-accent-soft-fg",
              )}
            >
              {exceptions ? `${exceptions} critical ${exceptions === 1 ? "item" : "items"}` : "All clear"}
            </span>
          </div>
          {exceptions === 0 ? (
            <div className="flex items-start gap-3 px-5 py-8">
              <CheckCircle size={28} weight="fill" className="shrink-0 text-accent" aria-hidden />
              <div className="grid gap-0.5">
                <p className="font-display text-lg font-semibold text-fg">Nothing critical right now.</p>
                <p className="text-sm text-muted">Work the queue in deadline order. Anything urgent will show up here first.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {critical.map((f) => {
                const days = daysBetween(today, f.due_date);
                const overdue = days < 0;
                return (
                  <AttentionItem
                    key={f.id}
                    href={`/admin/filings/${f.id}`}
                    kind="Deadline"
                    icon={overdue ? WarningCircle : Clock}
                    tone={overdue ? "danger" : "highlight"}
                    meta={<span className={overdue ? "font-semibold text-danger" : "font-semibold text-warning"}>{describeDaysRemaining(days)}</span>}
                    title={one(f.businesses)?.legal_name ?? "Unknown business"}
                    detail={`Due ${formatDate(f.due_date)}`}
                    badge={<AdminStatusBadge status={f.status} />}
                  />
                );
              })}
              {criticalFilingCount > critical.length ? (
                <li className="px-5 py-3 text-sm text-muted">
                  And {criticalFilingCount - critical.length} more.{" "}
                  <Link className={tableLink} href={queueHref({ due_to: criticalDate, status: DEADLINE_SENSITIVE_STATUSES.join(",") })}>
                    Open in the queue
                  </Link>
                </li>
              ) : null}
              {review.map((p) => {
                const link = reviewLinks.get(p.order_id);
                return (
                  <AttentionItem
                    key={p.id}
                    href={link ? `/admin/filings/${link.filingId}#payment` : "/admin/payments#review"}
                    kind="Payment review"
                    icon={CreditCard}
                    tone="danger"
                    meta={<span className="tnum">{money(p.amount_cents)}</span>}
                    title={link?.businessName ?? "Payment"}
                    detail={p.review_reason ?? "Flagged for review"}
                  />
                );
              })}
              {errors.map((e) => (
                <AttentionItem
                  key={e.id}
                  href="/admin/payments#webhooks"
                  kind="Webhook error"
                  icon={Lightning}
                  tone="danger"
                  meta={<span className="tnum">{formatDateTime(e.received_at)}</span>}
                  title={`${e.provider} ${e.event_type}`}
                  detail={e.processing_error}
                />
              ))}
              {errorCount > errors.length ? (
                <li className="px-5 py-3 text-sm text-muted">
                  And {errorCount - errors.length} more webhook errors.{" "}
                  <Link className={tableLink} href="/admin/payments#webhooks">
                    View all
                  </Link>
                </li>
              ) : null}
              {failedReminderCount > 0 ? (
                <AttentionItem
                  href="/admin/reminders#recent"
                  kind="Reminders"
                  icon={EnvelopeSimple}
                  tone="danger"
                  title={`${failedReminderCount} reminder ${failedReminderCount === 1 ? "email" : "emails"} failed`}
                  detail="In the last 7 days"
                />
              ) : null}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="work-title"
          className="rounded-[var(--radius-surface)] border border-border bg-surface shadow-[0_1px_2px_rgb(23_35_29/0.04)]"
        >
          <div className="border-b border-border/70 px-5 py-4">
            <h2 id="work-title" className="text-[17px] font-semibold leading-snug text-fg">
              Work queue
            </h2>
            <p className="text-sm text-muted">Each line opens the matching filings.</p>
          </div>
          <ul className="divide-y divide-border/70">
            <WorkLine
              count={n(ready.count)}
              label="Ready to file"
              hint="Ready for review or ready to file"
              href={queueHref({ status: "ready_for_review,ready_to_file" })}
              tone="accent"
            />
            <WorkLine
              count={n(upcoming.count)}
              label="Upcoming deadlines"
              hint={`Active filings due in ${SOON_DAYS} days`}
              href={queueHref({ due_from: today, due_to: soonDate })}
              tone="warning"
            />
            <WorkLine
              count={n(waiting.count)}
              label="Needs customer information"
              hint="Waiting on the customer"
              href={queueHref({ status: "needs_information,needs_customer_action" })}
              tone="neutral"
            />
            <WorkLine count={n(rejected.count)} label="Rejected filings" hint="Need a fix and resubmission" href={queueHref({ status: "rejected" })} tone="danger" />
            <WorkLine count={n(failedPayments.count)} label="Failed payments" hint="Last 7 days" href="/admin/payments#failed" tone="danger" />
          </ul>
        </section>
      </div>

      <section aria-labelledby="numbers-title" className="grid gap-3">
        <h2 id="numbers-title" className="text-[17px] font-semibold text-fg">
          So far today
        </h2>
        <TileGrid cols={4}>
          <MetricTile label="Orders today" value={paidRows.length} hint="Paid since midnight" href="/admin/payments#recent" />
          <MetricTile
            label="Revenue today"
            value={money(revenueToday)}
            hint={`Service fees. Government fees collected: ${money(govToday)}`}
            href="/admin/payments#recent"
            tone={revenueToday > 0 ? "success" : "neutral"}
          />
          <MetricTile
            label="Completed today"
            value={n(completedToday.count)}
            hint="Receipts delivered"
            href={queueHref({ status: "completed" })}
            tone={n(completedToday.count) > 0 ? "success" : "neutral"}
          />
          <Link
            href="/admin/analytics"
            className="group grid min-h-[6.5rem] content-between gap-3 bg-surface px-5 py-4 transition-colors hover:bg-bg focus-visible:relative focus-visible:z-10"
          >
            <span className="flex items-start justify-between gap-2 text-[13px] font-medium text-muted">
              Funnel, last 7 days
              <CaretRight size={14} weight="bold" className="mt-0.5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
            <span className="tnum grid gap-1 text-sm text-fg">
              <span>
                <span className="font-display text-xl font-semibold">{n(checkoutStarts.count)}</span> checkouts started
              </span>
              <span>
                <span className="font-display text-xl font-semibold">{n(paymentsCompleted.count)}</span> payments completed
              </span>
            </span>
          </Link>
        </TileGrid>
      </section>
    </div>
  );
}

type AttentionTone = "danger" | "highlight";

const attentionIcon: Record<AttentionTone, string> = {
  danger: "bg-danger-soft text-danger",
  highlight: "bg-highlight-soft text-highlight-fg",
};

/** One row of the attention list: what it is, whose it is, and how late. */
function AttentionItem({
  href,
  kind,
  icon: ItemIcon,
  tone,
  meta,
  title,
  detail,
  badge,
}: {
  href: string;
  kind: string;
  icon: Icon;
  tone: AttentionTone;
  meta?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-4 transition-colors hover:bg-bg"
      >
        <span aria-hidden className={cn("grid size-10 place-items-center rounded-full", attentionIcon[tone])}>
          <ItemIcon size={20} weight="fill" />
        </span>
        <span className="grid min-w-0 gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            <span className="font-medium">{kind}</span>
            {meta ? (
              <>
                <span aria-hidden className="text-subtle">
                  ·
                </span>
                {meta}
              </>
            ) : null}
          </span>
          <span className="break-words font-display text-[17px] font-semibold leading-snug text-fg sm:truncate">{title}</span>
          {detail ? <span className="text-sm text-muted">{detail}</span> : null}
          {badge ? <span className="mt-1.5 sm:hidden">{badge}</span> : null}
        </span>
        <span className="flex items-center gap-3">
          {badge ? <span className="max-sm:hidden">{badge}</span> : null}
          <CaretRight size={16} weight="bold" className="text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

type WorkTone = "accent" | "warning" | "danger" | "neutral";

const workCount: Record<WorkTone, string> = {
  accent: "text-accent",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-fg",
};

/** A queue bucket: the count, what it means, and a link to those filings. */
function WorkLine({ count, label, hint, href, tone }: { count: number; label: string; hint: string; href: string; tone: WorkTone }) {
  return (
    <li>
      <Link href={href} className="group grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-bg">
        <span className={cn("tnum font-display text-[26px] font-semibold leading-none", count > 0 ? workCount[tone] : "text-subtle")}>{count}</span>
        <span className="grid min-w-0 gap-0.5">
          <span className="font-semibold text-fg">{label}</span>
          <span className="text-[13px] text-muted">{hint}</span>
        </span>
        <CaretRight size={16} weight="bold" className="text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}
