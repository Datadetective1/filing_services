import type { Metadata } from "next";
import Link from "next/link";
import { opsButton } from "@/components/admin/button-classes";
import { firstParam, formatDateTime, humanize, isUuid, shortId } from "@/components/admin/format";
import { ConsoleHeader, JsonDetails, Pagination, tableLink } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { Input, Label, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { profilesByIds, staffDirectory, staffLabel } from "../_lib/data";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 100;
const ACTOR_TYPES = ["customer", "staff", "system", "webhook"] as const;

interface AuditRow {
  id: number;
  actor_user_id: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  filing_id: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  created_at: string;
}

/** Escape LIKE wildcards so the operator's text matches literally. */
function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireStaff();
  const sp = await props.searchParams;
  const actionRaw = firstParam(sp.action).trim().slice(0, 100);
  const action = /^[A-Za-z0-9._:-]*$/.test(actionRaw) ? actionRaw : "";
  const entityRaw = firstParam(sp.entity).trim().slice(0, 60);
  const entity = /^[a-z_]*$/.test(entityRaw) ? entityRaw : "";
  const filing = isUuid(firstParam(sp.filing)) ? firstParam(sp.filing) : "";
  const actor = (ACTOR_TYPES as readonly string[]).includes(firstParam(sp.actor)) ? firstParam(sp.actor) : "";
  const page = Math.min(10_000, Math.max(1, Number.parseInt(firstParam(sp.page), 10) || 1));

  const db = await createClient();
  let query = db
    .from("audit_logs")
    .select("id, actor_user_id, actor_type, action, entity_type, entity_id, filing_id, before, after, metadata, created_at", { count: "exact" });
  if (action) query = query.ilike("action", `%${likeEscape(action)}%`);
  if (entity) query = query.eq("entity_type", entity);
  if (filing) query = query.eq("filing_id", filing);
  if (actor) query = query.eq("actor_type", actor);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as AuditRow[];

  const [people, staff] = await Promise.all([profilesByIds(rows.map((r) => r.actor_user_id)), staffDirectory()]);
  const actorName = (r: AuditRow) => {
    if (!r.actor_user_id) return humanize(r.actor_type);
    const s = staff.get(r.actor_user_id);
    if (s) return staffLabel(s);
    return people.get(r.actor_user_id)?.email ?? `${humanize(r.actor_type)} ${shortId(r.actor_user_id)}`;
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <ConsoleHeader title="Audit log" description="Append-only record of every important action, newest first." />

      <form method="get" action="/admin/audit" aria-label="Filter the audit log" className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(23_35_29/0.04)] sm:p-5">
        <div className="grid grid-cols-1 gap-x-3 gap-y-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="a-action" className="text-[13px] font-semibold text-muted">
              Action contains
            </Label>
            <Input id="a-action" name="action" defaultValue={action} placeholder="filing.status_changed" autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="a-entity" className="text-[13px] font-semibold text-muted">
              Entity type
            </Label>
            <Input id="a-entity" name="entity" defaultValue={entity} placeholder="filing" autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="a-filing" className="text-[13px] font-semibold text-muted">
              Filing ID
            </Label>
            <Input id="a-filing" name="filing" defaultValue={filing} className="font-mono text-sm" autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="a-actor" className="text-[13px] font-semibold text-muted">
              Actor type
            </Label>
            <Select id="a-actor" name="actor" defaultValue={actor}>
              <option value="">Any</option>
              {ACTOR_TYPES.map((a) => (
                <option key={a} value={a}>
                  {humanize(a)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
          <button type="submit" className={opsButton("primary")}>
            Filter
          </button>
          <Link href="/admin/audit" className={opsButton("ghost")}>
            Reset
          </Link>
        </div>
      </form>

      {error ? (
        <Notice tone="danger" role="alert" title="The audit log could not be loaded">
          {error.message}
        </Notice>
      ) : null}

      <TableScroll>
        <Table className="min-w-[60rem]">
          <THead>
            <tr>
              <TH>When</TH>
              <TH>Action</TH>
              <TH>Actor</TH>
              <TH>Entity</TH>
              <TH>Filing</TH>
              <TH>Details</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD valign="top" className="tnum whitespace-nowrap">{formatDateTime(r.created_at)}</TD>
                <TD valign="top" className="font-mono text-xs">{r.action}</TD>
                <TD valign="top" className="whitespace-nowrap">
                  {actorName(r)}
                  <span className="block text-xs text-muted">{humanize(r.actor_type)}</span>
                </TD>
                <TD valign="top">
                  {r.entity_type}
                  {r.entity_id ? (
                    <span className="block font-mono text-xs text-muted" title={r.entity_id}>
                      {r.entity_id.length > 12 ? shortId(r.entity_id) : r.entity_id}
                    </span>
                  ) : null}
                </TD>
                <TD valign="top">
                  {r.filing_id ? (
                    <Link className={`${tableLink} font-mono text-xs`} href={`/admin/filings/${r.filing_id}`}>
                      {shortId(r.filing_id)}
                    </Link>
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </TD>
                <TD valign="top">
                  <div className="flex flex-wrap items-start gap-x-4">
                    <JsonDetails label="Before" value={r.before} />
                    <JsonDetails label="After" value={r.after} />
                    <JsonDetails label="Metadata" value={r.metadata} />
                  </div>
                </TD>
              </TR>
            ))}
            {!rows.length ? (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-muted">
                  No audit entries match.
                </TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
      </TableScroll>

      <Pagination basePath="/admin/audit" params={{ action, entity, filing, actor }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </div>
  );
}
