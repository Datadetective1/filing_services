import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { StatusPill } from "@/components/admin/badges";
import { formatDate, formatDateTime, humanize, opsToday } from "@/components/admin/format";
import { ConsoleHeader, EmptyRow, Panel, ScrollArea, Stat, StatStrip } from "@/components/admin/layout-bits";
import { Table, TD, TH, THead, TR } from "@/components/admin/table";
import { cn } from "@/components/ui/cn";
import { Field, Input } from "@/components/ui/field";
import { requireStaff } from "@/lib/auth/session";
import { addDays } from "@/lib/domain/dates";
import { createClient } from "@/lib/supabase/server";
import { one } from "../_lib/data";
import { runReminderCycleAction, updateScheduleAction } from "./actions";

export const metadata: Metadata = { title: "Reminders" };

const STATUSES = ["scheduled", "sent", "skipped", "cancelled", "failed"] as const;

interface ReminderRow {
  id: string;
  due_date: string;
  offset_days: number;
  scheduled_for: string;
  status: string;
  skip_reason: string | null;
  processed_at: string | null;
  businesses: { legal_name: string } | { legal_name: string }[] | null;
}

interface ScheduleRow {
  id: string;
  name: string;
  offsets_days: number[];
  filing_type_code: string | null;
  state_code: string | null;
  active: boolean;
  updated_at: string;
}

function offsetLabel(days: number): string {
  if (days === 0) return "On the due date";
  const n = Math.abs(days);
  return `${n} ${n === 1 ? "day" : "days"} ${days < 0 ? "before" : "after"}`;
}

