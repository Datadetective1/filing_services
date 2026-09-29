import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/admin/badges";
import { opsButton } from "@/components/admin/button-classes";
import { firstParam, formatDateTime } from "@/components/admin/format";
import { ConsoleHeader, Pagination, tableLink } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { Label, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { requireStaff } from "@/lib/auth/session";
import { getEmailReadiness } from "@/lib/email/provider";
import { DEFAULT_TEMPLATES } from "@/lib/email/templates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Emails" };

const PAGE_SIZE = 50;
const STATUSES = ["queued", "sent", "failed", "suppressed"] as const;

interface NotificationRow {
  id: string;
  created_at: string;
  template_key: string;
  to_address: string;
  subject: string;
  status: string;
  provider: string | null;
  error: string | null;
}

export default async function NotificationsPage(props: PageProps<"/admin/notifications">) {
  await requireStaff();
  const sp = await props.searchParams;
  const templateKeys = DEFAULT_TEMPLATES.map((t) => t.key);
  const status = (STATUSES as readonly string[]).includes(firstParam(sp.status)) ? firstParam(sp.status) : "";
  const template = templateKeys.includes(firstParam(sp.template)) ? firstParam(sp.template) : "";
  const page = Math.min(10_000, Math.max(1, Number.parseInt(firstParam(sp.page), 10) || 1));

  const db = await createClient();
  let query = db
    .from("notifications")
    .select("id, created_at, template_key, to_address, subject, status, provider, error", { count: "exact" });
  if (status) query = query.eq("status", status);
  if (template) query = query.eq("template_key", template);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as NotificationRow[];
  const delivery = getEmailReadiness();

  return (
    <div className="grid grid-cols-1 gap-5">
      <ConsoleHeader title="Emails" description="Every email the system has rendered, newest first." />
      {delivery.delivering ? (
        <Notice tone="info" title="Email is delivering through Resend">
          Emails are sent{delivery.from ? ` from ${delivery.from}` : ""}. Rows with provider &ldquo;outbox&rdquo; were recorded earlier and never sent. Failed rows
          were not delivered: contact those customers directly.
        </Notice>
      ) : (
        <Notice tone="warning" title={delivery.mode === "misconfigured" ? "Email is misconfigured: nothing is delivered" : "Email is in outbox mode: nothing is delivered"}>
          {delivery.reason ? `${delivery.reason}. ` : "Emails are recorded here but not delivered. "}Contact customers directly about anything important.
        </Notice>
      )}

      <form method="get" action="/admin/notifications" aria-label="Filter emails" className="flex flex-wrap items-end gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(23_35_29/0.04)] sm:p-5">
        <div className="grid min-w-44 flex-1 gap-1.5 sm:flex-none">
          <Label htmlFor="n-status" className="text-[13px] font-semibold text-muted">
            Status
          </Label>
          <Select id="n-status" name="status" defaultValue={status}>
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid min-w-56 flex-1 gap-1.5 sm:flex-none">
          <Label htmlFor="n-template" className="text-[13px] font-semibold text-muted">
            Template
          </Label>
          <Select id="n-template" name="template" defaultValue={template}>
            <option value="">Any</option>
            {templateKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
        <button type="submit" className={opsButton("primary")}>
          Filter
        </button>
        <Link href="/admin/notifications" className={opsButton("ghost")}>
          Reset
        </Link>
      </form>

      {error ? (
        <Notice tone="danger" role="alert" title="Emails could not be loaded">
          {error.message}
        </Notice>
      ) : null}

      <TableScroll>
        <Table className="min-w-[56rem]">
          <THead>
            <tr>
              <TH>Created</TH>
              <TH>Template</TH>
              <TH>To</TH>
              <TH>Subject</TH>
              <TH>Status</TH>
              <TH>Provider</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((n) => (
              <TR key={n.id}>
                <TD className="tnum whitespace-nowrap">{formatDateTime(n.created_at)}</TD>
                <TD className="font-mono text-xs">{n.template_key}</TD>
                <TD className="max-w-56 truncate text-muted">{n.to_address}</TD>
                <TD className="max-w-96">
                  <Link className={tableLink} href={`/admin/notifications/${n.id}`}>
                    {n.subject}
                  </Link>
                  {n.error ? <span className="block text-xs text-danger">{n.error}</span> : null}
                </TD>
                <TD>
                  <StatusPill status={n.status} />
                </TD>
                <TD className="text-muted">{n.provider ?? "None"}</TD>
              </TR>
            ))}
            {!rows.length ? (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-muted">
                  No emails match.
                </TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
      </TableScroll>

      <Pagination basePath="/admin/notifications" params={{ status, template }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </div>
  );
}
