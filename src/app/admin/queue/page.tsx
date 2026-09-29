import type { Metadata } from "next";
import Link from "next/link";
import { AdminStatusBadge, DeadlineText, PaymentLine, TestOrderBadge, UrgencyBadge } from "@/components/admin/badges";
import { firstParam, isUuid, money, opsToday } from "@/components/admin/format";
import { ConsoleHeader, Pagination, tableLink } from "@/components/admin/layout-bits";
import { PAYMENT_FILTERS, QueueFilters, type QueueFilterValues } from "@/components/admin/queue-filters";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { isUrgency, urgencyDateRange } from "@/components/admin/urgency";
import { Notice } from "@/components/ui/surface";
import { requireStaff } from "@/lib/auth/session";
import { FILING_TYPES, listJurisdictions } from "@/lib/compliance/registry";
import { isISODate } from "@/lib/domain/dates";
import { ACTIVE_OPERATIONS_STATUSES, isFilingStatus, OPERATOR_NEXT_ACTION, type FilingStatus } from "@/lib/domain/filing-status";
import { createClient } from "@/lib/supabase/server";
import { one, profilesByIds, staffDirectory, staffLabel } from "../_lib/data";

export const metadata: Metadata = { title: "Queue" };

const PAGE_SIZE = 50;

interface QueueRow {
  id: string;
  state_code: string;
  filing_type_code: string;
  period_year: number;
  due_date: string;
  status: string;
  assigned_to: string | null;
  user_id: string;
  order_id: string | null;
  filing_name: string | null;
  businesses: { legal_name: string } | { legal_name: string }[] | null;
  orders:
    | { status: string; total_cents: number; government_fee_cents: number; service_fee_cents: number; payment_mode: string }
    | { status: string; total_cents: number; government_fee_cents: number; service_fee_cents: number; payment_mode: string }[]
    | null;
}

function parseFilters(sp: Record<string, string | string[] | undefined>, staffIds: Set<string>): QueueFilterValues {
  const state = firstParam(sp.state).toUpperCase();
  const type = firstParam(sp.type);
  const dueFrom = firstParam(sp.due_from);
  const dueTo = firstParam(sp.due_to);
  const status = firstParam(sp.status);
  const payment = firstParam(sp.payment);
  const urgency = firstParam(sp.urgency);
  const assigned = firstParam(sp.assigned);
  const statusValid =
    status === "" || status === "all" || status.split(",").every((s) => isFilingStatus(s));
  return {
    state: /^[A-Z]{2}$/.test(state) ? state : "",
    type: FILING_TYPES.some((t) => t.code === type) ? type : "",
    due_from: isISODate(dueFrom) ? dueFrom : "",
    due_to: isISODate(dueTo) ? dueTo : "",
    status: statusValid ? status : "",
    payment: PAYMENT_FILTERS.some((p) => p.value === payment) ? payment : "",
    urgency: isUrgency(urgency) ? urgency : "",
    assigned: assigned === "me" || assigned === "unassigned" || (isUuid(assigned) && staffIds.has(assigned)) ? assigned : "",
  };
}

