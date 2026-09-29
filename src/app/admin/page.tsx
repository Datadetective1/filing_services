import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CaretRight,
  ChatCircleText,
  CheckCircle,
  Clock,
  CreditCard,
  CurrencyCircleDollar,
  EnvelopeSimple,
  HourglassMedium,
  Lightning,
  ListChecks,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { AdminStatusBadge, TestOrderBadge } from "@/components/admin/badges";
import { opsButton } from "@/components/admin/button-classes";
import { formatDate, formatDateTime, isoDaysAgo, money, opsDayStartIso, opsToday } from "@/components/admin/format";
import { ConsoleHeader, KeyValues, MetricTile, tableLink, TileGrid } from "@/components/admin/layout-bits";
import {
  customerWroteLast,
  isTestPayment,
  MONEY_HELD_ORDER_STATUSES,
  operatorNextStep,
  servicePriceApproval,
  supabaseEnvironment,
  type NextStep,
} from "@/components/admin/operator-guidance";
import { CRITICAL_DAYS, DEADLINE_SENSITIVE_STATUSES, SOON_DAYS } from "@/components/admin/urgency";
import { cn } from "@/components/ui/cn";
import { isIndexable } from "@/config/site";
import { requireStaff } from "@/lib/auth/session";
import { isRuleSellable, rulesForState } from "@/lib/compliance/registry";
import { addDays, daysBetween, describeDaysRemaining, formatLongDate } from "@/lib/domain/dates";
import { ACTIVE_OPERATIONS_STATUSES, isFilingStatus } from "@/lib/domain/filing-status";
import type { ServicePrice } from "@/lib/domain/pricing";
import { getEmailReadiness } from "@/lib/email/provider";
import { getPaymentReadiness } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { filingIdsByOrder, one } from "./_lib/data";

export const metadata: Metadata = { title: "Today" };

interface CriticalFiling {
  id: string;
  due_date: string;
  status: string;
  businesses: { legal_name: string } | { legal_name: string }[] | null;
  orders: { payment_mode: string } | { payment_mode: string }[] | null;
}

interface PaidOrder {
  status: string;
  payment_mode: string;
}

interface PaidFiling {
  id: string;
  due_date: string;
  status: string;
  businesses: { legal_name: string } | { legal_name: string }[] | null;
  orders: PaidOrder | PaidOrder[] | null;
}

interface NextStepRow {
  filing: PaidFiling;
  order: PaidOrder | null;
  step: NextStep;
}

/** Paid filings listed in "Your next step". Beyond this, the list links to the queue. */
const NEXT_STEP_LIMIT = 100;

interface ReviewPayment {
  id: string;
  order_id: string;
  mode: string;
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

  const [upcoming, paidToday, ready, waiting, failedPayments, rejected, criticalFilings, reviewPayments, eventErrors, failedReminders, completedToday, checkoutStarts, paymentsCompleted, paidFilings, activePrices, failedEmails] =
    await Promise.all([
      db
        .from("filings")
        .select("id", { count: "exact", head: true })
        .in("status", [...ACTIVE_OPERATIONS_STATUSES])
        .gte("due_date", today)
        .lte("due_date", soonDate),
      db.from("orders").select("id, service_fee_cents, government_fee_cents, payment_mode").gte("paid_at", startOfToday).limit(5000),
      db.from("filings").select("id", { count: "exact", head: true }).in("status", ["ready_for_review", "ready_to_file"]),
      db.from("filings").select("id", { count: "exact", head: true }).in("status", ["needs_information", "needs_customer_action"]),
      db.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed").gte("updated_at", sevenDaysAgo),
      db.from("filings").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      db
        .from("filings")
        .select("id, due_date, status, businesses(legal_name), orders(payment_mode)", { count: "exact" })
        .in("status", [...DEADLINE_SENSITIVE_STATUSES])
        .lte("due_date", criticalDate)
        .order("due_date", { ascending: true })
        .limit(25),
      db.from("payments").select("id, order_id, mode, amount_cents, review_reason, updated_at", { count: "exact" }).eq("requires_review", true).order("updated_at", { ascending: false }).limit(25),
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
      // Every paid filing that may need the operator: active work, plus cancelled orders still holding money.
      db
        .from("filings")
        .select("id, due_date, status, businesses(legal_name), orders!inner(status, payment_mode)", { count: "exact" })
        .in("status", [...ACTIVE_OPERATIONS_STATUSES, "cancelled"])
        .in("orders.status", [...MONEY_HELD_ORDER_STATUSES])
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(NEXT_STEP_LIMIT),
      db.from("service_prices").select("id, filing_type_code, state_code, entity_type, service_fee_cents, approved, active").eq("active", true),
      // Customer emails (not reminders, counted above) that the provider refused.
      db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .not("template_key", "like", "reminder_%")
        .not("template_key", "like", "staff_%")
        .gte("created_at", sevenDaysAgo),
    ]);

