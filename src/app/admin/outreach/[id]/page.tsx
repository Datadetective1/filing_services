import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { formatDateTime } from "@/components/admin/format";
import { ConsoleHeader, EmptyRow, KeyValues, Panel } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/surface";
import { requireAdmin } from "@/lib/auth/session";
import { GATE_TEXT } from "@/lib/outreach/gate";
import { dryRunCampaign, previewEmail, type CampaignRow } from "@/lib/outreach/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveCampaignAction, dryRunAction } from "../actions";

export const metadata: Metadata = { title: "Campaign preview" };

const SHOW = 200;

export default async function CampaignPage({ params }: PageProps<"/admin/outreach/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await createAdminClient()
    .from("marketing_campaigns")
    .select("id, name, segment, entity_group, subject, status, approved_content_sha256, approved_at")
    .eq("id", id)
    .maybeSingle();
  const campaign = data as CampaignRow | null;
  if (!campaign) notFound();

  // Evaluated live for the page (not stored); "Record dry run" stores the result.
  const run = await dryRunCampaign(campaign, { persist: false });
  const selected = run.recipients.filter((r) => !r.reasons.includes("not_in_segment") && !r.reasons.includes("entity_group_mismatch"));
  const would = run.recipients.filter((r) => r.wouldSend);
  const sample = selected[0] ?? run.recipients[0] ?? null;
  const email = sample ? previewEmail(campaign, sample) : null;
  const approvedCurrent = campaign.status === "approved" && campaign.approved_content_sha256 === run.currentSha;

  return (
    <div className="grid grid-cols-1 gap-8">
      <ConsoleHeader
        eyebrow={<Link href="/admin/outreach">Outreach</Link>}
        title={campaign.name}
        description={`${run.recipients.length} PA businesses evaluated. ${selected.length} match this segment. ${would.length} would receive it right now.`}
      />

      <Notice tone="warning" title="Nothing is sent from this page">
        Approving records the exact content you reviewed. Real sending needs every gate below to pass, and the sends switch stays
        off.
      </Notice>

      <Panel id="gates" title="Sending gates">
        <KeyValues
          items={[
            { term: "Content approval", value: approvedCurrent ? `Approved ${formatDateTime(campaign.approved_at!)}` : "Not approved (or changed since approval)" },
            ...run.campaignGates.filter((g) => g !== "campaign_not_approved").map((g) => ({ term: "Blocked", value: GATE_TEXT[g] })),
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <ActionForm action={dryRunAction} submitLabel="Record dry run" variant="secondary">
            <input type="hidden" name="campaignId" value={campaign.id} />
          </ActionForm>
          {!approvedCurrent ? (
            <ActionForm action={approveCampaignAction} submitLabel="Approve this content" variant="primary" confirmLabel="I reviewed the recipients, the reasons and the exact email below.">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <input type="hidden" name="contentSha" value={run.currentSha} />
            </ActionForm>
          ) : null}
        </div>
      </Panel>

      <Panel id="email" title="Exact email" description={sample ? `As ${sample.businessName} would receive it.` : "Import businesses to preview the email for a real recipient."}>
        {email ? (
          <div className="grid gap-3">
            <KeyValues
              items={[
                { term: "From", value: process.env.MARKETING_EMAIL_FROM || "Not configured" },
                { term: "Subject", value: email.subject },
              ]}
            />
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-[var(--radius-control)] border border-border bg-surface-2/50 p-4 font-sans text-sm leading-6 text-fg">
              {email.text}
            </pre>
          </div>
        ) : (
          <EmptyRow>No businesses imported yet.</EmptyRow>
        )}
      </Panel>

      <Panel
        id="recipients"
        title="Recipients and reasons"
        description={`Businesses in this segment${selected.length > SHOW ? ` (first ${SHOW} of ${selected.length})` : ""}: why each was selected, its deadline, sources, and every reason it would not be sent.`}
        bodyClassName="p-0"
      >
        {selected.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyRow>No imported business is in this segment today.</EmptyRow>
          </div>
        ) : (
          <TableScroll variant="inset">
            <Table>
              <THead>
                <TR>
                  <TH>Business</TH>
                  <TH>Why selected</TH>
                  <TH>Record source</TH>
                  <TH>Email and source</TH>
                  <TH>Decision</TH>
                </TR>
              </THead>
              <tbody>
                {selected.slice(0, SHOW).map((r) => (
                  <TR key={r.prospectId}>
                    <TD valign="top">
                      <span className="font-semibold">{r.businessName}</span>
                      <span className="block text-xs text-muted">Entity #{r.entityNumber}</span>
                    </TD>
                    <TD valign="top" className="text-sm">
                      {r.situation.kind === "assessed" ? r.situation.why : r.situation.reason}
                    </TD>
                    <TD valign="top" className="text-sm">
                      {r.recordSource === "pa_dos_open_data" ? "PA DOS open register" : (r.recordSource ?? "Unknown")}
                    </TD>
                    <TD valign="top" className="text-sm">
                      {r.email ? (
                        <>
                          {r.email}
                          <span className="block text-xs text-muted">{r.emailSource ?? "No source"}</span>
                        </>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </TD>
                    <TD valign="top">
                      {r.wouldSend ? (
                        <Badge tone="success">Would send</Badge>
                      ) : (
                        <ul className="grid gap-0.5 text-xs text-muted">
                          {r.reasons.map((x) => (
                            <li key={x}>{GATE_TEXT[x as keyof typeof GATE_TEXT] ?? x}</li>
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
