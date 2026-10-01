import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { formatDateTime, money } from "@/components/admin/format";
import { ConsoleHeader, EmptyRow, KeyValues, Panel, Stat, StatStrip } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { requireAdmin } from "@/lib/auth/session";
import { DEFAULT_SUBJECTS } from "@/lib/outreach/email";
import { campaignGates, GATE_TEXT } from "@/lib/outreach/gate";
import { gateConfig, outreachStats } from "@/lib/outreach/service";
import { createCampaignAction, createMailPilotAction, importProspectsAction, suppressAction } from "./actions";

export const metadata: Metadata = { title: "Outreach" };

const SEGMENT_LABEL: Record<string, string> = {
  approaching_deadline: "Deadline approaching (within 60 days)",
  deadline_passed_outstanding: "Deadline passed, report verified open by a real-time source (none connected)",
  unknown_status: "Deadline passed, filing status unknown",
  upcoming_deadline: "December 31 deadline within 120 days (postcard)",
};
const GROUP_LABEL: Record<string, string> = { all: "All entity types", llc: "LLCs", corporation: "Corporations", other: "Other associations" };

export default async function OutreachPage() {
  await requireAdmin();
  const s = await outreachStats();
  // Campaign-independent blockers (approval is per campaign).
  const blockers = campaignGates(
    { status: "approved", approvedContentSha256: "x", currentContentSha256: "x", segment: "unknown_status", entityGroup: "all" },
    gateConfig(),
  );

  return (
    <div className="grid grid-cols-1 gap-8">
      <ConsoleHeader
        title="Outreach"
        description="Pennsylvania businesses from the Department of State open register, their annual-report situation, and campaigns you can preview and approve. Nothing on this page sends email."
      />

      <Notice tone="warning" title="Real outreach sending is off">
        Every campaign runs as a dry run. Before anything could send:{" "}
        {blockers.map((b) => GATE_TEXT[b]).join("; ")}.
      </Notice>

      <StatStrip cols={5}>
        <Stat label="PA businesses in dataset" value={s.prospects.toLocaleString("en-US")} hint={`${s.records.toLocaleString("en-US")} register records`} />
        <Stat label="With a business email" value={s.withEmail.toLocaleString("en-US")} hint="The state register has no emails" />
        <Stat label="Eligible (last dry run)" value={s.eligibleInLastDryRun.toLocaleString("en-US")} />
        <Stat label="Do-not-contact" value={s.suppressed.toLocaleString("en-US")} />
        <Stat label="Already customers" value={s.customers.toLocaleString("en-US")} hint="Excluded from outreach" />
      </StatStrip>
      <StatStrip cols={5}>
        <Stat label="Queued" value={s.queued} />
        <Stat label="Sent" value={s.sent} />
        <Stat label="Clicked" value={s.clicked} />
        <Stat label="Started with Filewell" value={s.started} />
        <Stat label="Revenue from outreach" value={money(s.revenueCents)} />
      </StatStrip>

      <Panel
        id="campaigns"
        title="Campaigns"
        description="A campaign is a segment plus one reviewed template. Open one to see exactly who would receive it, why, and the exact email."
        bodyClassName="p-0"
      >
        {s.campaigns.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyRow>No campaigns yet.</EmptyRow>
          </div>
        ) : (
          <TableScroll variant="inset">
            <Table>
              <THead>
                <TR>
                  <TH>Campaign</TH>
                  <TH>Segment</TH>
                  <TH>Status</TH>
                  <TH>Dry run: would receive</TH>
                </TR>
              </THead>
              <tbody>
                {s.campaigns.map((c) => {
                  const rows = s.sendsByCampaign.filter((r) => r.campaign_id === c.id && r.status === "dry_run");
                  return (
                    <TR key={c.id}>
                      <TD>
                        <Link href={`/admin/outreach/${c.id}`} className="font-semibold text-fg underline-offset-4 hover:underline">
                          {c.name}
                        </Link>
                        <span className="block text-xs text-muted">{c.channel === "mail" ? "Postcard pilot" : c.subject}</span>
                      </TD>
                      <TD>
                        {SEGMENT_LABEL[c.segment]}
                        <span className="block text-xs text-muted">{GROUP_LABEL[c.entity_group]}</span>
                      </TD>
                      <TD>
                        <Badge tone={c.status === "approved" ? "success" : "neutral"}>{c.status === "approved" ? "Content approved" : "Draft"}</Badge>
                        {c.approved_at ? <span className="block text-xs text-muted">{formatDateTime(c.approved_at)}</span> : null}
                      </TD>
                      <TD className="tnum">
                        {rows.length ? `${rows.filter((r) => r.reasons.length === 0).length} of ${rows.length}${c.channel === "mail" ? " cards" : ""}` : "Not run"}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel
          id="new-mail-pilot"
          title="New postcard pilot"
          description="Pennsylvania associations with a December 31 deadline (LPs, LLPs, business trusts, professional associations), from imported register records. Builds the selection, exclusions, card and export. Buys and mails nothing."
        >
          <ActionForm action={createMailPilotAction} submitLabel="Create postcard pilot" variant="secondary">
            <Field label="Name" htmlFor="m-name">
              <Input id="m-name" name="name" required maxLength={120} placeholder="PA Dec 31 postcard pilot (Nov 2026)" />
            </Field>
          </ActionForm>
        </Panel>

        <Panel id="new-campaign" title="New email campaign" description="Content is a fixed, reviewed template. Only the subject can change, and official-sounding or pressuring subjects are refused.">
          <ActionForm action={createCampaignAction} submitLabel="Create draft" variant="primary">
            <Field label="Name" htmlFor="c-name">
              <Input id="c-name" name="name" required maxLength={120} placeholder="PA LLCs, deadline passed (Oct 2026)" />
            </Field>
            <Field label="Segment" htmlFor="c-seg">
              <Select id="c-seg" name="segment" defaultValue="unknown_status">
                {Object.entries(SEGMENT_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Entity types" htmlFor="c-grp">
              <Select id="c-grp" name="entityGroup" defaultValue="llc">
                {Object.entries(GROUP_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject (optional)" htmlFor="c-sub" hint={`Default: "${DEFAULT_SUBJECTS.unknown_status}"`}>
              <Input id="c-sub" name="subject" maxLength={150} />
            </Field>
          </ActionForm>
        </Panel>

        <Panel
          id="import"
          title="Import from the PA register"
          description="Business-level data only (name, entity number, type, address, county, formation date) from the Department of State open dataset on data.pa.gov. Public domain. No person names, no emails."
        >
          <ActionForm action={importProspectsAction} submitLabel="Import" variant="secondary">
            <Field label="Entity types" htmlFor="i-grp">
              <Select id="i-grp" name="group" defaultValue="llc">
                <option value="llc">LLCs</option>
                <option value="corporation">Corporations (business and nonprofit)</option>
                <option value="other">Other associations (LPs, business trusts, professional associations)</option>
              </Select>
            </Field>
            <Field label="County (optional)" htmlFor="i-county" hint="As the register spells it, e.g. Lehigh">
              <Input id="i-county" name="county" maxLength={40} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="How many (max 500)" htmlFor="i-limit">
                <Input id="i-limit" name="limit" inputMode="numeric" defaultValue="100" />
              </Field>
              <Field label="Skip the first" htmlFor="i-offset">
                <Input id="i-offset" name="offset" inputMode="numeric" defaultValue="0" />
              </Field>
            </div>
          </ActionForm>
        </Panel>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel id="sources" title="Where contact emails could come from">
          <KeyValues
            items={[
              { term: "PA register (data.pa.gov)", value: "Names, entity numbers, types, an address, county. No emails, phones, standing or filing history." },
              { term: "file.dos.pa.gov", value: "Behind a bot challenge; never automated." },
              { term: "Licensed provider", value: "Needs your approval and a budget. Each email must record its source and a licence that permits marketing." },
              { term: "Opt-in", value: "Customers and visitors who ask for reminders (already supported)." },
            ]}
          />
        </Panel>
        <Panel id="suppress" title="Do-not-contact list" description="Permanent. Unsubscribes, bounces and complaints are added automatically; add an address by hand here.">
          <ActionForm action={suppressAction} submitLabel="Add to do-not-contact" variant="secondary">
            <Field label="Email" htmlFor="s-email">
              <Input id="s-email" name="email" type="email" required maxLength={320} />
            </Field>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
