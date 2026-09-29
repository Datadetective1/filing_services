import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, isoDaysAgo } from "@/components/admin/format";
import { ConsoleHeader, Panel, Stat, StatStrip } from "@/components/admin/layout-bits";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/surface";
import { FUNNEL_STEPS, type AnalyticsEvent } from "@/lib/analytics/events";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Funnel" };

const RANGES = [7, 30] as const;
const BATCH = 1000;
const MAX_ROWS = 50_000;

interface EventRow {
  event_name: AnalyticsEvent;
  user_id: string | null;
  anonymous_id: string | null;
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return "n/a";
  const value = (numerator / denominator) * 100;
  return `${value >= 10 || value === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
}

export default async function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  await requireStaff();
  const sp = await props.searchParams;
  const days = firstParam(sp.range) === "30" ? 30 : 7;
  const since = isoDaysAgo(days);
  const events: AnalyticsEvent[] = [...FUNNEL_STEPS.map((s) => s.event), "checkout_started", "payment_completed", "reminder_clicked"];

  const db = await createClient();
  const rows: EventRow[] = [];
  let truncated = false;
  let loadError: string | null = null;
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const { data, error } = await db
      .from("analytics_events")
      .select("event_name, user_id, anonymous_id")
      .in("event_name", [...new Set(events)])
      .gte("created_at", since)
      .order("id", { ascending: true })
      .range(offset, offset + BATCH - 1);
    if (error) {
      loadError = error.message;
      break;
    }
    const batch = (data ?? []) as EventRow[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
    if (offset + BATCH >= MAX_ROWS) truncated = true;
  }

  const actorsByEvent = new Map<AnalyticsEvent, Set<string>>();
  const eventCounts = new Map<AnalyticsEvent, number>();
  let unattributed = 0;
  for (const r of rows) {
    eventCounts.set(r.event_name, (eventCounts.get(r.event_name) ?? 0) + 1);
    const actor = r.user_id ? `u:${r.user_id}` : r.anonymous_id ? `a:${r.anonymous_id}` : null;
    if (!actor) {
      unattributed++;
      continue;
    }
    let set = actorsByEvent.get(r.event_name);
    if (!set) actorsByEvent.set(r.event_name, (set = new Set()));
    set.add(actor);
  }
  const actors = (e: AnalyticsEvent) => actorsByEvent.get(e)?.size ?? 0;

  const steps = FUNNEL_STEPS.map((s) => ({ ...s, count: actors(s.event) }));
  const max = Math.max(1, ...steps.map((s) => s.count));
  const first = steps[0]?.count ?? 0;
  const last = steps[steps.length - 1]?.count ?? 0;

  const started = actorsByEvent.get("checkout_started") ?? new Set<string>();
  const paid = actorsByEvent.get("payment_completed") ?? new Set<string>();
  const abandoned = [...started].filter((a) => !paid.has(a)).length;

  return (
    <div className="grid grid-cols-1 gap-6">
      <ConsoleHeader
        title="Funnel"
        description={`Conversion over the last ${days} days. Each step counts distinct visitors: by account when signed in, otherwise by an anonymous browser ID.`}
        actions={
          <nav aria-label="Date range" className="inline-flex rounded-full border border-border bg-surface p-1 shadow-[0_1px_2px_rgb(23_35_29/0.04)]">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={r === 7 ? "/admin/analytics" : `/admin/analytics?range=${r}`}
                aria-current={r === days ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors",
                  r === days ? "bg-ink text-ink-fg" : "text-muted hover:text-fg",
                )}
              >
                Last {r} days
              </Link>
            ))}
          </nav>
        }
      />

      {loadError ? (
        <Notice tone="danger" role="alert" title="Events could not be loaded">
          {loadError}
        </Notice>
      ) : null}
      {truncated ? (
        <Notice tone="warning" title="Partial data">
          Only the first {MAX_ROWS.toLocaleString("en-US")} events in this range were counted.
        </Notice>
      ) : null}

      <StatStrip cols={4}>
        <Stat label="Overall conversion" value={pct(last, first)} hint={`${FUNNEL_STEPS[0].label} to ${FUNNEL_STEPS[FUNNEL_STEPS.length - 1].label.toLowerCase()}`} />
        <Stat label="Abandoned checkouts" value={abandoned.toLocaleString("en-US")} hint={`${pct(abandoned, started.size)} of ${started.size} who started checkout`} />
        <Stat
          label="Reminder clicks"
          value={actors("reminder_clicked").toLocaleString("en-US")}
          hint={`${(eventCounts.get("reminder_clicked") ?? 0).toLocaleString("en-US")} clicks in total`}
        />
        <Stat label="Events counted" value={rows.length.toLocaleString("en-US")} hint={unattributed ? `${unattributed} without a visitor ID` : "All attributed"} />
      </StatStrip>

      <Panel title="Conversion funnel" description="Distinct visitors at each step. The percentage is the share kept from the step before." bodyClassName="p-0">
        <ol className="divide-y divide-border/70">
          {steps.map((s, i) => {
            const prev = i > 0 ? steps[i - 1].count : null;
            const width = (s.count / max) * 100;
            const kept = prev ? s.count / prev : null;
            return (
              <li key={s.event} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[15rem_minmax(0,1fr)_10rem] sm:items-center sm:gap-5">
                <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
                  <span className="tnum grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted">{i + 1}</span>
                  {s.label}
                </span>
                <span className="relative flex h-3 items-center rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-3 rounded-full bg-accent" style={{ width: `${Math.max(width, s.count ? 1 : 0)}%` }} />
                </span>
                <span className="tnum flex items-baseline justify-between gap-3 text-sm sm:justify-end">
                  <span className="font-display text-base font-semibold text-fg">{s.count.toLocaleString("en-US")}</span>
                  <span
                    className={cn("w-16 text-right", kept !== null && kept < 0.5 ? "font-semibold text-warning" : "text-muted")}
                    title={prev === null ? undefined : "Conversion from the previous step"}
                  >
                    {prev === null ? "" : pct(s.count, prev)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </Panel>

      <p className="max-w-[70ch] text-sm text-muted">
        A visitor who browses anonymously and then signs in can be counted once under each ID, so step-to-step rates are approximate. Analytics are
        first-party and store no IP addresses or user agents.
      </p>
    </div>
  );
}