export default async function QueuePage(props: PageProps<"/admin/queue">) {
  const staff = await requireStaff();
  const sp = await props.searchParams;
  const directory = await staffDirectory();
  const filters = parseFilters(sp, new Set(directory.keys()));
  const page = Math.min(10_000, Math.max(1, Number.parseInt(firstParam(sp.page), 10) || 1));
  const today = opsToday();

  const statuses: FilingStatus[] | null =
    filters.status === "all"
      ? null
      : filters.status === ""
        ? [...ACTIVE_OPERATIONS_STATUSES]
        : (filters.status.split(",").filter(isFilingStatus) as FilingStatus[]);

  const byOrderStatus = filters.payment !== "" && filters.payment !== "none";
  const select =
    "id, state_code, filing_type_code, period_year, due_date, status, assigned_to, user_id, order_id, filing_name:rule_snapshot->>filing_name, businesses(legal_name), " +
    `${byOrderStatus ? "orders!inner" : "orders"}(status, total_cents, government_fee_cents, service_fee_cents, payment_mode)`;

  const db = await createClient();
  let query = db.from("filings").select(select, { count: "exact" });
  if (statuses) query = query.in("status", statuses);
  if (filters.state) query = query.eq("state_code", filters.state);
  if (filters.type) query = query.eq("filing_type_code", filters.type);
  if (filters.due_from) query = query.gte("due_date", filters.due_from);
  if (filters.due_to) query = query.lte("due_date", filters.due_to);
  if (filters.urgency && isUrgency(filters.urgency)) {
    const range = urgencyDateRange(filters.urgency, today);
    if (range.gte) query = query.gte("due_date", range.gte);
    if (range.lte) query = query.lte("due_date", range.lte);
  }
  if (byOrderStatus) query = query.eq("orders.status", filters.payment);
  if (filters.payment === "none") query = query.is("order_id", null);
  if (filters.assigned === "me") query = query.eq("assigned_to", staff.id);
  else if (filters.assigned === "unassigned") query = query.is("assigned_to", null);
  else if (filters.assigned) query = query.eq("assigned_to", filters.assigned);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const rows = (data ?? []) as unknown as QueueRow[];
  const total = count ?? 0;
  const customers = await profilesByIds(rows.map((r) => r.user_id));
  const states = listJurisdictions().map((j) => ({ code: j.code, name: j.name }));
  const stateNames = new Map(states.map((s) => [s.code, s.name]));
  const staffOptions = [...directory.values()]
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, label: staffLabel(s) }));
  const params: Record<string, string | undefined> = { ...filters };

  return (
    <div className="grid grid-cols-1 gap-5">
      <ConsoleHeader
        title="Queue"
        description="Every filing in our hands, soonest deadline first. Open a row to act on it."
      />
      <QueueFilters
        values={filters}
        states={states}
        filingTypes={FILING_TYPES.map((t) => ({ code: t.code, name: t.name }))}
        staff={staffOptions}
      />

      {error ? (
        <Notice tone="danger" role="alert" title="The queue could not be loaded">
          {error.message}
        </Notice>
      ) : null}

      <div className="grid gap-3">
        <p className="tnum text-sm font-medium text-muted" aria-live="polite">
          {total} {total === 1 ? "filing matches" : "filings match"}
        </p>

        <TableScroll>
          <Table className="min-w-[62rem]">
            <THead>
              <tr>
                <TH className="sticky left-0 z-[1] bg-bg shadow-[1px_0_0_var(--border)]">Business</TH>
                <TH>Filing</TH>
                <TH>Deadline</TH>
                <TH>Urgency</TH>
                <TH>Status</TH>
                <TH>Required action</TH>
                <TH className="text-right">Amount paid</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => {
                const business = one(r.businesses);
                const order = one(r.orders);
                const assignee = r.assigned_to ? directory.get(r.assigned_to) : null;
                const paid = order && ["paid", "partially_refunded", "refunded"].includes(order.status);
                const customerEmail = customers.get(r.user_id)?.email;
                const nextAction = isFilingStatus(r.status) ? OPERATOR_NEXT_ACTION[r.status] : "";
                return (
                  <TR key={r.id} className="group">
                    <TD className="sticky left-0 z-[1] bg-surface shadow-[1px_0_0_var(--border)] transition-colors group-hover:bg-bg">
                      <span className="grid w-52 gap-0.5 xl:w-56">
                        <Link href={`/admin/filings/${r.id}`} className={`${tableLink} truncate`} title={business?.legal_name ?? undefined}>
                          {business?.legal_name ?? "Unknown business"}
                        </Link>
                        <span className="truncate text-xs text-muted" title={customerEmail}>
                          {customerEmail ?? "Unknown customer"}
                        </span>
                      </span>
                    </TD>
                    <TD>
                      <span className="grid gap-0.5 leading-tight">
                        <span className="whitespace-nowrap">
                          {r.filing_name ?? "Annual Report"} <span className="tnum text-muted">{r.period_year}</span>
                        </span>
                        <span className="text-xs text-muted" title={stateNames.get(r.state_code)}>
                          {stateNames.get(r.state_code) ?? r.state_code}
                        </span>
                      </span>
                    </TD>
                    <TD>
                      <DeadlineText dueDate={r.due_date} today={today} status={r.status} />
                    </TD>
                    <TD>
                      <UrgencyBadge dueDate={r.due_date} today={today} status={r.status} />
                    </TD>
                    <TD>
                      <span className="grid justify-items-start gap-1">
                        <AdminStatusBadge status={r.status} />
                        <PaymentLine status={order?.status} />
                        {paid ? <TestOrderBadge mode={order.payment_mode} /> : null}
                      </span>
                    </TD>
                    <TD>
                      <span className="grid gap-0.5 leading-tight">
                        <span className={nextAction === "No action" ? "whitespace-nowrap text-muted" : "whitespace-nowrap font-semibold"}>{nextAction}</span>
                        <span className="whitespace-nowrap text-xs text-muted">{assignee ? staffLabel(assignee) : "Unassigned"}</span>
                      </span>
                    </TD>
                    <TD className="text-right">
                      <span className="tnum grid gap-0.5 leading-tight">
                        <span className="whitespace-nowrap font-medium">{paid ? money(order.total_cents) : <span className="font-normal text-muted">None</span>}</span>
                        <span className="whitespace-nowrap text-xs text-muted">
                          {order ? (
                            <>
                              Gov {money(order.government_fee_cents)} · Service {money(order.service_fee_cents)}
                            </>
                          ) : (
                            "No order"
                          )}
                        </span>
                      </span>
                    </TD>
                  </TR>
                );
              })}
              {!rows.length && !error ? (
                <TR>
                  <TD colSpan={7} className="py-10 text-center text-muted">
                    Nothing matches these filters.
                  </TD>
                </TR>
              ) : null}
            </tbody>
          </Table>
        </TableScroll>
      </div>

      <Pagination basePath="/admin/queue" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
