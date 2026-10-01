import { ActionForm } from "@/components/admin/action-form";
import { opsButton } from "@/components/admin/button-classes";
import { formatDateTime, money } from "@/components/admin/format";
import { ConsoleHeader, EmptyRow, KeyValues, Panel, Stat, StatStrip } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/surface";
import { COHORT_EXCLUSION_TEXT, type CohortExclusion } from "@/lib/outreach/mail";
import { loadCohort, pilotFunnel } from "@/lib/outreach/mail-cohort";
import { NET_PER_ORDER, STRIPE_FEE, VENDOR_PLANS } from "@/lib/outreach/mail-economics";
import { lobStatus } from "@/lib/outreach/mail-lob";
import { postcardForRow } from "@/lib/outreach/mail-service";
import { postcardBackHtml, postcardFrontHtml } from "@/lib/outreach/postcard";
import { approveMailPilotAction, createLobTestAction, freezeCohortAction } from "../actions";

const LOB = VENDOR_PLANS.find((p) => p.id === "lob_developer")!;
const reasonText = (r: string) => (r === "eligible_reserve" ? "Eligible, held in reserve (not in this cohort)" : (COHORT_EXCLUSION_TEXT[r as CohortExclusion] ?? r));
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "-");

export async function MailPilotView({ campaign }: { campaign: { id: string; name: string; status: string; approved_at: string | null; created_at: string } }) {
  const cohort = await loadCohort(campaign.id);
  const selected = cohort.filter((r) => r.selected);
  const notSelected = cohort.filter((r) => !r.selected);
  const f = await pilotFunnel(campaign.created_at, cohort);
  const lob = lobStatus(campaign.status === "approved");

  const pieces = selected.length;
  const mailCost = Math.round(pieces * LOB.perPiece * 100) / 100;
  const breakEven = pieces ? Math.ceil(mailCost / NET_PER_ORDER) : 0;
  const base = f.mailed || pieces;
  const contributionCents = f.serviceRevenueCents - f.stripeFeesCents - (f.mailed ? Math.round(f.mailed * LOB.perPiece * 100) : 0);
  const cac = f.paid ? (f.mailed * LOB.perPiece) / f.paid : null;
  const byReason = new Map<string, number>();
  for (const r of notSelected) for (const x of r.reasons) byReason.set(x, (byReason.get(x) ?? 0) + 1);
  const sample = selected[0] ?? null;
  // Rendered here and shown via srcdoc: the site forbids framing its own pages (frame-ancestors 'none').
  const sampleCopy = sample ? postcardForRow(sample) : null;
  const artwork = sample && sampleCopy && sample.landingCode
    ? { front: postcardFrontHtml(sampleCopy), back: postcardBackHtml(sampleCopy, `/m/${sample.landingCode}/qr.png`) }
    : null;

  return (
    <div className="grid grid-cols-1 gap-8">
      <ConsoleHeader
        eyebrow="Outreach · Postcard pilot (December 31 deadline)"
        title={campaign.name}
        description={`${pieces} businesses selected from ${cohort.length} considered. Nothing has been mailed.`}
        actions={
          <a className={opsButton("secondary")} href={`/admin/outreach/${campaign.id}/export`}>
            Download export (CSV)
          </a>
        }
      />

      <Notice tone="warning" title="Mailing is switched off">
        No mail has been created or purchased. Live mailing needs: {lob.liveBlockers.join("; ") || "nothing else"}. MAIL_SENDS_ENABLED stays false until you authorize the pilot.
      </Notice>

      <section aria-labelledby="funnel-title" className="grid gap-3">
        <h2 id="funnel-title" className="text-[17px] font-semibold text-fg">
          Funnel
        </h2>
        <StatStrip cols={5}>
          <Stat label="Selected" value={pieces} />
          <Stat label="Mailed" value={f.mailed} hint="Live pieces only" />
          <Stat label="Visits" value={f.visits} hint={pct(f.visits, base)} />
          <Stat label="Record viewed" value={f.recordViews} />
          <Stat label="Filing started" value={f.filingStarts} />
        </StatStrip>
        <StatStrip cols={5}>
          <Stat label="Checkout started" value={f.checkouts} />
          <Stat label="Paid orders" value={f.paid} tone={f.paid ? "success" : "neutral"} />
          <Stat label="Conversion (paid / mailed)" value={pct(f.paid, f.mailed)} />
          <Stat label="Acquisition cost" value={cac === null ? "-" : money(Math.round(cac * 100))} hint="Mailing cost / paid orders" />
          <Stat label="Service-fee revenue" value={money(f.serviceRevenueCents)} hint="Net of refunds; $7 state fees excluded" />
        </StatStrip>
        <StatStrip cols={3}>
          <Stat label="Estimated mailing cost" value={money(Math.round(mailCost * 100))} hint={`${pieces} x ${money(LOB.perPiece * 100)} (Lob 4x6 First-Class, print + postage, from Nov 1, 2026)`} />
          <Stat label="Contribution after Stripe and mail" value={money(contributionCents)} hint="Revenue - card fees - mailed cost" tone={contributionCents > 0 ? "success" : "neutral"} />
          <Stat label="Break-even paid orders" value={breakEven} hint={`At ${money(NET_PER_ORDER * 100)} net per order ($49 - ${money(STRIPE_FEE * 100)} card fee)`} />
        </StatStrip>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel id="cohort" title="Cohort">
          {cohort.length === 0 ? (
            <div className="grid gap-3">
              <EmptyRow>No cohort saved yet. Import &quot;Other associations&quot; on the Outreach page, then save a cohort.</EmptyRow>
            </div>
          ) : (
            <KeyValues
              items={[
                { term: "Selected", value: `${pieces}` },
                { term: "Not selected", value: `${notSelected.length}` },
                ...[...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ term: String(n), value: reasonText(k) })),
              ]}
            />
          )}
          <div className="mt-4">
            <ActionForm action={freezeCohortAction} submitLabel={cohort.length ? "Rebuild cohort from imported records" : "Save a 100-business cohort"} variant="secondary" confirmLabel={cohort.length ? "Replace the saved cohort (the selection may change)." : undefined}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <input type="hidden" name="size" value="100" />
            </ActionForm>
          </div>
        </Panel>

        <Panel id="lob" title="Lob (print and mail)">
          <KeyValues
            items={[
              { term: "API key", value: lob.mode === "test" ? "Test key (never mails)" : lob.mode === "live" ? "Live key" : "Not configured" },
              { term: "Return address", value: lob.from ? `${lob.from.address_line1}, ${lob.from.address_city}, ${lob.from.address_state} ${lob.from.address_zip}` : "Not configured" },
              { term: "Test pieces", value: `${selected.filter((r) => r.vendorTest).length} of ${pieces}` },
              { term: "Card content", value: campaign.status === "approved" ? `Approved ${campaign.approved_at ? formatDateTime(campaign.approved_at) : ""}` : "Not approved" },
            ]}
          />
          <div className="mt-4 grid justify-items-start gap-4">
            {lob.mode === "test" ? (
              <ActionForm action={createLobTestAction} submitLabel="Create test postcards in Lob" variant="secondary">
                <input type="hidden" name="campaignId" value={campaign.id} />
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">Add a Lob test key (LOB_API_KEY=test_...) and the MAIL_FROM_* return address to render test proofs. Test pieces are never mailed or charged.</p>
            )}
            {campaign.status !== "approved" ? (
              <ActionForm action={approveMailPilotAction} submitLabel="Approve card content" variant="primary" confirmLabel="I reviewed the card, the selection and the exclusions.">
                <input type="hidden" name="campaignId" value={campaign.id} />
              </ActionForm>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel id="artwork" title="Card artwork (4x6)" description={sample ? `As ${sample.businessName} would receive it. Front, then back (the blank right side is for the address block and postage).` : "Save a cohort to preview a real card."}>
        {sample ? (
          <div className="grid gap-6 xl:grid-cols-2">
            {(["front", "back"] as const).map((side) => (
              <div key={side} className="grid gap-2">
                <p className="text-sm font-semibold capitalize text-fg">{side}</p>
                <div className="w-full max-w-[600px] overflow-hidden rounded-[6px] border border-border-strong bg-white shadow-card">
                  <iframe title={`Card ${side}`} srcDoc={artwork?.[side]} sandbox="" className="block h-[408px] w-[600px] border-0" />
                </div>
                <a className="text-sm underline underline-offset-4" href={`/admin/outreach/${campaign.id}/card?send=${sample.sendId}&side=${side}`} target="_blank" rel="noreferrer">
                  Open {side} at full size
                </a>
              </div>
            ))}
          </div>
        ) : (
          <EmptyRow>No card yet.</EmptyRow>
        )}
      </Panel>

      <Panel id="selected" title={`Selected businesses (${pieces})`} description="Pennsylvania record found for each; the card says the report may be due. Each has its own signed landing URL." bodyClassName="p-0">
        {pieces === 0 ? (
          <div className="px-5 py-4">
            <EmptyRow>None yet.</EmptyRow>
          </div>
        ) : (
          <TableScroll variant="inset">
            <Table>
              <THead>
                <TR>
                  <TH>Business</TH>
                  <TH>Mailing address (record)</TH>
                  <TH>Deadline</TH>
                  <TH>Landing URL</TH>
                  <TH>Funnel</TH>
                </TR>
              </THead>
              <tbody>
                {selected.map((r) => (
                  <TR key={r.sendId}>
                    <TD valign="top">
                      <span className="font-semibold">{r.businessName}</span>
                      <span className="block text-xs text-muted">
                        {r.entityTypeLabel} · #{r.entityNumber}
                      </span>
                    </TD>
                    <TD valign="top" className="text-sm">
                      {r.mailingAddress}
                    </TD>
                    <TD valign="top" className="tnum text-sm">
                      {r.deadline}
                    </TD>
                    <TD valign="top" className="break-all text-xs text-muted">
                      {r.landingUrl}
                    </TD>
                    <TD valign="top" className="text-xs">
                      {r.businessId ? <Badge tone="success">Started</Badge> : r.recordViewedAt ? <Badge tone="info">Viewed record</Badge> : r.clickedAt ? <Badge tone="info">Visited</Badge> : <span className="text-muted">No visit</span>}
                      {r.vendorTest ? <span className="block text-muted">Lob test piece</span> : null}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      <Panel id="excluded" title={`Not selected (${notSelected.length})`} description="Every considered business that is not in the cohort, with the reasons." bodyClassName="p-0">
        {notSelected.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyRow>None.</EmptyRow>
          </div>
        ) : (
          <TableScroll variant="inset">
            <Table>
              <THead>
                <TR>
                  <TH>Business</TH>
                  <TH>Address on record</TH>
                  <TH>Reasons</TH>
                </TR>
              </THead>
              <tbody>
                {notSelected.slice(0, 500).map((r) => (
                  <TR key={r.sendId}>
                    <TD valign="top">
                      <span className="font-semibold">{r.businessName}</span>
                      <span className="block text-xs text-muted">#{r.entityNumber}</span>
                    </TD>
                    <TD valign="top" className="text-sm">
                      {r.mailingAddress || <span className="text-muted">None</span>}
                    </TD>
                    <TD valign="top">
                      <ul className="grid gap-0.5 text-xs text-muted">
                        {r.reasons.map((x) => (
                          <li key={x}>{reasonText(x)}</li>
                        ))}
                      </ul>
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
