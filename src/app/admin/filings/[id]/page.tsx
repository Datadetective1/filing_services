import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowSquareOut, CaretDown, DownloadSimple, FileText, ShieldCheck, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { ActionForm } from "@/components/admin/action-form";
import { AdminStatusBadge, DeadlineText, StatusPill, UrgencyBadge } from "@/components/admin/badges";
import { opsButton } from "@/components/admin/button-classes";
import { FilingProgress } from "@/components/admin/filing-progress";
import { centsToDollarsInput, formatDate, formatDateTime, humanize, money, opsToday, shortId } from "@/components/admin/format";
import { IntakeAnswersView, PeopleList } from "@/components/admin/intake-answers";
import { EmptyRow, JsonDetails, KeyValues, Panel, SectionNav, tableLink } from "@/components/admin/layout-bits";
import { ADMIN_STATUS_LABELS, DOCUMENT_KIND_LABELS } from "@/components/admin/status";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { DEADLINE_SENSITIVE_STATUSES } from "@/components/admin/urgency";
import { PaymentStatusBadge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { CountdownRing } from "@/components/visual/countdown-ring";
import { DocumentSheet } from "@/components/visual/document-tile";
import { requireStaff } from "@/lib/auth/session";
import { daysBetween, describeDaysRemaining, formatLongDate } from "@/lib/domain/dates";
import { canTransition, isFilingStatus, OPERATOR_NEXT_ACTION, type FilingStatus } from "@/lib/domain/filing-status";
import { ENTITY_TYPE_LABELS, isEntityType } from "@/lib/domain/types";
import { formatAddress } from "@/lib/intake/validate";
import { staffLabel, type ProfileEntry } from "../../_lib/data";
import {
  addNoteAction,
  assignAction,
  cancelAction,
  completeAction,
  markAcceptedAction,
  markReadyAction,
  markRejectedAction,
  markSubmittedAction,
  refundAction,
  reopenAction,
  requestInformationAction,
  sendMessageAction,
  startFilingAction,
  uploadDocumentAction,
} from "./actions";
import { loadFilingDetail, type AddressRow, type FilingDetail } from "./load";

export const metadata: Metadata = { title: "Order detail" };

export default async function FilingDetailPage(props: PageProps<"/admin/filings/[id]">) {
  const staff = await requireStaff();
  const { id } = await props.params;
  const d = await loadFilingDetail(id);
  if (!d) notFound();

  const today = opsToday();
  const { filing, business, snapshot } = d;
  const filingName = snapshot.filing_name ?? "Annual Report";
  const assigned = filing.assigned_to ? d.staff.get(filing.assigned_to) : null;

  return (
    <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-6">
      <div className="grid gap-3">
        <Link href="/admin/queue" className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-[var(--radius-control)] text-sm font-medium text-muted hover:text-fg">
          <ArrowLeft size={16} aria-hidden />
          Queue
        </Link>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid min-w-0 gap-2">
            <p className="text-[13px] font-semibold text-subtle">
              {d.stateName} {filingName}
              {snapshot.form_number ? ` (${snapshot.form_number})` : ""} · {filing.period_year} report · Order{" "}
              <span className="font-mono font-medium">{shortId(filing.id)}</span>
            </p>
            <h1 className="break-words text-[28px] font-semibold leading-[1.1] text-fg sm:text-[34px]">{business?.legal_name ?? "Unknown business"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <AdminStatusBadge status={filing.status} />
              <UrgencyBadge dueDate={filing.due_date} today={today} status={filing.status} />
              <span className="text-sm text-muted">
                Assigned: <span className="font-medium text-fg">{staffLabel(assigned)}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/filings/${filing.id}/packet`} className={opsButton("primary")}>
              <FileText size={18} aria-hidden />
              Open filing packet
            </Link>
            {snapshot.official_filing_url ? (
              <a href={snapshot.official_filing_url} target="_blank" rel="noopener noreferrer" className={opsButton("secondary")}>
                Open official filing site
                <ArrowSquareOut size={16} aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <StatusBand d={d} today={today} />

      {filing.status === "rejected" && filing.rejection_reason ? (
        <Notice tone="danger" role="alert" title="Rejected by the state">
          {filing.rejection_reason}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <aside
          aria-label="Actions"
          className="grid min-w-0 grid-cols-1 content-start gap-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-0.5"
        >
          <ActionsPanel d={d} isAdmin={staff.role === "admin"} today={today} />
        </aside>

        <div className="grid min-w-0 grid-cols-1 gap-6 lg:col-start-1 lg:row-start-1">
          <SectionNav
            label="Order sections"
            items={[
              { id: "customer", label: "Customer" },
              { id: "business", label: "Business" },
              { id: "answers", label: "Answers" },
              { id: "authorization", label: "Authorization" },
              { id: "payment", label: "Payment" },
              { id: "rule", label: "Rule" },
              { id: "documents", label: "Documents", count: d.documents.length },
              { id: "messages", label: "Messages", count: d.messages.length },
              { id: "notes", label: "Notes", count: d.notes.length },
              { id: "history", label: "History" },
              { id: "audit", label: "Audit" },
            ]}
          />
          <CustomerPanel customer={d.customer} userId={filing.user_id} />
          <BusinessPanel d={d} />
          <Panel
            id="answers"
            title="Submitted filing information"
            description="What the customer entered, in the order of the intake form frozen with this filing's rule."
          >
            {!d.answersComplete ? (
              <Notice tone="warning" className="mb-4" title="Intake is incomplete">
                Some required answers are missing or invalid. Request information before filing.
              </Notice>
            ) : null}
            <IntakeAnswersView schema={snapshot.intake_schema} answers={d.answers} />
          </Panel>
          <AuthorizationPanel d={d} />
          <PaymentPanel d={d} />
          <RulePanel d={d} />
          <DocumentsPanel d={d} />
          <MessagesPanel d={d} />
          <NotesPanel d={d} />
          <HistoryPanel d={d} />
          <AuditPanel d={d} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function StatusBand({ d, today }: { d: FilingDetail; today: string }) {
  const { filing, order } = d;
  const sensitive = DEADLINE_SENSITIVE_STATUSES.includes(filing.status);
  const days = daysBetween(today, filing.due_date);
  const items: { label: string; value: ReactNode; className?: string }[] = [
    {
      label: "Deadline",
      className: "col-span-2 sm:col-span-1",
      value: (
        <span className="flex items-center gap-3">
          {sensitive ? (
            <CountdownRing
              days={days}
              size={52}
              label={`${describeDaysRemaining(days)}. Due ${formatLongDate(filing.due_date)}.`}
            />
          ) : null}
          <DeadlineText dueDate={filing.due_date} today={today} status={filing.status} />
        </span>
      ),
    },
    { label: "Government fee", value: <span className="tnum">{money(order?.government_fee_cents)}</span> },
    { label: "Service fee", value: <span className="tnum">{money(order?.service_fee_cents)}</span> },
    { label: "Total", value: <span className="tnum font-display text-lg font-semibold">{money(order?.total_cents)}</span> },
    { label: "Payment", value: <PaymentStatusBadge status={order?.status} /> },
    {
      label: "Confirmation",
      className: "col-span-2 sm:col-span-1",
      value: filing.state_confirmation_number ? (
        <span className="break-all font-mono text-[15px] font-medium">{filing.state_confirmation_number}</span>
      ) : (
        <span className="text-muted">Not submitted</span>
      ),
    },
  ];
  return (
    <section aria-label="Filing summary" className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
      <div className="px-4 py-5 sm:px-6">
        <FilingProgress status={filing.status} />
      </div>
      <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className={cn("grid content-start gap-1.5 bg-surface px-5 py-4", item.className)}>
            <dt className="text-[13px] font-medium text-muted">{item.label}</dt>
            <dd className="flex min-h-7 items-center text-[15px] text-fg">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function ActionsPanel({ d, isAdmin, today }: { d: FilingDetail; isAdmin: boolean; today: string }) {
  const { filing } = d;
  const status = filing.status;
  const id = filing.id;
  const hidden = <input type="hidden" name="filingId" value={id} />;
  const canRequest = status === "needs_customer_action" || status === "needs_information" || canTransition(status, "needs_customer_action");
  const reopenTarget: FilingStatus = status === "rejected" ? "ready_to_file" : "ready_for_review";
  // A draft is unpaid: it reaches review only through checkout, never by an operator.
  const canReopen = status !== "draft" && canTransition(status, reopenTarget);
  const remainingGov = Math.max(0, (d.order?.government_fee_cents ?? 0) - d.refundedGov);
  const remainingSvc = Math.max(0, (d.order?.service_fee_cents ?? 0) - d.refundedSvc);
  const canRefund = isAdmin && Boolean(d.order && d.capturedPayment) && remainingGov + remainingSvc > 0;
  const staffOptions = [...d.staff.values()].filter((s) => s.active || s.id === filing.assigned_to);

  const primary: ReactNode[] = [];

  if (status === "ready_for_review") {
    primary.push(
      <ActionBlock key="ready" title="Mark ready to file" description="The details and authorization check out.">
        <ActionForm action={markReadyAction} submitLabel="Mark ready to file" variant="primary" pendingLabel="Saving...">
          {hidden}
          <Field label="Note" htmlFor="ready-note" optional>
            <Input id="ready-note" name="note" maxLength={1000} />
          </Field>
        </ActionForm>
      </ActionBlock>,
    );
  }
  if (status === "ready_to_file") {
    primary.push(
      <ActionBlock key="start" title="Start filing" description="Marks the filing in progress while you work on the state site.">
        <ActionForm action={startFilingAction} submitLabel="Start filing" variant="primary" pendingLabel="Starting...">
          {hidden}
        </ActionForm>
      </ActionBlock>,
    );
  }
  if (status === "ready_to_file" || status === "in_progress") {
    primary.push(
      <ActionBlock key="submitted" title="Mark submitted" description="Record the state's confirmation number. The customer is emailed.">
        <ActionForm action={markSubmittedAction} submitLabel="Mark submitted" variant={status === "in_progress" ? "primary" : "secondary"} pendingLabel="Saving...">
          {hidden}
          <Field label="State confirmation number" htmlFor="sub-conf">
            <Input id="sub-conf" name="confirmationNumber" required maxLength={100} autoComplete="off" className="font-mono" />
          </Field>
          <Field label="Submitted on" htmlFor="sub-date" hint="Today records the current time.">
            <Input id="sub-date" name="submittedDate" type="date" required defaultValue={today} max={today} />
          </Field>
          <Field label="Note" htmlFor="sub-note" optional>
            <Textarea id="sub-note" name="note" maxLength={1000} className="min-h-20" />
          </Field>
        </ActionForm>
      </ActionBlock>,
    );
  }
  if (status === "submitted") {
    primary.push(
      <ActionBlock key="accepted" title="Mark accepted" description="The state approved the filing. If a receipt is already uploaded, the filing completes too.">
        <ActionForm action={markAcceptedAction} submitLabel="Mark accepted" variant="primary" pendingLabel="Saving...">
          {hidden}
          <Field label="Note" htmlFor="acc-note" optional>
            <Input id="acc-note" name="note" maxLength={1000} />
          </Field>
        </ActionForm>
      </ActionBlock>,
    );
  }
  if (status === "accepted") {
    primary.push(
      <ActionBlock
        key="complete"
        title="Complete"
        description="Requires the state receipt, filed report or acknowledgement uploaded and visible to the customer."
      >
        {d.hasReceiptDocument ? null : (
          <Notice tone="warning" className="mb-1">
            No customer-visible receipt yet. Upload it under Documents first.
          </Notice>
        )}
        <ActionForm action={completeAction} submitLabel="Complete filing" variant="primary" pendingLabel="Completing...">
          {hidden}
        </ActionForm>
      </ActionBlock>,
    );
  }
  if (canRequest) {
    primary.push(
      <ActionBlock key="request" title="Request customer information" description="Emails the customer and moves the filing to waiting on customer.">
        <ActionForm action={requestInformationAction} submitLabel="Send request" pendingLabel="Sending...">
          {hidden}
          <Field label="Message to the customer" htmlFor="req-msg">
            <Textarea id="req-msg" name="message" required minLength={3} maxLength={5000} className="min-h-24" />
          </Field>
        </ActionForm>
      </ActionBlock>,
    );
  }
  if (canReopen) {
    const label =
      status === "rejected" ? "Retry filing" : status === "completed" || status === "cancelled" ? "Reopen for review" : "Move back to review";
    primary.push(
      <ActionBlock key="reopen" title={label} description={`Moves the filing to "${ADMIN_STATUS_LABELS[reopenTarget]}".`}>
        <ActionForm action={reopenAction} submitLabel={label} pendingLabel="Saving...">
          {hidden}
          <Field label="Note" htmlFor="reopen-note" optional>
            <Input id="reopen-note" name="note" maxLength={1000} />
          </Field>
        </ActionForm>
      </ActionBlock>,
    );
  }

  const destructive: ReactNode[] = [];
  if (status === "submitted") {
    destructive.push(
      <Disclosure key="reject" summary="Mark rejected">
        <ActionForm action={markRejectedAction} submitLabel="Mark rejected" variant="danger" confirmLabel="The state rejected this filing." pendingLabel="Saving...">
          {hidden}
          <Field label="Rejection reason" htmlFor="rej-reason" hint="Sent to the customer.">
            <Textarea id="rej-reason" name="reason" required minLength={3} maxLength={1000} className="min-h-20" />
          </Field>
        </ActionForm>
      </Disclosure>,
    );
  }
  if (canTransition(status, "cancelled")) {
    destructive.push(
      <Disclosure key="cancel" summary="Cancel filing">
        <ActionForm action={cancelAction} submitLabel="Cancel filing" variant="danger" confirmLabel="Cancel this filing and email the customer." pendingLabel="Cancelling...">
          {hidden}
          <Field label="Reason" htmlFor="cancel-reason" hint="Sent to the customer.">
            <Textarea id="cancel-reason" name="reason" required minLength={3} maxLength={1000} className="min-h-20" />
          </Field>
        </ActionForm>
      </Disclosure>,
    );
  }
  if (canRefund) {
    destructive.push(
      <Disclosure key="refund" summary="Refund (admin)">
        <p className="mb-3 text-sm text-muted">
          Already refunded: government fee {money(d.refundedGov)}, service fee {money(d.refundedSvc)}. Remaining: {money(remainingGov)} and{" "}
          {money(remainingSvc)}.
        </p>
        <ActionForm action={refundAction} submitLabel="Issue refund" variant="danger" confirmLabel="Refund these amounts to the customer's card." pendingLabel="Refunding...">
          {hidden}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Government fee ($)" htmlFor="ref-gov">
              <Input id="ref-gov" name="governmentFee" inputMode="decimal" defaultValue={centsToDollarsInput(remainingGov)} className="tnum" />
            </Field>
            <Field label="Service fee ($)" htmlFor="ref-svc">
              <Input id="ref-svc" name="serviceFee" inputMode="decimal" defaultValue={centsToDollarsInput(remainingSvc)} className="tnum" />
            </Field>
          </div>
          <Field label="Reason" htmlFor="ref-reason">
            <Textarea id="ref-reason" name="reason" required minLength={3} maxLength={1000} className="min-h-20" />
          </Field>
        </ActionForm>
      </Disclosure>,
    );
  }

  const next = OPERATOR_NEXT_ACTION[status];
  const idle = next === "No action";

  return (
    <>
      <section aria-labelledby="actions-title" className="rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
        <div
          className={cn(
            "relative rounded-t-[var(--radius-surface)] border-b px-5 py-4",
            idle ? "border-border/70 bg-bg" : "border-highlight/40 bg-highlight-soft",
          )}
        >
          {idle ? null : <span aria-hidden className="absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-highlight-strong" />}
          <p className={cn("text-xs font-semibold", idle ? "text-muted" : "text-highlight-fg")}>{idle ? "No action needed" : "Next step"}</p>
          <h2 id="actions-title" className="mt-0.5 text-[20px] font-semibold leading-snug text-fg">
            {idle ? ADMIN_STATUS_LABELS[status] : next}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Status: {ADMIN_STATUS_LABELS[status]}. Only actions valid for this status are shown.
          </p>
        </div>
        <div className="divide-y divide-border/70">
          {primary.length ? primary : <p className="px-5 py-4 text-sm text-muted">No status actions available.</p>}
        </div>
        {destructive.length ? (
          <div className="grid gap-2 rounded-b-[var(--radius-surface)] border-t border-border/70 bg-bg/60 px-5 py-4">
            <p className="text-xs font-semibold text-muted">Other actions</p>
            {destructive}
          </div>
        ) : null}
      </section>
      <Panel title="Assigned operator">
        <ActionForm action={assignAction} submitLabel="Save assignment" pendingLabel="Saving..." resetOnSuccess={false}>
          {hidden}
          <Field label="Operator" htmlFor="assignee">
            <Select id="assignee" name="assignee" defaultValue={filing.assigned_to ?? ""}>
              <option value="">Unassigned</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {staffLabel(s)} ({s.active ? s.role : "inactive"})
                </option>
              ))}
            </Select>
          </Field>
        </ActionForm>
      </Panel>
    </>
  );
}

function ActionBlock({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 px-5 py-4">
      <div className="grid gap-0.5">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-[var(--radius-control)] border border-border bg-surface open:border-danger/30">
      <summary className="flex min-h-11 cursor-pointer select-none list-none items-center justify-between gap-2 rounded-[var(--radius-control)] px-3.5 text-sm font-semibold text-danger [&::-webkit-details-marker]:hidden">
        {summary}
        <CaretDown size={14} weight="bold" className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-border px-3.5 py-3.5">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Customer + business
// ---------------------------------------------------------------------------

function CustomerPanel({ customer, userId }: { customer: ProfileEntry | null; userId: string }) {
  return (
    <Panel id="customer" title="Customer">
      <KeyValues
        items={[
          {
            term: "Email",
            value: customer?.email ? (
              <a className={tableLink} href={`mailto:${customer.email}`}>
                {customer.email}
              </a>
            ) : (
              "Unknown"
            ),
          },
          { term: "Name", value: customer?.fullName || <span className="text-muted">Not provided</span> },
          { term: "Phone", value: customer?.phone || <span className="text-muted">Not provided</span> },
          { term: "Customer ID", value: <span className="font-mono text-xs">{userId}</span> },
        ]}
      />
    </Panel>
  );
}

function addressLine(a: AddressRow): string {
  if (a.crop_name) return `${a.crop_name} (commercial registered office provider)${a.county ? `, ${a.county} County` : ""}`;
  const base = formatAddress({
    line1: a.line1 ?? "",
    line2: a.line2 ?? "",
    city: a.city ?? "",
    region: a.region ?? "",
    postal_code: a.postal_code ?? "",
  });
  return a.county ? `${base}, ${a.county} County` : base;
}

function BusinessPanel({ d }: { d: FilingDetail }) {
  const b = d.business;
  if (!b) {
    return (
      <Panel id="business" title="Business">
        <EmptyRow>Business record not found.</EmptyRow>
      </Panel>
    );
  }
  const addr = (kind: string) => d.addresses.find((a) => a.kind === kind);
  const governors = d.owners.filter((o) => o.role_kind !== "officer").map((o) => ({ name: o.full_name, title: o.title }));
  const officers = d.owners.filter((o) => o.role_kind !== "governor").map((o) => ({ name: o.full_name, title: o.title }));
  const addressValue = (kind: string) => {
    const a = addr(kind);
    return a ? addressLine(a) : <span className="text-muted">Not on file</span>;
  };
  return (
    <Panel id="business" title="Business" description="The customer's business profile. The filing uses the submitted information below.">
      <KeyValues
        items={[
          { term: "Legal name", value: <span className="font-medium">{b.legal_name}</span> },
          { term: "Entity type", value: isEntityType(b.entity_type) ? ENTITY_TYPE_LABELS[b.entity_type] : b.entity_type },
          { term: "Entity number", value: b.state_entity_number ? <span className="font-mono">{b.state_entity_number}</span> : <span className="text-muted">Not provided</span> },
          { term: "Formed", value: b.formation_date ? formatDate(b.formation_date) : <span className="text-muted">Unknown</span> },
          { term: "Domestic or foreign", value: b.is_foreign ? `Foreign (formed in ${b.home_jurisdiction ?? "unknown"})` : "Domestic" },
          { term: "Not-for-profit", value: b.is_nonprofit ? "Yes" : "No" },
          { term: "Standing", value: `${humanize(b.standing)} (source: ${humanize(b.standing_source)})` },
          { term: "Principal office", value: addressValue("principal_office") },
          { term: "Registered office", value: addressValue("registered_office") },
          { term: "Mailing address", value: addressValue("mailing") },
          { term: "Governors", value: <PeopleList people={governors} /> },
          { term: "Officers", value: <PeopleList people={officers} /> },
        ]}
      />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

function AuthorizationPanel({ d }: { d: FilingDetail }) {
  const a = d.authorization;
  return (
    <Panel id="authorization" title="Authorization">
      {!a ? (
        <Notice tone="danger" title="No authorization recorded">
          Do not file without the customer&apos;s recorded authorization.
        </Notice>
      ) : (
        <div className="grid gap-4">
          {d.answersChangedSinceAuthorization ? (
            <Notice tone="warning" role="alert" title="Answers changed after authorization">
              The current answers no longer match the snapshot the customer authorized. Ask the customer to review and authorize again before filing.
            </Notice>
          ) : null}
          <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-accent/20 bg-accent-soft/60 px-4 py-3">
            <ShieldCheck size={22} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <p className="text-sm text-fg">
              <span className="font-semibold">
                Signed by {a.signer_name}, {a.signer_title}
              </span>
              <span className="block text-muted">Recorded {formatDateTime(a.created_at)}</span>
            </p>
          </div>
          <KeyValues
            items={[
              { term: "Terms version", value: <span className="font-mono text-xs">{a.terms_version}</span> },
              {
                term: "Answers hash",
                value: (
                  <span className="break-all font-mono text-xs" title={a.answers_sha256}>
                    {a.answers_sha256}
                  </span>
                ),
              },
              ...(d.authorizationCount > 1 ? [{ term: "History", value: `${d.authorizationCount} authorizations recorded. Showing the latest.` }] : []),
            ]}
          />
          <details className="group">
            <summary className="inline-flex min-h-11 cursor-pointer select-none list-none items-center gap-2 rounded-[var(--radius-control)] text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
              <CaretDown size={14} weight="bold" className="-rotate-90 transition-transform group-open:rotate-0" aria-hidden />
              Full authorization text
            </summary>
            <p className="max-w-[70ch] whitespace-pre-wrap rounded-[var(--radius-control)] border border-border bg-bg p-4 text-sm leading-relaxed text-fg">
              {a.authorization_text}
            </p>
          </details>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

function PaymentPanel({ d }: { d: FilingDetail }) {
  const { order } = d;
  return (
    <Panel id="payment" title="Payment and refunds">
      {!order ? (
        <EmptyRow>No order yet. The customer has not checked out.</EmptyRow>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-start">
            <dl className="tnum grid gap-2 rounded-[var(--radius-control)] border border-border bg-bg px-4 py-3.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Government fee</dt>
                <dd className="text-fg">{money(order.government_fee_cents)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Service fee</dt>
                <dd className="text-fg">{money(order.service_fee_cents)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border-strong pt-2">
                <dt className="font-semibold text-fg">Total</dt>
                <dd className="font-display text-lg font-semibold text-fg">{money(order.total_cents)}</dd>
              </div>
            </dl>
            <KeyValues
              items={[
                { term: "Order status", value: <PaymentStatusBadge status={order.status} /> },
                { term: "Payment mode", value: humanize(order.payment_mode) },
                { term: "Paid", value: order.paid_at ? formatDateTime(order.paid_at) : <span className="text-muted">Not paid</span> },
                {
                  term: "Refunded",
                  value: (
                    <span className="tnum">
                      Government {money(d.refundedGov)} · Service {money(d.refundedSvc)}
                    </span>
                  ),
                },
              ]}
            />
          </div>
          {d.payments.some((p) => p.requires_review) ? (
            <Notice tone="danger" role="alert" title="A payment needs review">
              {d.payments
                .filter((p) => p.requires_review)
                .map((p) => p.review_reason || "Flagged by the payment processor.")
                .join(" ")}
            </Notice>
          ) : null}
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-fg">Payment attempts</h3>
            <TableScroll variant="inset">
              <Table className="min-w-[44rem]">
                <THead>
                  <tr>
                    <TH>Payment</TH>
                    <TH>Status</TH>
                    <TH>Provider</TH>
                    <TH className="text-right">Amount</TH>
                    <TH className="text-right">Refunded</TH>
                    <TH>Created</TH>
                    <TH>Receipt</TH>
                  </tr>
                </THead>
                <tbody>
                  {d.payments.map((p) => (
                    <TR key={p.id}>
                      <TD className="font-mono text-xs">{shortId(p.id)}</TD>
                      <TD>
                        <div className="grid justify-items-start gap-1">
                          <PaymentStatusBadge status={p.status} />
                          {p.requires_review ? <span className="text-xs font-semibold text-danger">Needs review</span> : null}
                          {p.failure_reason ? <span className="text-xs text-muted">{p.failure_reason}</span> : null}
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {humanize(p.provider)} <span className="text-muted">({p.mode})</span>
                      </TD>
                      <TD className="tnum text-right">{money(p.amount_cents)}</TD>
                      <TD className="tnum text-right">{money(p.amount_refunded_cents)}</TD>
                      <TD className="tnum whitespace-nowrap">{formatDateTime(p.created_at)}</TD>
                      <TD>
                        {p.receipt_url ? (
                          <a className={tableLink} href={p.receipt_url} target="_blank" rel="noopener noreferrer">
                            Receipt
                          </a>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                  {!d.payments.length ? (
                    <TR>
                      <TD colSpan={7} className="text-muted">
                        No payment attempts.
                      </TD>
                    </TR>
                  ) : null}
                </tbody>
              </Table>
            </TableScroll>
          </div>
          {d.refunds.length ? (
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold text-fg">Refunds</h3>
              <TableScroll variant="inset">
                <Table className="min-w-[44rem]">
                  <THead>
                    <tr>
                      <TH>Refund</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Government</TH>
                      <TH className="text-right">Service</TH>
                      <TH className="text-right">Total</TH>
                      <TH>Reason</TH>
                      <TH>Requested</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {d.refunds.map((r) => (
                      <TR key={r.id}>
                        <TD className="font-mono text-xs">{shortId(r.id)}</TD>
                        <TD>
                          <StatusPill status={r.status} />
                        </TD>
                        <TD className="tnum text-right">{money(r.government_fee_cents)}</TD>
                        <TD className="tnum text-right">{money(r.service_fee_cents)}</TD>
                        <TD className="tnum text-right font-semibold">{money(r.amount_cents)}</TD>
                        <TD className="max-w-64">{r.reason}</TD>
                        <TD className="tnum whitespace-nowrap">
                          {formatDateTime(r.created_at)}
                          <span className="block text-xs text-muted">{d.people.get(r.requested_by ?? "")?.email ?? ""}</span>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

function RulePanel({ d }: { d: FilingDetail }) {
  const s = d.snapshot;
  const newer = d.rule?.current_version_id && s.id && d.rule.current_version_id !== s.id;
  return (
    <Panel id="rule" title="Rule used" description="Frozen when the filing was created. Later rule versions never change this order.">
      <div className="grid gap-4">
        {newer ? (
          <Notice tone="info" title="A newer rule version exists">
            This order stays on the version below. Check the State rules page before filing if the change matters.
          </Notice>
        ) : null}
        {s.verification_status !== "verified" ? (
          <Notice tone="danger" role="alert" title="Rule is not verified">
            Unverified rules must not be sold or filed. Escalate before continuing.
          </Notice>
        ) : null}
        <KeyValues
          items={[
            { term: "Rule version ID", value: <span className="break-all font-mono text-xs">{d.filing.rule_version_id}</span> },
            { term: "Rule", value: d.rule?.rule_key ?? "Unknown" },
            { term: "Filing", value: `${s.filing_name ?? "Annual Report"}${s.form_number ? ` (${s.form_number})` : ""}` },
            { term: "Version", value: s.version ? `v${s.version}` : "Unknown" },
            { term: "Verification", value: <StatusPill status={s.verification_status ?? "unverified"} /> },
            { term: "Effective from", value: s.effective_from ? formatDate(s.effective_from) : "Unknown" },
            { term: "Last verified", value: s.last_verified_at ? formatDate(s.last_verified_at) : "Unknown" },
            { term: "State fee in rule", value: <span className="tnum">{money(s.state_fee_cents)}</span> },
            ...(s.notes ? [{ term: "Operator note", value: s.notes }] : []),
          ]}
        />
        {d.sources.length ? (
          <details className="group rounded-[var(--radius-control)] border border-border">
            <summary className="flex min-h-11 cursor-pointer select-none list-none items-center justify-between gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
              <span>
                Official sources <span className="tnum font-medium text-muted">({d.sources.length})</span>
              </span>
              <CaretDown size={14} weight="bold" className="text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="grid divide-y divide-border border-t border-border">
              {d.sources.map((src) => (
                <li key={src.id} className="grid gap-1 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a className={tableLink} href={src.url} target="_blank" rel="noopener noreferrer">
                      {src.title ?? src.url}
                    </a>
                    <span className="font-mono text-xs text-subtle">{src.fact_key}</span>
                  </div>
                  {src.quote ? <p className="text-muted">&ldquo;{src.quote}&rdquo;</p> : null}
                  <p className="text-xs text-subtle">
                    {src.publisher ? `${src.publisher} · ` : ""}Last verified {formatDate(src.last_verified_at)}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <EmptyRow>No sources recorded for this rule version.</EmptyRow>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Documents + receipts
// ---------------------------------------------------------------------------

function DocumentsPanel({ d }: { d: FilingDetail }) {
  const id = d.filing.id;
  return (
    <Panel id="documents" title="Documents and receipts">
      <div className="grid gap-5">
        {d.documents.length ? (
          <ul className="grid divide-y divide-border rounded-[var(--radius-control)] border border-border">
            {d.documents.map((doc) => (
              <li key={doc.id} className="flex items-start gap-3.5 px-4 py-3">
                <DocumentSheet title={doc.file_name} size="xs" className="mt-0.5 shadow-none" />
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <a className={`${tableLink} break-all`} href={`/api/documents/${doc.id}`}>
                      {doc.file_name}
                    </a>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-medium text-muted">{DOCUMENT_KIND_LABELS[doc.kind] ?? humanize(doc.kind)}</span>
                      {doc.visible_to_customer ? <StatusPill status="visible" tone="success" /> : <StatusPill status="internal" />}
                    </span>
                  </div>
                  <p className="tnum text-xs text-muted">
                    {(doc.size_bytes / 1024).toFixed(0)} KB · {formatDateTime(doc.created_at)}
                    {d.people.get(doc.uploaded_by ?? "")?.email ? ` · ${d.people.get(doc.uploaded_by ?? "")?.email}` : ""}
                  </p>
                  <p className="font-mono text-[11px] text-subtle" title={doc.sha256}>
                    sha256 {doc.sha256.slice(0, 12)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyRow>No documents yet.</EmptyRow>
        )}

        <div className="rounded-[var(--radius-control)] border border-dashed border-border-strong bg-bg p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
            <UploadSimple size={16} weight="bold" className="text-accent" aria-hidden />
            Upload a document
          </h3>
          <ActionForm action={uploadDocumentAction} submitLabel="Upload" pendingLabel="Uploading...">
            <input type="hidden" name="filingId" value={id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="File" htmlFor="doc-file" hint="PDF, PNG or JPEG, up to 4 MB.">
                <Input id="doc-file" name="file" type="file" required accept="application/pdf,image/png,image/jpeg" className="py-2" />
              </Field>
              <Field label="Document type" htmlFor="doc-kind">
                <Select id="doc-kind" name="kind" defaultValue="state_receipt">
                  <option value="state_receipt">State receipt</option>
                  <option value="filed_report">Filed report</option>
                  <option value="acknowledgement">Acknowledgement letter</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
            </div>
            <label htmlFor="doc-visible" className="flex min-h-11 items-start gap-2.5 text-sm text-fg">
              <Checkbox id="doc-visible" name="visibleToCustomer" defaultChecked />
              <span>Visible to the customer (required for a receipt to complete the filing)</span>
            </label>
          </ActionForm>
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-fg">Receipts</h3>
          {d.receipts.length ? (
            <ul className="grid divide-y divide-border rounded-[var(--radius-control)] border border-border">
              {d.receipts.map((r) => (
                <li key={r.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <div className="grid min-w-0 gap-0.5">
                    <p className="text-xs font-medium text-muted">Confirmation</p>
                    <p className="break-all font-mono text-[15px] font-medium text-fg">{r.confirmation_number ?? <span className="font-sans text-muted">None</span>}</p>
                    <p className="tnum text-xs text-muted">
                      State fee paid {money(r.state_fee_paid_cents)} · {r.submitted_at ? `Submitted ${formatDateTime(r.submitted_at)}` : "Submission time not recorded"}
                      {d.people.get(r.recorded_by ?? "")?.email ? ` · Recorded by ${d.people.get(r.recorded_by ?? "")?.email}` : ""}
                    </p>
                    {r.notes ? <p className="text-sm text-fg">{r.notes}</p> : null}
                  </div>
                  <div>
                    {r.document_id ? (
                      <a className={opsButton("secondary", "px-4")} href={`/api/documents/${r.document_id}`}>
                        <DownloadSimple size={16} weight="bold" aria-hidden />
                        Download
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-warning">Document missing</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow>No receipts recorded. Marking the filing submitted records one.</EmptyRow>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Messages + notes
// ---------------------------------------------------------------------------

function authorName(d: FilingDetail, authorId: string | null, authorType: string): string {
  if (authorType === "system") return "System";
  const email = d.people.get(authorId ?? "")?.email;
  if (authorType === "customer") return email ? `Customer (${email})` : "Customer";
  const s = d.staff.get(authorId ?? "");
  return s ? `${staffLabel(s)} (staff)` : email ? `${email} (staff)` : "Staff";
}

function MessagesPanel({ d }: { d: FilingDetail }) {
  return (
    <Panel id="messages" title="Messages" description="Shared with the customer in their dashboard.">
      <div className="grid gap-5">
        {d.messages.length ? (
          <ol className="grid gap-2.5">
            {d.messages.map((m) => {
              const fromCustomer = m.author_type === "customer";
              return (
                <li
                  key={m.id}
                  className={cn(
                    "max-w-[92%] rounded-[var(--radius-control)] border px-4 py-3",
                    fromCustomer ? "border-border bg-surface-2" : "justify-self-end border-accent/15 bg-accent-soft/50",
                  )}
                >
                  <p className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span className="font-semibold text-fg">{authorName(d, m.author_id, m.author_type)}</span>
                    <span className="tnum">{formatDateTime(m.created_at)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{m.body}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyRow>No messages yet.</EmptyRow>
        )}
        <ActionForm action={sendMessageAction} submitLabel="Send message" pendingLabel="Sending...">
          <input type="hidden" name="filingId" value={d.filing.id} />
          <Field label="Message" htmlFor="msg-body">
            <Textarea id="msg-body" name="body" required maxLength={5000} className="min-h-24" />
          </Field>
          <label htmlFor="msg-action" className="flex min-h-11 items-start gap-2.5 text-sm text-fg">
            <Checkbox id="msg-action" name="requiresAction" />
            <span>
              Requires customer action
              <span className="block text-muted">Emails the customer and moves the filing to waiting on customer. Otherwise the message is posted without an email.</span>
            </span>
          </label>
        </ActionForm>
      </div>
    </Panel>
  );
}

function NotesPanel({ d }: { d: FilingDetail }) {
  return (
    <Panel id="notes" title="Internal notes" description="Staff only. Never shown to the customer.">
      <div className="grid gap-5">
        <ActionForm action={addNoteAction} submitLabel="Add note" pendingLabel="Saving...">
          <input type="hidden" name="filingId" value={d.filing.id} />
          <Field label="Note" htmlFor="note-body">
            <Textarea id="note-body" name="body" required maxLength={5000} className="min-h-20" />
          </Field>
        </ActionForm>
        {d.notes.length ? (
          <ol className="grid divide-y divide-highlight/30 rounded-[var(--radius-control)] border border-highlight/40 bg-highlight-soft/40">
            {d.notes.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span className="font-semibold text-fg">{authorName(d, n.author_id, "staff")}</span>
                  <span className="tnum">{formatDateTime(n.created_at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{n.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyRow>No notes yet.</EmptyRow>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// History + audit
// ---------------------------------------------------------------------------

function statusName(status: string | null): string {
  if (!status) return "Created";
  return isFilingStatus(status) ? ADMIN_STATUS_LABELS[status] : status;
}

function actorName(d: FilingDetail, actorId: string | null, actorType: string): string {
  if (!actorId) return humanize(actorType);
  const s = d.staff.get(actorId);
  if (s) return staffLabel(s);
  return d.people.get(actorId)?.email ?? `${humanize(actorType)} ${shortId(actorId)}`;
}

function HistoryPanel({ d }: { d: FilingDetail }) {
  return (
    <Panel id="history" title="Status history" description="Every status change, including internal ones the customer does not see. Newest first.">
      {d.history.length ? (
        <ol className="grid">
          {d.history.map((h, i) => (
            <li key={h.id} className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
              {i < d.history.length - 1 ? <span aria-hidden className="absolute bottom-0 left-[9px] top-5 w-[2px] bg-border" /> : null}
              <span
                aria-hidden
                className={cn("relative mt-1 size-5 rounded-full border-[5px]", i === 0 ? "border-accent bg-surface" : "border-border-strong bg-surface")}
              />
              <div className="grid min-w-0 gap-0.5">
                <p className="text-sm text-fg">
                  {statusName(h.from_status)} <span className="text-muted">to</span> <span className="font-semibold">{statusName(h.to_status)}</span>
                  {!h.customer_visible ? (
                    <span className="ml-2 inline-flex rounded-full bg-surface-2 px-2 py-0.5 align-middle text-[11px] font-semibold text-muted">Internal</span>
                  ) : null}
                </p>
                <p className="tnum text-xs text-muted">
                  {formatDateTime(h.created_at)} · {actorName(d, h.actor_user_id, h.actor_type)}
                </p>
                {h.note ? <p className="mt-1 max-w-[70ch] text-sm text-muted">{h.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyRow>No status changes yet.</EmptyRow>
      )}
    </Panel>
  );
}

function AuditPanel({ d }: { d: FilingDetail }) {
  return (
    <Panel
      id="audit"
      title="Audit history"
      actions={
        <Link className={`${tableLink} text-sm`} href={`/admin/audit?filing=${d.filing.id}`}>
          Open in audit log
        </Link>
      }
    >
      {d.auditRows.length ? (
        <TableScroll variant="inset">
          <Table className="min-w-[40rem]">
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Action</TH>
                <TH>Actor</TH>
                <TH>Details</TH>
              </tr>
            </THead>
            <tbody>
              {d.auditRows.map((a) => (
                <TR key={a.id}>
                  <TD valign="top" className="tnum whitespace-nowrap">
                    {formatDateTime(a.created_at)}
                  </TD>
                  <TD valign="top">
                    <span className="font-mono text-xs">{a.action}</span>
                    <span className="block text-xs text-muted">
                      {a.entity_type}
                      {a.entity_id ? ` ${shortId(a.entity_id)}` : ""}
                    </span>
                  </TD>
                  <TD valign="top" className="whitespace-nowrap">
                    {actorName(d, a.actor_user_id, a.actor_type)}
                  </TD>
                  <TD valign="top">
                    <div className="flex flex-wrap items-start gap-x-4">
                      <JsonDetails label="Before" value={a.before} />
                      <JsonDetails label="After" value={a.after} />
                      <JsonDetails label="Metadata" value={a.metadata} />
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : (
        <EmptyRow>No audit entries yet.</EmptyRow>
      )}
      {d.auditRows.length >= 100 ? <p className="mt-2 text-xs text-muted">Showing the latest 100 entries.</p> : null}
    </Panel>
  );
}