  // Money: only live payments count. Sandbox and test-mode orders collected nothing.
  const allPaidRows = (paidToday.data ?? []) as { id: string; service_fee_cents: number; government_fee_cents: number; payment_mode: string }[];
  const paidRows = allPaidRows.filter((o) => o.payment_mode === "live");
  const testOrdersToday = allPaidRows.length - paidRows.length;
  const revenueToday = paidRows.reduce((s, o) => s + o.service_fee_cents, 0);
  const govToday = paidRows.reduce((s, o) => s + o.government_fee_cents, 0);

  // Your next step, per paid filing. A customer message newer than our last message and our
  // last status change overrides the status step.
  const paid = (paidFilings.data ?? []) as PaidFiling[];
  const paidIds = paid.map((f) => f.id);
  const [{ data: messageRows }, { data: staffChangeRows }] = paidIds.length
    ? await Promise.all([
        db.from("messages").select("filing_id, author_type, created_at").in("filing_id", paidIds).order("created_at", { ascending: false }).limit(2000),
        db
          .from("filing_status_history")
          .select("filing_id, created_at")
          .eq("actor_type", "staff")
          .in("filing_id", paidIds)
          .order("created_at", { ascending: false })
          .limit(2000),
      ])
    : [{ data: [] }, { data: [] }];
  const messagesByFiling = new Map<string, { author_type: string; created_at: string }[]>();
  for (const m of (messageRows ?? []) as { filing_id: string; author_type: string; created_at: string }[]) {
    const list = messagesByFiling.get(m.filing_id) ?? [];
    list.push(m);
    messagesByFiling.set(m.filing_id, list);
  }
  // Newest first, so the first row seen per filing is its latest staff status change.
  const lastStaffChange = new Map<string, string>();
  for (const h of (staffChangeRows ?? []) as { filing_id: string; created_at: string }[]) {
    if (!lastStaffChange.has(h.filing_id)) lastStaffChange.set(h.filing_id, h.created_at);
  }
  const nextSteps: NextStepRow[] = [];
  for (const f of paid) {
    const order = one(f.orders);
    const customerReplied = customerWroteLast(messagesByFiling.get(f.id) ?? [], lastStaffChange.get(f.id) ?? null);
    const step = operatorNextStep({ status: f.status, orderStatus: order?.status, customerReplied });
    if (step) nextSteps.push({ filing: f, order, step });
  }
  const needsYouCount = nextSteps.filter((r) => r.step.kind === "action").length;
  const paidFilingCount = paidFilings.count ?? paid.length;

  // Staff-only status: what this deployment does right now. Names and modes only, never secrets.
  const payments = getPaymentReadiness();
  const email = getEmailReadiness();
  const database = supabaseEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const paPrices = servicePriceApproval(
    ((activePrices.data ?? []) as Record<string, unknown>[]).map(
      (p): ServicePrice => ({
        id: String(p.id),
        filingTypeCode: String(p.filing_type_code),
        stateCode: (p.state_code as string | null) ?? null,
        entityType: (p.entity_type as string | null) ?? null,
        serviceFeeCents: Number(p.service_fee_cents),
        approved: Boolean(p.approved),
        active: Boolean(p.active),
      }),
    ),
    "PA",
    rulesForState("PA")
      .filter(isRuleSellable)
      .map((r) => r.entityType),
  );