export default async function RemindersPage() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "admin";
  const db = await createClient();
  const today = opsToday();
  const cols = "id, due_date, offset_days, scheduled_for, status, skip_reason, processed_at, businesses(legal_name)";

  const [counts, upcomingRes, recentRes, schedulesRes] = await Promise.all([
    Promise.all(STATUSES.map((s) => db.from("reminders").select("id", { count: "exact", head: true }).eq("status", s))),
    db
      .from("reminders")
      .select(cols)
      .eq("status", "scheduled")
      .gte("scheduled_for", today)
      .lte("scheduled_for", addDays(today, 14))
      .order("scheduled_for", { ascending: true })
      .limit(200),
    db
      .from("reminders")
      .select(cols)
      .in("status", ["sent", "skipped", "cancelled", "failed"])
      .not("processed_at", "is", null)
      .order("processed_at", { ascending: false })
      .limit(50),
    db.from("reminder_schedules").select("id, name, offsets_days, filing_type_code, state_code, active, updated_at").order("name"),
  ]);

  const upcoming = (upcomingRes.data ?? []) as ReminderRow[];
  const recent = (recentRes.data ?? []) as ReminderRow[];
  const schedules = (schedulesRes.data ?? []) as ScheduleRow[];

  return (
    <div className="grid grid-cols-1 gap-6">
      <ConsoleHeader
        title="Reminders"
        description="Deadline reminder emails. A daily job plans and sends them, and each one is re-checked on the day it goes out."
      />

      <StatStrip cols={5}>
        {STATUSES.map((s, i) => (
          <Stat
            key={s}
            label={humanize(s)}
            value={counts[i].count ?? 0}
            tone={s === "failed" && (counts[i].count ?? 0) > 0 ? "danger" : "neutral"}
            className={i === STATUSES.length - 1 ? "max-md:col-span-2" : undefined}
          />
        ))}
      </StatStrip>

      {isAdmin ? (
        <section
          aria-labelledby="run-cycle-title"
          className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface px-5 py-5 shadow-[0_1px_2px_rgb(23_35_29/0.04)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8"
        >
          <div className="grid gap-1">
            <h2 id="run-cycle-title" className="text-[17px] font-semibold leading-snug text-fg">
              Run the reminder cycle now
            </h2>
            <p className="max-w-[70ch] text-sm text-muted">
              Runs the same job as the daily schedule. Emails already sent are never sent twice. The run is recorded in the audit log.
            </p>
          </div>
          <ActionForm action={runReminderCycleAction} submitLabel="Run reminder cycle now" pendingLabel="Running..." variant="primary" resetOnSuccess={false} />
        </section>
      ) : null}

      <Panel id="upcoming" title="Scheduled in the next 14 days" bodyClassName="p-0">
        {upcoming.length ? (
          <ScrollArea>
            <Table className="min-w-[40rem]">
              <THead>
                <tr>
                  <TH>Sends on</TH>
                  <TH>Business</TH>
                  <TH>Timing</TH>
                  <TH>Due date</TH>
                </tr>
              </THead>
              <tbody>
                {upcoming.map((r) => (
                  <TR key={r.id}>
                    <TD className="tnum whitespace-nowrap">{formatDate(r.scheduled_for)}</TD>
                    <TD className="font-medium">{one(r.businesses)?.legal_name ?? "Unknown business"}</TD>
                    <TD className="whitespace-nowrap text-muted">{offsetLabel(r.offset_days)}</TD>
                    <TD className="tnum whitespace-nowrap">{formatDate(r.due_date)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="px-5 py-4">
            <EmptyRow>No reminders scheduled in the next 14 days.</EmptyRow>
          </div>
        )}
      </Panel>

      <Panel id="recent" title="Recently processed" description="The latest 50 reminders that were sent, skipped, cancelled or failed." bodyClassName="p-0">
        {recent.length ? (
          <ScrollArea>
            <Table className="min-w-[48rem]">
              <THead>
                <tr>
                  <TH>Processed</TH>
                  <TH>Business</TH>
                  <TH>Status</TH>
                  <TH>Reason</TH>
                  <TH>Timing</TH>
                  <TH>Due date</TH>
                </tr>
              </THead>
              <tbody>
                {recent.map((r) => (
                  <TR key={r.id}>
                    <TD className="tnum whitespace-nowrap">{formatDateTime(r.processed_at)}</TD>
                    <TD className="font-medium">{one(r.businesses)?.legal_name ?? "Unknown business"}</TD>
                    <TD>
                      <StatusPill status={r.status} />
                    </TD>
                    <TD className="text-muted">{r.skip_reason ? humanize(r.skip_reason) : ""}</TD>
                    <TD className="whitespace-nowrap text-muted">{offsetLabel(r.offset_days)}</TD>
                    <TD className="tnum whitespace-nowrap">{formatDate(r.due_date)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="px-5 py-4">
            <EmptyRow>Nothing processed yet.</EmptyRow>
          </div>
        )}
      </Panel>

      <Panel
        id="schedules"
        title="Reminder schedule"
        description="Offsets are days relative to the due date: negative is before, positive is after. Changes apply the next time reminders are planned. Reminders already scheduled keep their dates."
      >
        {schedules.length ? (
          <ul className="grid divide-y divide-border/70">
            {schedules.map((s) => (
              <li key={s.id} className="grid gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-fg">
                    {s.name} {s.active ? null : <span className="text-sm font-normal text-muted">(inactive)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    Applies to {s.state_code ?? "all states"}, {s.filing_type_code ? humanize(s.filing_type_code).toLowerCase() : "all filing types"}. Updated{" "}
                    {formatDateTime(s.updated_at)}
                  </p>
                </div>
                <OffsetTrack offsets={s.offsets_days} />
                {isAdmin ? (
                  <ActionForm action={updateScheduleAction} submitLabel="Save offsets" pendingLabel="Saving..." resetOnSuccess={false} className="max-w-xl">
                    <input type="hidden" name="scheduleId" value={s.id} />
                    <Field
                      label="Offsets (days)"
                      htmlFor={`offsets-${s.id}`}
                      hint="Comma-separated whole numbers between -365 and 365, for example -90, -30, -7, 0, 7."
                    >
                      <Input id={`offsets-${s.id}`} name="offsets" defaultValue={s.offsets_days.join(", ")} className="tnum" autoComplete="off" required />
                    </Field>
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyRow>No reminder schedule is configured. The built-in default offsets are used.</EmptyRow>
        )}
      </Panel>
    </div>
  );
}

/** The schedule's offsets as stops along the due date: before, on the day, after. */
function OffsetTrack({ offsets }: { offsets: number[] }) {
  const stops = [...offsets].sort((a, b) => a - b);
  return (
    <ul className="flex flex-wrap gap-x-1.5 gap-y-3" aria-label="Offsets">
      {stops.map((o) => (
        <li key={o} className="grid justify-items-center gap-1" title={offsetLabel(o)}>
          <span
            className={cn(
              "tnum inline-flex h-7 min-w-11 items-center justify-center rounded-full border px-2.5 text-xs font-semibold",
              o === 0
                ? "border-highlight-strong bg-highlight text-highlight-fg"
                : o < 0
                  ? "border-border-strong bg-surface text-fg"
                  : "border-border bg-surface-2 text-muted",
            )}
          >
            {o === 0 ? "Due" : o > 0 ? `+${o}` : o}
          </span>
          <span className="text-[11px] text-muted">{o === 0 ? "due date" : o < 0 ? "before" : "after"}</span>
        </li>
      ))}
    </ul>
  );
}
