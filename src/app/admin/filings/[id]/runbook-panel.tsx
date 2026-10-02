import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Panel } from "@/components/admin/layout-bits";
import { money } from "@/components/admin/format";
import type { ReactNode } from "react";
import { FilingPacketView } from "@/components/intake/filing-packet-view";
import { buildFilingPacket, type PacketRow } from "@/lib/filings/packet";
import { validateAll } from "@/lib/intake/validate";
import { Notice } from "@/components/ui/surface";
import { findRule } from "@/lib/compliance/registry";
import type { IntakeField, IntakeSchema } from "@/lib/compliance/types";
import type { EntityType } from "@/lib/domain/types";
import { governmentFeeDetails } from "@/lib/filings/customer";
import { sameValue } from "@/lib/intake/prefill";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FilingDetail } from "./load";

const NEXT_ACTION: Record<string, string> = {
  draft: "Customer hasn't paid yet. Nothing to file.",
  ready_for_review: "Check the details and authorization, then Mark ready to file.",
  waiting_on_customer: "Wait for the customer's answer, then review again.",
  ready_to_file: "Start filing, then follow the steps in the state portal.",
  in_progress: "Finish in the state portal, then Mark submitted with the confirmation number.",
  submitted: "When the state approves it, Mark accepted and upload the receipt.",
  accepted: "Upload the receipt (visible to the customer) to complete the filing.",
  completed: "Done. The next period's reminders are scheduled automatically.",
  rejected: "Read the state's reason, fix it with the customer, and resubmit.",
};

/**
 * State-specific operator runbook (Washington, Nevada, Utah). Pennsylvania keeps its
 * existing filing packet. Nothing here submits anything: it tells the operator exactly
 * what to enter, what the state should charge, and what to record afterwards.
 */