  const critical = (criticalFilings.data ?? []) as CriticalFiling[];
  const review = (reviewPayments.data ?? []) as ReviewPayment[];
  const errors = (eventErrors.data ?? []) as EventError[];
  const criticalFilingCount = criticalFilings.count ?? critical.length;
  const reviewCount = reviewPayments.count ?? review.length;
  const errorCount = eventErrors.count ?? errors.length;
  const failedReminderCount = failedReminders.count ?? 0;
  const failedEmailCount = failedEmails.count ?? 0;
  const exceptions = criticalFilingCount + reviewCount + errorCount + failedReminderCount + failedEmailCount;
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

      <section
        id="next-steps"
        aria-labelledby="next-steps-title"
        className="scroll-mt-6 rounded-[var(--radius-surface)] border border-border bg-surface shadow-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="grid gap-0.5">
            <h2 id="next-steps-title" className="text-[19px] font-semibold leading-snug text-fg">
              Your next step for each paid customer
            </h2>
            <p className="text-sm text-muted">Soonest deadline first. Rows marked TEST collected no money: never file them with the state.</p>
          </div>
          <span
            className={cn(
              "tnum inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold",
              needsYouCount ? "bg-highlight text-highlight-fg" : "bg-accent-soft text-accent-soft-fg",
            )}
          >
            {needsYouCount ? `${needsYouCount} ${needsYouCount === 1 ? "needs" : "need"} you` : "Nothing to do"}
          </span>
        </div>
        {paidFilings.error ? (
          <p role="alert" className="px-5 py-4 text-sm font-medium text-danger">
            Paid orders could not be loaded: {paidFilings.error.message}. Open the queue instead.
          </p>
        ) : nextSteps.length === 0 ? (
          <div className="flex items-start gap-3 px-5 py-8">
            <CheckCircle size={28} weight="fill" className="shrink-0 text-accent" aria-hidden />
            <p className="text-sm text-muted">No paid orders need you right now.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {nextSteps.map(({ filing: f, order, step }) => {
              const days = daysBetween(today, f.due_date);
              const sensitive = isFilingStatus(f.status) && DEADLINE_SENSITIVE_STATUSES.includes(f.status);
              const overdue = sensitive && days < 0;
              const waiting = step.kind === "waiting";
              return (
                <AttentionItem
                  key={f.id}
                  href={`/admin/filings/${f.id}`}
                  kind={`Due ${formatDate(f.due_date)}`}
                  icon={
                    step.reason === "customer_replied"
                      ? ChatCircleText
                      : step.reason === "refund_owed"
                        ? CurrencyCircleDollar
                        : waiting
                          ? HourglassMedium
                          : overdue
                            ? WarningCircle
                            : ListChecks
                  }
                  tone={waiting ? "neutral" : overdue ? "danger" : "highlight"}
                  meta={
                    sensitive ? (
                      <span className={overdue ? "font-semibold text-danger" : days <= CRITICAL_DAYS ? "font-semibold text-warning" : undefined}>
                        {describeDaysRemaining(days)}
                      </span>
                    ) : undefined
                  }
                  title={one(f.businesses)?.legal_name ?? "Unknown business"}
                  detail={<span className={waiting ? undefined : "font-medium text-fg"}>{step.instruction}</span>}
                  badge={
                    <span className="flex flex-wrap items-center gap-2">
                      <TestOrderBadge mode={order?.payment_mode} />
                      <AdminStatusBadge status={f.status} />
                    </span>
                  }
                />
              );
            })}
            {paidFilingCount > paid.length ? (
              <li className="px-5 py-3 text-sm text-muted">
                Showing the first {paid.length} paid filings.{" "}
                <Link className={tableLink} href="/admin/queue">
                  Open the queue for the rest
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </section>

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
              <p className="text-sm text-muted">Deadlines within {CRITICAL_DAYS} days, flagged payments, webhook errors and failed emails.</p>
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
                    badge={
                      <span className="flex flex-wrap items-center gap-2">
                        <TestOrderBadge mode={one(f.orders)?.payment_mode} />
                        <AdminStatusBadge status={f.status} />
                      </span>
                    }
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
                    badge={isTestPayment(p.mode) ? <TestOrderBadge mode={p.mode} /> : undefined}
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
              {failedEmailCount > 0 ? (
                <AttentionItem
                  href="/admin/notifications?status=failed"
                  kind="Customer emails"
                  icon={EnvelopeSimple}
                  tone="danger"
                  title={`${failedEmailCount} customer ${failedEmailCount === 1 ? "email" : "emails"} failed`}
                  detail="In the last 7 days. Contact those customers directly."
                />
              ) : null}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6">
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

          <section
            aria-labelledby="system-title"
            className="rounded-[var(--radius-surface)] border border-border bg-surface shadow-[0_1px_2px_rgb(23_35_29/0.04)]"
          >
            <div className="border-b border-border/70 px-5 py-4">
              <h2 id="system-title" className="text-[17px] font-semibold leading-snug text-fg">
                System status
              </h2>
              <p className="text-sm text-muted">Staff only. What this deployment does right now.</p>
            </div>
            <KeyValues
              className="px-5 py-4"
              items={[
                {
                  term: "Payments",
                  value: (
                    <StatusValue
                      good={payments.mode === "live"}
                      text={
                        payments.mode === "live"
                          ? "Live: real charges"
                          : payments.mode === "disabled"
                            ? "Off: checkout is disabled"
                            : `${payments.mode === "test" ? "Test mode" : "Sandbox"}: no real money`
                      }
                      note={payments.reason}
                    />
                  ),
                },
                {
                  term: "Customer email",
                  value: (
                    <StatusValue
                      good={email.delivering}
                      text={
                        email.mode === "resend" && email.delivering
                          ? `Delivering (Resend)${email.from ? ` from ${email.from}` : ""}`
                          : email.mode === "misconfigured"
                            ? "Misconfigured: emails fail"
                            : "Outbox: recorded, not delivered"
                      }
                      note={email.delivering ? null : email.reason}
                    />
                  ),
                },
                {
                  term: "Database",
                  value: <StatusValue good={database.label === "Production"} text={`${database.label}${database.ref ? ` (${database.ref})` : ""}`} />,
                },
                {
                  term: "PA service price",
                  value: (
                    <StatusValue
                      good={paPrices.unapproved === 0 && paPrices.missing === 0 && paPrices.approved > 0}
                      text={
                        paPrices.missing > 0
                          ? "Not configured for every entity type"
                          : paPrices.unapproved > 0
                            ? "Not approved: live checkout refuses it"
                            : "Approved"
                      }
                    />
                  ),
                },
                { term: "Search indexing", value: <StatusValue good={isIndexable()} text={isIndexable() ? "On" : "Off"} /> },
              ]}
            />
          </section>
        </div>
      </div>

      <section aria-labelledby="numbers-title" className="grid gap-3">
        <h2 id="numbers-title" className="text-[17px] font-semibold text-fg">
          So far today
        </h2>
        <TileGrid cols={4}>
          <MetricTile
            label="Orders today"
            value={paidRows.length}
            hint={`Live payments since midnight.${testOrdersToday ? ` Test orders (no money): ${testOrdersToday}` : ""}`}
            href="/admin/payments#recent"
          />
          <MetricTile
            label="Revenue today"
            value={money(revenueToday)}
            hint={`Service fees from live payments. Government fees collected: ${money(govToday)}`}
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

type AttentionTone = "danger" | "highlight" | "neutral";

const attentionIcon: Record<AttentionTone, string> = {
  danger: "bg-danger-soft text-danger",
  highlight: "bg-highlight-soft text-highlight-fg",
  neutral: "bg-surface-2 text-muted",
};

/** One status line: a dot (on or needs attention), the value, and an optional plain reason. */
function StatusValue({ good, text, note }: { good: boolean; text: string; note?: string | null }) {
  return (
    <span className="grid gap-0.5">
      <span className="flex items-center gap-2 font-medium">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", good ? "bg-accent" : "bg-highlight-strong")} />
        {text}
      </span>
      {note ? <span className="text-xs text-muted">{note}</span> : null}
    </span>
  );
}

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
