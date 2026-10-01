import type { Metadata } from "next";
import Link from "next/link";
import { firstParam, humanize, isoDaysAgo, money } from "@/components/admin/format";
import { ConsoleHeader, KeyValues, Panel, Stat, StatStrip } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { cn } from "@/components/ui/cn";
import { isIndexable, site } from "@/config/site";
import { acquisitionSummary } from "@/lib/acquisition/dashboard";
import { founderActivity } from "@/lib/acquisition/founder";
import { listPartners } from "@/lib/acquisition/partners";
import { requireStaff } from "@/lib/auth/session";
import { getEmailReadiness } from "@/lib/email/provider";

export const metadata: Metadata = { title: "Acquisition" };
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: 3650 },
] as const;

function pct(n: number, d: number): string {
  if (!d) return "n/a";
  const v = (n / d) * 100;
  return `${v >= 10 || v === 0 ? v.toFixed(0) : v.toFixed(1)}%`;
}

const SOURCE_LABEL: Record<string, string> = {
  accountant_referral: "Accountant referral",
  manual_outreach: "Manual outreach",
  future_postcard: "Postcard",
  unknown: "Unknown (before tracking)",
};

/**
 * Organic acquisition dashboard: visits through paid customers, by source. Aggregates
 * only; no personal data is shown.
 */
