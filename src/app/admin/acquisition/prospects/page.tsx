import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { firstParam, formatDate, humanize, opsToday } from "@/components/admin/format";
import { ConsoleHeader, Panel } from "@/components/admin/layout-bits";
import { Notice } from "@/components/ui/surface";
import { CHANNELS, DAILY_LIST_SIZE, listFounderProspects, PROSPECT_STATUSES, typesByNextDeadline } from "@/lib/acquisition/founder";
import { requireStaff } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/domain/dates";
import { ENTITY_TYPE_LABELS, type EntityType } from "@/lib/domain/types";
import { buildDailyListAction, updateProspectAction } from "../actions";

export const metadata: Metadata = { title: "Founder research list" };
export const dynamic = "force-dynamic";

const input = "h-9 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2.5 text-sm text-fg";

/**
 * A daily list of public-register businesses for Amary to research by hand. Nothing here
 * sends a message or looks anyone up automatically: the links open ordinary searches in a
 * new tab, and only what the operator types is saved.
 */
export default async function ProspectsPage(props: PageProps<"/admin/acquisition/prospects">) {
  await requireStaff();
  const sp = await props.searchParams;
  const today = opsToday();
  const date = firstParam(sp.date) || today;
  const rows = await listFounderProspects({ date: date === "all" ? undefined : date });
  const next = typesByNextDeadline(today)[0];

  return (
    <div className="grid gap-6">
      <ConsoleHeader
        eyebrow={<Link href="/admin/acquisition">Acquisition</Link>}
        title="Founder research list"
        description={`About ${DAILY_LIST_SIZE} Pennsylvania businesses a day from the public register, starting with the entity types whose filing period is closest${
          next ? ` (next: ${ENTITY_TYPE_LABELS[next.type]} and similar, due ${formatLongDate(next.dueDate)})` : ""
        }. Research each by hand and log what happened.`}
        actions={<ActionForm action={buildDailyListAction} submitLabel="Build today's list" variant="primary" pendingLabel="Choosing..." />}
      />

      <Notice tone="info" title="Ground rules">
        Use only public business channels (the business&apos;s own website, contact form, business phone, company page). Never
        say a report is unfiled, late or that the business is out of compliance: the register doesn&apos;t show that. Say it
        &ldquo;may be due&rdquo;, that Filewell is a private service, and that they can file directly with Pennsylvania for $7.
        No bulk or automated messages.
      </Notice>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="rounded-full border border-border px-3 py-1" href="/admin/acquisition/prospects">
          Today
        </Link>
        <Link className="rounded-full border border-border px-3 py-1" href="/admin/acquisition/prospects?date=all">
          All lists
        </Link>
        <span className="py-1 text-muted">{date === "all" ? "Showing the most recent 200" : `List for ${formatDate(date)}`}</span>
      </div>

      {rows.length === 0 ? (
        <Panel title="No businesses on this list yet">
          <p className="text-sm text-muted">
            Click &ldquo;Build today&apos;s list&rdquo;. If it can&apos;t find enough, import more register records from{" "}
            <Link className="underline" href="/admin/outreach">
              Outreach
            </Link>{" "}
            (import only; nothing is sent).
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {rows.map((p) => {
            const q = encodeURIComponent(`"${p.record.legalName}" ${p.record.county ?? ""} PA`);
            return (
              <Panel
                key={p.id}
                title={p.record.legalName}
                description={[
                  p.record.entityType ? ENTITY_TYPE_LABELS[p.record.entityType as EntityType] : null,
                  `Entity #${p.record.entityNumber}`,
                  p.record.formationDate ? `Formed ${formatDate(p.record.formationDate)}` : null,
                  p.record.county ? `${p.record.county} County` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                actions={<span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">{humanize(p.status)}</span>}
              >
                <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
                  <div className="grid content-start gap-2 text-sm">
                    <p className="text-muted">Registered office on record: {p.record.address || "not listed"}</p>
                    <p className="flex flex-wrap gap-x-3 gap-y-1">
                      <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/search?q=${q}`}>
                        Web search
                      </a>
                      <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://www.bing.com/search?q=${q}`}>
                        Bing
                      </a>
                      <a
                        className="underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(p.record.legalName)}`}
                      >
                        LinkedIn companies
                      </a>
                      {p.record.sourceUrl ? (
                        <a className="underline" target="_blank" rel="noopener noreferrer" href={p.record.sourceUrl}>
                          Register record
                        </a>
                      ) : null}
                    </p>
                    <p className="text-xs text-subtle">On the list since {formatDate(p.listDate)}.</p>
                  </div>

                  <ActionForm action={updateProspectAction} submitLabel="Save" resetOnSuccess={false}>
                    <input type="hidden" name="id" value={p.id} />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="grid gap-1 text-xs text-muted">
                        Status
                        <select name="status" defaultValue={p.status} className={input}>
                          {PROSPECT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {humanize(s)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        Public website
                        <input name="websiteUrl" type="url" defaultValue={p.websiteUrl ?? ""} placeholder="https://" className={input} />
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        Public contact page
                        <input name="contactPageUrl" type="url" defaultValue={p.contactPageUrl ?? ""} placeholder="https://" className={input} />
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        Public business phone
                        <input name="businessPhone" defaultValue={p.businessPhone ?? ""} className={input} />
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        LinkedIn / company profile
                        <input name="linkedinUrl" type="url" defaultValue={p.linkedinUrl ?? ""} placeholder="https://" className={input} />
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        Contacted on
                        <input name="contactedOn" type="date" defaultValue={p.contactedOn ?? ""} className={input} />
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        Channel
                        <select name="channel" defaultValue={p.channel ?? ""} className={input}>
                          <option value="">Not contacted</option>
                          {CHANNELS.map((c) => (
                            <option key={c} value={c}>
                              {humanize(c)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        Interested?
                        <select name="interested" defaultValue={p.interested === null ? "" : p.interested ? "yes" : "no"} className={input}>
                          <option value="">Unknown</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-muted sm:col-span-2">
                        Response
                        <input name="response" defaultValue={p.response ?? ""} className={input} />
                      </label>
                      <label className="grid gap-1 text-xs text-muted sm:col-span-2">
                        Notes
                        <input name="notes" defaultValue={p.notes ?? ""} className={input} />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-fg">
                        <input type="checkbox" name="converted" defaultChecked={p.converted} /> Became a customer
                      </label>
                    </div>
                  </ActionForm>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