export async function RunbookPanel({ d }: { d: FilingDetail }) {
  const business = d.business as Record<string, unknown> | null;
  const rule = business
    ? findRule(d.filing.state_code, business.entity_type as EntityType, "annual_report", Boolean(business.is_foreign))
    : undefined;
  const runbook = rule?.operatorRunbook;
  if (!runbook) return null;

  const answers = (d.answers ?? {}) as Record<string, unknown>;
  const schema = (d.snapshot.intake_schema ?? { sections: [] }) as IntakeSchema;
  const fields = new Map<string, IntakeField>(schema.sections.flatMap((s) => s.fields.map((f) => [f.key, f] as const)));
  const [{ data: prefill }, { data: items }, fees] = await Promise.all([
    createAdminClient().from("filing_prefill").select("field_key, source, original_value").eq("filing_id", d.filing.id),
    d.order
      ? createAdminClient().from("order_items").select("kind, description, amount_cents").eq("order_id", d.order.id)
      : Promise.resolve({ data: [] as { kind: string; description: string; amount_cents: number }[] }),
    governmentFeeDetails(d.filing, { is_nonprofit: Boolean(business?.is_nonprofit), state_entity_number: (business?.state_entity_number as string | null) ?? null }).catch(() => null),
  ]);
  const changed = (prefill ?? []).filter((p) => !sameValue(p.original_value, answers[p.field_key as string]));
  // What the operator files is what the customer signed. Each row says where its value came from.
  const signed = (d.authorization?.answers_snapshot ?? null) as Record<string, unknown> | null;
  const current = validateAll(schema, answers).values;
  const packetRows = buildFilingPacket(runbook, schema, signed ?? current);
  const stateRegistry = new Map((prefill ?? []).filter((p) => p.source === "state_registry").map((p) => [String(p.field_key), p.original_value]));
  const provenance = (row: PacketRow): ReactNode => {
    if (!row.answerKey) return <Tag tone="muted">Fixed instruction</Tag>;
    const key = row.answerKey;
    const tags: ReactNode[] = [];
    if (signed && !sameValue(signed[key], current[key])) {
      tags.push(<Tag key="chg" tone="danger">Changed after authorization: customer must reconfirm</Tag>);
    }
    if (stateRegistry.has(key)) {
      tags.push(
        <Tag key="pre" tone="info">
          {signed && !sameValue(stateRegistry.get(key), signed[key]) ? "State-prefilled, corrected by customer" : "State-prefilled"}
        </Tag>,
      );
    }
    tags.push(signed ? <Tag key="ok" tone="success">Customer-confirmed</Tag> : <Tag key="no" tone="warning">Not yet confirmed</Tag>);
    return <span className="flex flex-wrap gap-1.5">{tags}</span>;
  };
  const orderLines = (items ?? [])
    .filter((l) => l.kind !== "service_fee")
    .map((l) => ({ kind: String(l.kind), description: String(l.description), amountCents: Number(l.amount_cents) }));
  const orderGov = orderLines.reduce((n, l) => n + l.amountCents, 0);
  const entityNumber = String(answers.entity_number ?? business?.state_entity_number ?? "") || "Not provided: search by name";
  const consentOk = d.stateAuthorization
    ? d.stateAuthorization.consentMode === "signer_is_agent" || (d.stateAuthorization.consentMode === "agent_to_sign" && d.stateAuthorization.consentDocumentOnFile)
    : true;

  return (
    <Panel
      id="runbook"
      title={`${d.stateName} filing runbook`}
      description="File by hand in the state's portal. Filewell never submits to a government portal automatically."
      actions={
        <a href={runbook.portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium underline">
          {runbook.portalName}
          <ArrowSquareOut size={14} aria-hidden />
        </a>
      }
    >
      <ol className="grid gap-4 text-sm">
        <li>
          <p className="font-semibold text-fg">1-4. State, portal, entity and filing</p>
          <p className="text-muted">
            {d.stateName} · {runbook.portalName} · Entity number: <span className="font-mono text-fg">{entityNumber}</span> ·{" "}
            {String(d.snapshot.filing_name ?? "Annual report")} ({d.filing.period_year}, due {d.filing.due_date})
          </p>
          <p className="mt-1 text-muted">Access: {runbook.access}</p>
        </li>
        <li>
          <p className="font-semibold text-fg">5-6. Confirmed and changed information</p>
          <p className="text-muted">
            Everything the customer confirmed is under &ldquo;Submitted filing information&rdquo; below.{" "}
            {changed.length
              ? `Changed from the prefilled public record: ${changed.map((c) => fields.get(c.field_key as string)?.label ?? c.field_key).join(", ")}.`
              : prefill?.length
                ? "Nothing changed from the prefilled values."
                : "No public-record prefill for this filing (customer typed every value)."}
          </p>
        </li>
        <li>
          <p className="font-semibold text-fg">7-8. Government amount expected</p>
          <ul className="grid gap-1 text-muted">
            {orderLines.length ? (
              orderLines.map((l) => (
                <li key={l.description}>
                  {l.description}: <span className="tnum text-fg">{money(l.amountCents)}</span>
                  {l.kind === "government_late_fee" ? " (state late charge, collected from the customer)" : ""}
                </li>
              ))
            ) : (
              <li>No paid order yet.</li>
            )}
            {orderLines.length ? <li className="font-medium text-fg">Collected for the state: {money(orderGov)}</li> : null}
            {fees?.evaluation.possible.map((l) => (
              <li key={l.key} className="text-warning">
                Check: {l.label} ({money(l.cents)}) {l.reason}. If the portal charges it, it isn&apos;t covered by the order: contact the customer before paying.
              </li>
            ))}
            {fees?.status ? (
              <li>
                State status on record: &ldquo;{fees.status.value}&rdquo; ({fees.status.source}, {fees.status.checkedAt.slice(0, 10)})
              </li>
            ) : (
              <li>No dated state status on file: read the status in the portal before paying.</li>
            )}
          </ul>
          {orderLines.length && fees && fees.evaluation.totalCents !== orderGov ? (
            <Notice tone="warning" className="mt-2" title="Today's state amount differs from the order">
              Today&apos;s evaluation: {money(fees.evaluation.totalCents)}. Pay what the portal shows only if it matches what was collected; otherwise
              contact the customer (refund or collect the difference) before filing.
            </Notice>
          ) : null}
        </li>
        <li>
          <p className="font-semibold text-fg">9. Portal fields, in the portal&apos;s order</p>
          <p className="mb-2 text-muted">
            {signed
              ? `Values the customer signed on ${d.authorization ? d.authorization.created_at.slice(0, 10) : ""}. Enter exactly these.`
              : "No authorization yet: these are the current answers, not yet confirmed by the customer."}
          </p>
          {d.answersChangedSinceAuthorization ? (
            <Notice tone="danger" className="mb-2" title="Changed after authorization">
              Some values changed after the customer signed. Use Request customer information so they review and sign again. Never file the
              changed values without that.
            </Notice>
          ) : null}
          {d.stateAuthorization?.consentRequired ? (
            <Notice tone={consentOk ? "success" : "warning"} className="mb-2" title="Registered agent changes">
              {d.stateAuthorization.consentMode === "signer_is_agent"
                ? "The customer signed Washington's consent to serve as the new registered agent in Filewell (stored with the authorization)."
                : consentOk
                  ? "The new agent's signed consent is uploaded."
                  : "The new agent must sign Washington's consent to serve. Upload it (Registered agent consent) before filing. Never select a consent statement on the state form without it."}
            </Notice>
          ) : null}
          <FilingPacketView rows={packetRows} rowNote={provenance} dense />
          <ol className="mt-3 grid list-decimal gap-1 pl-5 text-muted">
            {runbook.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </li>
        <li>
          <p className="font-semibold text-fg">10-11. Confirmation and receipt</p>
          <p className="text-muted">
            Record the {runbook.confirmationLabel} in &ldquo;Mark submitted&rdquo;. Upload: {runbook.receipt}
          </p>
        </li>
        <li>
          <p className="font-semibold text-fg">12. Next status action</p>
          <p className="text-muted">{NEXT_ACTION[d.filing.status] ?? "Follow the status actions on the right."}</p>
        </li>
      </ol>
    </Panel>
  );
}

function Tag({ tone, children }: { tone: "success" | "warning" | "danger" | "info" | "muted"; children: ReactNode }) {
  const tones = {
    success: "border-accent/30 bg-accent-soft text-accent-soft-fg",
    warning: "border-warning/30 bg-warning-soft text-fg",
    danger: "border-danger/30 bg-danger-soft text-fg",
    info: "border-info/25 bg-info-soft text-fg",
    muted: "border-border bg-bg text-muted",
  } as const;
  return <span className={`inline-flex items-center rounded-[6px] border px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
