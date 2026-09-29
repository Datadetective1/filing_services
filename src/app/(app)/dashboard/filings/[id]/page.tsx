import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, CaretDown, PencilSimple, Receipt as ReceiptIcon, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { getJurisdiction } from "@/lib/compliance/registry";
import { daysBetween, describeDaysRemaining, formatLongDate, isISODate, todayInTimeZone } from "@/lib/domain/dates";
import { CUSTOMER_STATUS_DESCRIPTIONS, FILED_STATUSES, TERMINAL_STATUSES } from "@/lib/domain/filing-status";
import { FilingStatusBadge } from "@/components/ui/badge";
import { Container } from "@/components/ui/surface";
import { OfficialSource } from "@/components/compliance/official-source";
import { AnswersSummary } from "@/components/dashboard/answers-summary";
import { DocumentList } from "@/components/dashboard/document-list";
import { formatTimestamp, formatTimestampDate, safeHttpsUrl } from "@/components/dashboard/format";
import { MessageThread } from "@/components/dashboard/message-thread";
import { NextStepCard } from "@/components/dashboard/next-step-card";
import { PaymentSummary } from "@/components/dashboard/payment-summary";
import { ReplyForm } from "@/components/dashboard/reply-form";
import { FileDirectlyNote } from "@/components/dashboard/requirement-actions";
import { backLinkClass, DashboardSection, QuietEmpty, quietLinkClass } from "@/components/dashboard/section";
import { StatusTimeline } from "@/components/dashboard/status-timeline";
import { businessHref, FILE_STEPS, isCustomerEditable } from "@/components/dashboard/steps";
import { replyToFilingAction } from "../../actions";
import { loadFilingDetail } from "../../_lib/data";

export const metadata: Metadata = {
  title: "Filing",
  robots: { index: false, follow: false },
};

function FactRow({ term, children, emphasis }: { term: string; children: ReactNode; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <dt className="text-muted">{term}</dt>
      <dd className={emphasis ? "tnum text-right font-semibold text-warning" : "tnum text-right font-medium text-fg"}>{children}</dd>
    </div>
  );
}

