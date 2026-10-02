import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { firstParam, formatDate, formatDateTime, humanize, money, opsToday } from "@/components/admin/format";
import { ConsoleHeader, Panel, Stat, StatStrip } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/surface";
import { COHORT_STATES, cohortFor, EXPORT_SOURCES } from "@/lib/acquisition/state-cohort";
import { requireStaff } from "@/lib/auth/session";
import { getJurisdiction } from "@/lib/compliance/registry";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { importStateExportAction } from "../actions";

export const metadata: Metadata = { title: "Deadline cohorts" };
export const dynamic = "force-dynamic";

/**
 * Businesses in Washington, Nevada and Utah whose filing is due in a given month, from an
 * official export an operator uploaded. Read-only research: nothing here contacts anyone.
 * A late charge is shown as triggered only when the state's own dated record (or a
 * verified date-based rule) says so.
 */
export default async function OctoberCohortPage(props: PageProps<"/admin/acquisition/october">) {
  await requireStaff();
  const sp = await props.searchParams;
  const state = (COHORT_STATES as readonly string[]).includes(firstParam(sp.state).toUpperCase()) ? firstParam(sp.state).toUpperCase() : "WA";
  const month = /^\d{4}-\d{2}$/.test(firstParam(sp.month)) ? firstParam(sp.month) : "2026-10";
  const meta = EXPORT_SOURCES[state];
  const stateName = getJurisdiction(state)?.name ?? state;
  const { entries, loaded } = await cohortFor(state, month);
  const supported = entries.filter((e) => e.supported);
  const triggered = entries.filter((e) => e.lateTriggered === "yes").length;

  return (
    <div className="grid gap-6">
      <ConsoleHeader
        eyebrow={<Link href="/admin/acquisition">Acquisition</Link>}
        title="Deadline cohorts"
        description="Businesses whose annual filing is due in a month, from official state exports. Research only: no outreach is sent from here."
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {COHORT_STATES.map((s) => (
          <Link
            key={s}
            href={`/admin/acquisition/october?state=${s}&month=${month}`}
            aria-current={s === state ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1", s === state ? "border-fg bg-fg text-bg" : "border-border text-muted hover:text-fg")}
          >
            {getJurisdiction(s)?.name ?? s}
          </Link>
        ))}
        <form className="ml-2 flex items-center gap-2" method="get">
          <input type="hidden" name="state" value={state} />
          <label className="text-muted" htmlFor="month">
            Due in
          </label>
          <input id="month" name="month" type="month" defaultValue={month} className="h-9 rounded-[var(--radius-control)] border border-border bg-surface px-2" />
          <button className="h-9 rounded-full border border-border px-3" type="submit">
            Show
          </button>
        </form>
      </div>

      <Panel title={meta.label} description={meta.howTo}>
        {meta.available ? (
          <ActionForm action={importStateExportAction} submitLabel="Import export" variant="primary" pendingLabel="Importing...">
            <input type="hidden" name="state" value={state} />
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <label className="grid gap-1 text-xs text-muted">
                CSV file from {stateName}&apos;s official search
                <input name="file" type="file" accept=".csv,text/csv" required className="text-sm text-fg" />
              </label>
              <label className="grid gap-1 text-xs text-muted">
                Downloaded on
                <input name="exportedOn" type="date" defaultValue={opsToday()} required className="h-9 rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm text-fg" />
              </label>
            </div>
            <p className="text-xs text-subtle">
              Statuses are treated as current for 14 days from the download date. Open the official search:{" "}
              <a className="underline" href={meta.searchUrl} target="_blank" rel="noopener noreferrer">
                {meta.searchUrl}
              </a>
            </p>
          </ActionForm>
        ) : (
          <Notice tone="info" title="No official data loaded">
            Filewell doesn&apos;t automate this state&apos;s bot-protected search and doesn&apos;t buy data without owner approval.
          </Notice>
        )}
      </Panel>

      <StatStrip cols={4}>
        <Stat label={`${stateName} records loaded`} value={loaded} />
        <Stat label={`Due in ${month}`} value={entries.length} />
        <Stat label="Entity types Filewell covers" value={supported.length} />
        <Stat label="State late charge triggered" value={triggered} hint="From the state's own dated record" />
      </StatStrip>

      <Panel title={`${stateName}: due in ${month}`} bodyClassName="p-0">
        <TableScroll variant="inset">
          <Table>
            <THead>
              <tr>
                <TH>Entity</TH>
                <TH>Type</TH>
                <TH>Due</TH>
                <TH className="text-right">Days</TH>
                <TH className="text-right">State fee</TH>
                <TH>Possible late charge</TH>
                <TH>Triggered?</TH>
                <TH>State status (checked)</TH>
                <TH>Source</TH>
              </tr>
            </THead>
            <tbody>
              {entries.length === 0 ? (
                <TR>
                  <TD colSpan={9} className="text-muted">
                    {meta.available ? "No records due in this month yet. Import an export above." : "No data for this state."}
                  </TD>
                </TR>
              ) : (
                entries.slice(0, 500).map((e) => {
                  const base = e.fees?.due.filter((l) => l.kind === "government_fee").reduce((n, l) => n + l.cents, 0) ?? null;
                  const lateLines = [...(e.fees?.due.filter((l) => l.kind === "government_late_fee") ?? []), ...(e.fees?.possible ?? []), ...(e.fees?.avoidable.map((a) => a.line) ?? [])];
                  return (
                    <TR key={e.id}>
                      <TD className="font-medium text-fg">
                        {e.name}
                        <span className="block text-xs text-muted">#{e.entityNumber}</span>
                      </TD>
                      <TD>
                        {e.entityType ? `${e.isForeign ? "Foreign " : ""}${ENTITY_TYPE_LABELS[e.entityType]}` : <span className="text-muted">{e.typeRaw ?? "Unknown"} (not covered)</span>}
                      </TD>
                      <TD>{formatDate(e.dueDate)}</TD>
                      <TD className="tnum text-right">{e.daysRemaining}</TD>
                      <TD className="tnum text-right">{base !== null ? money(base) : "-"}</TD>
                      <TD>{lateLines.length ? lateLines.map((l) => `${money(l.cents)} ${l.label.toLowerCase()}`).join(", ") : "-"}</TD>
                      <TD>{e.lateTriggered === "yes" ? "Yes" : e.lateTriggered === "no" ? "No" : "Not confirmed"}</TD>
                      <TD>
                        {e.status ? humanize(e.status) : "-"}
                        <span className={cn("block text-xs", e.statusFresh ? "text-muted" : "text-warning")}>
                          {e.statusCheckedAt ? `${formatDateTime(e.statusCheckedAt)}${e.statusFresh ? "" : " (stale)"}` : ""}
                        </span>
                      </TD>
                      <TD className="text-xs text-muted">{e.source}</TD>
                    </TR>
                  );
                })
              )}
            </tbody>
          </Table>
        </TableScroll>
        {entries.length > 500 ? <p className="px-5 py-3 text-sm text-muted">Showing the first 500 of {entries.length}.</p> : null}
      </Panel>
    </div>
  );
}
