import { ActionForm } from "@/components/admin/action-form";
import { formatDateTime, money } from "@/components/admin/format";
import { ConsoleHeader, EmptyRow, KeyValues, Panel, Stat, StatStrip } from "@/components/admin/layout-bits";
import { opsButton } from "@/components/admin/button-classes";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/surface";
import { MAIL_EXCLUSION_TEXT, type MailExclusion } from "@/lib/outreach/mail";
import { cheapestPlan, NET_PER_ORDER, PILOT_SIZES, pilotCost, STRIPE_FEE, VENDOR_PLANS } from "@/lib/outreach/mail-economics";
import { buildMailPilot, MAIL_GATE_TEXT, mailGates, postcardForRow } from "@/lib/outreach/mail-service";
import { approveMailPilotAction, mailDryRunAction } from "../actions";

const SHOW = 100;
const pct = (n: number) => `${(n * 100).toFixed(n < 0.01 ? 2 : 1)}%`;

export async function MailPilotView({ campaign }: { campaign: { id: string; name: string; status: string; approved_at: string | null } }) {
  const rows = await buildMailPilot(campaign.id, { persist: false });
  const included = rows.filter((r) => r.included);
  const byReason = new Map<MailExclusion, number>();
  for (const r of rows) for (const x of r.exclusions) byReason.set(x, (byReason.get(x) ?? 0) + 1);
  const gates = mailGates(campaign);
  const sample = included[0] ?? null;
  const card = postcardForRow(sample ?? { businessName: "Example Partners LP", entityType: "lp", periodYear: null, landingUrl: null });

  return (
    <div className="grid grid-cols-1 gap-8">
      <ConsoleHeader
        eyebrow="Outreach · Postcard pilot (December 31 deadline)"
        title={campaign.name}
        description={`${rows.length} imported PA businesses evaluated. ${included.length} would get a card today.`}
        actions={
          <>
            <a className={opsButton("secondary")} href={`/admin/outreach/${campaign.id}/export`}>
              Download export (CSV)
            </a>
            <a className={opsButton("secondary")} href={`/admin/outreach/${campaign.id}/export?format=html`}>
              Card template (HTML)
            </a>
          </>
        }
      />

      <Notice tone="warning" title="Nothing is purchased or mailed from here">
        The export is for review and for a future vendor upload. Before anything could be mailed: {gates.map((g) => MAIL_GATE_TEXT[g]).join("; ")}.
      </Notice>

      <StatStrip cols={4}>
        <Stat label="Evaluated" value={rows.length} hint="Imported from the PA register (Admin > Outreach > Import, Other associations)" />
        <Stat label="Would get a card" value={included.length} tone={included.length ? "success" : "neutral"} />
        <Stat label="Excluded" value={rows.length - included.length} />
        <Stat label="Card status" value={campaign.status === "approved" ? "Content approved" : "Draft"} hint={campaign.approved_at ? formatDateTime(campaign.approved_at) : undefined} />
      </StatStrip>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel id="exclusions" title="Exclusions" description="A business can have more than one reason.">
          {byReason.size === 0 ? (
            <EmptyRow>No exclusions.</EmptyRow>
          ) : (
            <KeyValues items={[...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ term: String(n), value: MAIL_EXCLUSION_TEXT[k] }))} />
          )}
        </Panel>
        <Panel id="gates" title="Approval">
          <KeyValues items={gates.map((g) => ({ term: "Blocked", value: MAIL_GATE_TEXT[g] }))} />
          <div className="mt-4 grid justify-items-start gap-4">
            <ActionForm action={mailDryRunAction} submitLabel="Record dry run" variant="secondary">
              <input type="hidden" name="campaignId" value={campaign.id} />
            </ActionForm>
            {campaign.status !== "approved" ? (
              <ActionForm action={approveMailPilotAction} submitLabel="Approve card content" variant="primary" confirmLabel="I reviewed the card, the selection and the exclusions.">
                <input type="hidden" name="campaignId" value={campaign.id} />
              </ActionForm>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel id="card" title="The card" description={sample ? `As ${sample.businessName} would receive it.` : "Sample wording (no business would get a card yet)."}>
        <div className="mx-auto grid max-w-[34rem] gap-2 rounded-[6px] border border-border-strong bg-white p-5 text-[13px] leading-5 text-[#17231d] shadow-card">
          <p className="bg-[#17231d] px-2 py-1 text-center text-[11px] font-bold tracking-wide text-white">{card.banner}</p>
          <p className="font-bold text-[#1f5a3e]">{card.brandLine}</p>
          <p className="text-[17px] font-bold leading-snug">{card.headline}</p>
          <p className="font-semibold">{card.forLine}</p>
          <ul className="list-disc pl-5">
            {card.options.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          <p>{card.ignore}</p>
          <p className="font-bold">{card.cta}</p>
          <div className="mt-2 grid gap-1 text-[10px] leading-4 text-[#333]">
            {card.finePrint.map((f) => (
              <p key={f}>{f}</p>
            ))}
            <p>{card.returnAddress}</p>
          </div>
        </div>
      </Panel>

      <Panel
        id="costs"
        title="Cost and unit economics (estimates)"
        description={`4x6 First-Class, print and postage included, prices read 2026-09-30 (Lob's increase on Nov 1 applied). Net per paid order: $49 service fee minus ${money(STRIPE_FEE * 100)} card fee = ${money(NET_PER_ORDER * 100)}; the $7 state fee passes through. Conversion rates are assumptions.`}
        bodyClassName="p-0"
      >
        <TableScroll variant="inset">
          <Table>
            <THead>
              <TR>
                <TH>Pieces</TH>
                <TH>Cheapest plan</TH>
                <TH>Cost</TH>
                <TH>Break-even</TH>
                <TH>At 0.5% / 1% / 2% paid</TH>
              </TR>
            </THead>
            <tbody>
              {PILOT_SIZES.map((n) => {
                const c = cheapestPlan(n);
                return (
                  <TR key={n}>
                    <TD className="tnum">{n.toLocaleString("en-US")}</TD>
                    <TD>
                      {c.plan.vendor} {c.plan.plan}
                      <span className="block text-xs text-muted">{money(c.costPerPiece * 100)} a piece</span>
                    </TD>
                    <TD className="tnum">{money(c.cost * 100)}</TD>
                    <TD className="tnum">
                      {c.breakEvenOrders} orders ({pct(c.breakEvenRate)})
                    </TD>
                    <TD className="tnum text-sm">
                      {c.scenarios
                        .filter((s) => s.rate >= 0.005)
                        .map((s) => `${s.orders} → ${money(s.net * 100)}`)
                        .join(" · ")}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
        <p className="px-5 py-3 text-xs text-muted">
          Plans compared: {VENDOR_PLANS.map((p) => `${p.vendor} ${p.plan} (${money(p.perPiece * 100)}/piece${p.monthlyFee ? ` + ${money(p.monthlyFee * 100)}/mo` : ""}${p.monthlyCap ? `, ${p.monthlyCap}/mo cap` : ""})`).join("; ")}.
          5,000 on Lob Developer instead: {money(pilotCost(5000, VENDOR_PLANS[0]).cost * 100)}.
        </p>
      </Panel>

      <Panel id="rows" title="Selection" description={`First ${SHOW} rows. The export has every row with provenance and landing URLs.`} bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyRow>No businesses imported yet. Import &quot;Other associations&quot; on the Outreach page.</EmptyRow>
          </div>
        ) : (
          <TableScroll variant="inset">
            <Table>
              <THead>
                <TR>
                  <TH>Business</TH>
                  <TH>Address on record</TH>
                  <TH>Deadline</TH>
                  <TH>Card</TH>
                </TR>
              </THead>
              <tbody>
                {rows.slice(0, SHOW).map((r) => (
                  <TR key={r.prospectId}>
                    <TD valign="top">
                      <span className="font-semibold">{r.businessName}</span>
                      <span className="block text-xs text-muted">
                        {r.entityTypeLabel} · #{r.entityNumber}
                      </span>
                    </TD>
                    <TD valign="top" className="text-sm">
                      {r.mailingAddress || <span className="text-muted">None</span>}
                    </TD>
                    <TD valign="top" className="tnum text-sm">
                      {r.deadline}
                    </TD>
                    <TD valign="top">
                      {r.included ? (
                        <>
                          <Badge tone="success">Would get a card</Badge>
                          <span className="block break-all text-xs text-muted">{r.landingUrl}</span>
                        </>
                      ) : (
                        <ul className="grid gap-0.5 text-xs text-muted">
                          {r.exclusions.map((x) => (
                            <li key={x}>{MAIL_EXCLUSION_TEXT[x]}</li>
                          ))}
                        </ul>
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}