export default async function FilingPage(props: PageProps<"/dashboard/filings/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/dashboard/filings/${encodeURIComponent(id)}`);
  const detail = await loadFilingDetail(user.id, id);
  if (!detail) notFound();

  const { filing, business, timeline, authorization, order, payments, refunds, documents, receipts, messages } = detail;
  const jurisdiction = getJurisdiction(filing.stateCode);
  const stateName = jurisdiction?.name ?? filing.stateCode;
  const agency = jurisdiction?.agency.name.split(" - ")[0] ?? `${stateName} state agency`;
  const title = `${filing.periodYear} ${stateName} ${filing.filingName}`;
  const officialInfoUrl = safeHttpsUrl(filing.snapshot.official_info_url);
  const lastVerifiedAt = typeof filing.snapshot.last_verified_at === "string" ? filing.snapshot.last_verified_at : null;
  const formNumber = typeof filing.snapshot.form_number === "string" ? filing.snapshot.form_number : null;
  const editable = isCustomerEditable(filing.status);
  const isFiled = FILED_STATUSES.includes(filing.status);
  const isClosed = TERMINAL_STATUSES.includes(filing.status) || isFiled;
  const validDue = isISODate(filing.dueDate);
  const daysLeft = validDue ? daysBetween(todayInTimeZone(jurisdiction?.timezone ?? "America/New_York"), filing.dueDate) : null;
  const showDocuments = documents.length > 0 || receipts.length > 0 || filing.status === "accepted" || filing.status === "completed";
  const hasHero = filing.status !== "cancelled" && filing.status !== "refunded";
  const sectionTitles = filing.schema?.sections.map((s) => s.title) ?? [];

  return (
    <Container className="py-8 sm:py-12">
      <Link href={business ? businessHref(business.id) : "/dashboard"} className={backLinkClass}>
        <ArrowLeft size={16} weight="bold" aria-hidden className="transition-transform group-hover:-translate-x-0.5" />
        <span className="truncate">{business ? business.legalName : "All businesses"}</span>
      </Link>

      <header className="mt-4 grid gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[38px]">{title}</h1>
          <FilingStatusBadge status={filing.status} />
        </div>
        {!hasHero ? <p className="max-w-[65ch] text-[15px] text-muted">{CUSTOMER_STATUS_DESCRIPTIONS[filing.status]}</p> : null}
      </header>

      <NextStepCard
        className="mt-8"
        filing={{
          id: filing.id,
          status: filing.status,
          isComplete: filing.isComplete,
          authorized: filing.authorized,
          orderStatus: order?.status ?? filing.orderStatus,
        }}
        hasDocuments={documents.length > 0}
        daysLeft={!isClosed ? daysLeft : null}
        dueDate={validDue ? filing.dueDate : null}
        trackerDates={{
          authorized: authorization?.createdAt ?? null,
          paid: order?.paidAt ?? null,
          submitted: filing.submittedAt,
          accepted: filing.acceptedAt,
        }}
      />

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-14">
        <div className="grid min-w-0 content-start gap-12">
          {showDocuments ? (
            <DashboardSection id="documents" title="Documents and receipts" description="Keep these with your business records.">
              {documents.length > 0 || receipts.length > 0 ? (
                <DocumentList documents={documents} receipts={receipts} filingStatus={filing.status} />
              ) : null}
              {documents.length === 0 ? (
                <QuietEmpty>Your filed report and the state&apos;s receipt will appear here once we have them.</QuietEmpty>
              ) : null}
            </DashboardSection>
          ) : null}

          <DashboardSection id="messages" title="Messages" description="Questions about this filing? Write to our team here.">
            <MessageThread messages={messages} />
            {filing.status !== "refunded" ? <ReplyForm action={replyToFilingAction.bind(null, filing.id)} /> : null}
          </DashboardSection>

          <DashboardSection
            id="details"
            title="Filing details"
            description="The information we use to prepare your report."
            action={
              editable ? (
                <Link href={FILE_STEPS.details(filing.id)} className={quietLinkClass}>
                  <PencilSimple size={16} weight="bold" aria-hidden />
                  Edit details
                </Link>
              ) : null
            }
          >
            {filing.schema ? (
              <details className="group rounded-[var(--radius-surface)] border border-border bg-surface">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-surface)] px-5 py-4 transition-colors hover:bg-surface-2/60 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-semibold text-fg">{isFiled ? "What we filed" : "What we'll file"}</span>
                    {sectionTitles.length > 0 ? (
                      <span className="truncate text-sm text-muted">{sectionTitles.join(", ")}</span>
                    ) : null}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent">
                    <span className="group-open:hidden">Show</span>
                    <span className="hidden group-open:inline">Hide</span>
                    <CaretDown size={14} weight="bold" aria-hidden className="transition-transform duration-200 group-open:rotate-180" />
                  </span>
                </summary>
                <div className="border-t border-border px-5 py-5 sm:px-6 sm:py-6">
                  <AnswersSummary schema={filing.schema} answers={filing.answers} />
                </div>
              </details>
            ) : (
              <QuietEmpty>Details aren&apos;t available for this filing.</QuietEmpty>
            )}
          </DashboardSection>

          <DashboardSection id="authorization" title="Authorization">
            {authorization ? (
              <div className="grid gap-5 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-end sm:gap-8 sm:p-6">
                <div className="grid gap-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
                    <ShieldCheck size={18} weight="fill" aria-hidden />
                    Signed and authorized
                  </p>
                  <div className="grid gap-1.5">
                    <p className="break-words border-b-2 border-fg/60 pb-1.5 font-display text-[26px] italic leading-none text-fg sm:text-[30px]">
                      {authorization.signerName}
                    </p>
                    <p className="text-sm text-muted">
                      {authorization.signerTitle}
                      <span aria-hidden className="mx-1.5 text-subtle">
                        ·
                      </span>
                      <time dateTime={authorization.createdAt} className="tnum">
                        {formatTimestamp(authorization.createdAt)}
                      </time>
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted">
                  You authorized us to prepare and submit this report on the business&apos;s behalf using the details above.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-[var(--radius-surface)] border border-dashed border-border-strong bg-surface/60 p-5">
                <ShieldCheck size={22} aria-hidden className="mt-0.5 shrink-0 text-subtle" />
                <div className="grid gap-1">
                  <p className="font-semibold text-fg">Not authorized yet</p>
                  <p className="text-[15px] leading-6 text-muted">
                    Before we can file, you review the details and confirm you&apos;re authorized to act for the business.
                  </p>
                </div>
              </div>
            )}
          </DashboardSection>
        </div>

        <aside className="grid content-start gap-10" aria-label="Filing summary">
          <section aria-labelledby="payment-title" className="grid gap-4">
            <h2 id="payment-title" className="text-lg font-semibold text-fg">
              Payment
            </h2>
            {order ? (
              <PaymentSummary order={order} payments={payments} refunds={refunds} stateName={stateName} />
            ) : (
              <div className="grid gap-3 rounded-[var(--radius-surface)] border border-dashed border-border-strong bg-surface/60 p-5">
                <p className="flex items-center gap-2 font-semibold text-fg">
                  <ReceiptIcon size={20} aria-hidden className="text-subtle" />
                  Not ordered yet
                </p>
                <p className="text-sm leading-6 text-muted">
                  Before you pay, you&apos;ll see the government filing fee and our service fee listed separately.
                </p>
                {business ? <FileDirectlyNote business={business} /> : null}
              </div>
            )}
          </section>

          <section aria-labelledby="facts-title" className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5">
            <h2 id="facts-title" className="text-lg font-semibold text-fg">
              Filing
            </h2>
            <dl className="grid text-sm">
              <FactRow term="Report year">{filing.periodYear}</FactRow>
              <FactRow term="Due date">{validDue ? formatLongDate(filing.dueDate) : "Not available"}</FactRow>
              {daysLeft !== null && !isClosed ? (
                <FactRow term="Time left" emphasis={daysLeft < 0}>
                  {describeDaysRemaining(daysLeft)}
                </FactRow>
              ) : null}
              {formNumber ? <FactRow term="State form">{formNumber}</FactRow> : null}
              {filing.confirmationNumber ? (
                <FactRow term="Confirmation">
                  <span className="break-all font-mono">{filing.confirmationNumber}</span>
                </FactRow>
              ) : null}
              <FactRow term="Started">{formatTimestampDate(filing.createdAt)}</FactRow>
            </dl>
            {validDue ? (
              <p className="border-t border-border pt-3 text-sm leading-6 text-muted">
                Based on the {agency}&apos;s published requirements, the {filing.periodYear} report is due by{" "}
                {formatLongDate(filing.dueDate)}.
              </p>
            ) : null}
            {officialInfoUrl ? <OfficialSource href={officialInfoUrl} agency={agency} lastVerifiedAt={lastVerifiedAt} /> : null}
          </section>

          <section aria-labelledby="history-title" className="grid gap-4">
            <h2 id="history-title" className="text-lg font-semibold text-fg">
              Status history
            </h2>
            <div className="rounded-[var(--radius-surface)] border border-border bg-surface p-5">
              <StatusTimeline entries={timeline} startedAt={filing.createdAt} />
              <p className="mt-4 border-t border-border pt-3 text-[13px] text-subtle">Times shown in Eastern time.</p>
            </div>
          </section>
        </aside>
      </div>
    </Container>
  );
}