export default async function AcquisitionPage(props: PageProps<"/admin/acquisition">) {
  await requireStaff();
  const sp = await props.searchParams;
  const range = RANGES.find((r) => r.key === firstParam(sp.range)) ?? RANGES[1];
  const model = firstParam(sp.model) === "first" ? "ft_source" : "lt_source";
  const since = isoDaysAgo(range.days);
  const [summary, activity, partners] = await Promise.all([acquisitionSummary(since, model), founderActivity(isoDaysAgo(7)), listPartners()]);
  const step = (key: string) => summary.steps.find((s) => s.key === key)?.total ?? 0;
  const visits = step("visits");
  const contribution = summary.paid.serviceRevenueCents - summary.paid.stripeFeeCents;
  const email = getEmailReadiness();
  const referred = partners.reduce((n, p) => n + p.referredCustomers, 0);

  const href = (o: { range?: string; model?: string }) =>
    `/admin/acquisition?range=${o.range ?? range.key}&model=${o.model ?? (model === "ft_source" ? "first" : "last")}`;

  return (
    <div className="grid gap-6">
      <ConsoleHeader
        title="Organic acquisition"
        description="Where visitors come from and how far they get. $0 paid media: no ads, no purchased lists, no cold email, postcards off."
        actions={
          <>
            <Link className="text-sm font-medium text-fg underline underline-offset-4" href="/admin/acquisition/prospects">
              Founder research list
            </Link>
            <Link className="text-sm font-medium text-fg underline underline-offset-4" href="/admin/acquisition/partners">
              Referral partners
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={href({ range: r.key })}
            aria-current={r.key === range.key ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1", r.key === range.key ? "border-fg bg-fg text-bg" : "border-border text-muted hover:text-fg")}
          >
            {r.label}
          </Link>
        ))}
        <span className="mx-2 text-subtle">|</span>
        {(["last", "first"] as const).map((m) => (
          <Link
            key={m}
            href={href({ model: m })}
            aria-current={(m === "first") === (model === "ft_source") ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1",
              (m === "first") === (model === "ft_source") ? "border-fg bg-fg text-bg" : "border-border text-muted hover:text-fg",
            )}
          >
            {m === "first" ? "First touch" : "Last touch"}
          </Link>
        ))}
      </div>

      <StatStrip cols={5}>
        <Stat label="Public-site visits" value={visits} hint="Browser sessions" />
        <Stat label="Business searches" value={step("searches")} />
        <Stat label="Records viewed" value={step("records")} />
        <Stat label="Reminder opt-ins" value={step("optins")} hint={`${summary.reminders.confirmed} confirmed`} />
        <Stat label="Filing starts" value={step("starts")} />
        <Stat label="Checkout starts" value={step("checkouts")} />
        <Stat label="Paid customers" value={summary.paid.total} hint="Live payments only" tone={summary.paid.total ? "success" : "neutral"} />
        <Stat label="Visit to paid" value={pct(summary.paid.total, visits)} />
        <Stat label="$0-paid-media customers" value={summary.paid.zeroPaidMedia} hint="Acquisition spend $0.00" />
        <Stat label="Service-fee revenue" value={money(summary.paid.serviceRevenueCents)} hint={`${money(contribution)} after est. Stripe fees`} />
      </StatStrip>

      <Panel title="Funnel" description="Where visitors drop off. Counts are events in the period; each step's rate is against the step before it.">
        <ol className="grid gap-2">
          {summary.steps.map((s, i) => {
            const prev = i > 0 ? summary.steps[i - 1].total : null;
            const width = visits ? Math.max(2, Math.round((s.total / visits) * 100)) : 0;
            return (
              <li key={s.key} className="grid grid-cols-[10rem_1fr_6rem] items-center gap-3 text-sm">
                <span className="text-fg">{s.label}</span>
                <span className="h-3 rounded-full bg-surface-2">
                  <span className="block h-3 rounded-full bg-accent" style={{ width: `${width}%` }} />
                </span>
                <span className="tnum text-right text-muted">
                  {s.total}
                  {prev !== null ? ` · ${pct(s.total, prev)}` : ""}
                </span>
              </li>
            );
          })}
          <li className="grid grid-cols-[10rem_1fr_6rem] items-center gap-3 text-sm">
            <span className="font-semibold text-fg">Paid customers</span>
            <span className="h-3 rounded-full bg-surface-2">
              <span className="block h-3 rounded-full bg-fg" style={{ width: `${visits ? Math.max(2, Math.round((summary.paid.total / visits) * 100)) : 0}%` }} />
            </span>
            <span className="tnum text-right text-muted">
              {summary.paid.total} · {pct(summary.paid.total, step("checkouts"))}
            </span>
          </li>
        </ol>
      </Panel>

      <Panel
        title={`Conversion by source (${model === "ft_source" ? "first touch" : "last touch"})`}
        description="Source comes from the link or referrer: search engines, social sites, ?ref= partner links, utm tags, reminder emails."
        bodyClassName="p-0"
      >
        <TableScroll variant="inset">
          <Table>
            <THead>
              <tr>
                <TH>Source</TH>
                {summary.steps.map((s) => (
                  <TH key={s.key} className="text-right">
                    {s.label}
                  </TH>
                ))}
                <TH className="text-right">Paid</TH>
                <TH className="text-right">Visit to paid</TH>
              </tr>
            </THead>
            <tbody>
              {summary.sources.length === 0 ? (
                <TR>
                  <TD colSpan={summary.steps.length + 3} className="text-muted">
                    No visits recorded in this period yet.
                  </TD>
                </TR>
              ) : (
                summary.sources.map((src) => (
                  <TR key={src}>
                    <TD className="font-medium text-fg">{SOURCE_LABEL[src] ?? humanize(src)}</TD>
                    {summary.steps.map((s) => (
                      <TD key={s.key} className="tnum text-right">
                        {s.bySource[src] ?? 0}
                      </TD>
                    ))}
                    <TD className="tnum text-right font-semibold">{summary.paid.bySource[src] ?? 0}</TD>
                    <TD className="tnum text-right">{pct(summary.paid.bySource[src] ?? 0, summary.steps[0].bySource[src] ?? 0)}</TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </TableScroll>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Free reminders">
          <KeyValues
            items={[
              { term: "Opt-ins", value: summary.reminders.optIns },
              { term: "Confirmed", value: summary.reminders.confirmed },
              { term: "Unsubscribes", value: summary.reminders.unsubscribed },
              { term: "Active subscribers (all time)", value: summary.reminders.activeSubscribers },
              { term: "Reminders sent", value: summary.reminders.sent },
              { term: "Reminder to site visit", value: summary.reminders.clicks },
              { term: "Reminder to filing start", value: summary.reminders.startsFromReminder },
              { term: "Reminder to paid order", value: summary.reminders.paidFromReminder },
            ]}
          />
        </Panel>
        <Panel title="Manual outreach" actions={<Link className="text-sm underline" href="/admin/acquisition/prospects">Open list</Link>}>
          <KeyValues
            items={[
              { term: "Businesses on research lists", value: activity.total },
              { term: "Contacted in the last 7 days", value: activity.contactedSince },
              ...Object.entries(activity.byStatus).map(([k, v]) => ({ term: humanize(k), value: v })),
            ]}
          />
        </Panel>
        <Panel title="Referral partners" actions={<Link className="text-sm underline" href="/admin/acquisition/partners">Open pipeline</Link>}>
          <KeyValues
            items={[
              { term: "Partners tracked", value: partners.length },
              { term: "Interested or active", value: partners.filter((p) => p.status === "interested" || p.status === "active").length },
              { term: "Customers referred", value: referred },
              { term: "Referred service revenue", value: money(partners.reduce((n, p) => n + p.serviceRevenueCents, 0)) },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Launch checks">
        <KeyValues
          items={[
            { term: "Search indexing", value: isIndexable() ? "On (production)" : "Off on this deployment" },
            { term: "Transactional email", value: email.delivering ? "Delivering" : `Not delivering: ${email.reason ?? email.mode}` },
            {
              term: "Postal address for reminder emails",
              value: site.postalAddress ? "Configured" : "Missing: subscriber reminders are skipped until NEXT_PUBLIC_POSTAL_ADDRESS is set",
            },
            { term: "Postcard mailing", value: process.env.MAIL_SENDS_ENABLED === "true" ? "ON" : "Off (MAIL_SENDS_ENABLED not true)" },
            { term: "Cold email", value: process.env.MARKETING_SENDS_ENABLED === "true" ? "ON" : "Off (MARKETING_SENDS_ENABLED not true)" },
            { term: "Partner link format", value: "https://www.getfilewell.com/?ref=<code>" },
          ]}
        />
        {summary.truncated ? <p className="mt-3 text-sm text-warning">Only the first 100,000 events in this period were counted.</p> : null}
      </Panel>
    </div>
  );
}
