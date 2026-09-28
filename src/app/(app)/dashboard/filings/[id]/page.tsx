import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PencilSimple, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { getJurisdiction } from "@/lib/compliance/registry";
import { daysBetween, describeDaysRemaining, formatLongDate, isISODate, todayInTimeZone } from "@/lib/domain/dates";
import { CUSTOMER_STATUS_DESCRIPTIONS, FILED_STATUSES, TERMINAL_STATUSES } from "@/lib/domain/filing-status";
import { FilingStatusBadge } from "@/components/ui/badge";
import { Card, Container, Facts } from "@/components/ui/surface";
import { OfficialSource } from "@/components/compliance/official-source";
import { AnswersSummary } from "@/components/dashboard/answers-summary";
import { DocumentList } from "@/components/dashboard/document-list";
import { formatTimestamp, formatTimestampDate, safeHttpsUrl } from "@/components/dashboard/format";
import { MessageThread } from "@/components/dashboard/message-thread";
import { NextStepCard } from "@/components/dashboard/next-step-card";
import { PaymentSummary } from "@/components/dashboard/payment-summary";
import { ReplyForm } from "@/components/dashboard/reply-form";
import { FileDirectlyNote } from "@/components/dashboard/requirement-actions";
import { backLinkClass, DashboardSection, quietLinkClass } from "@/components/dashboard/section";
import { StatusTimeline } from "@/components/dashboard/status-timeline";
import { businessHref, FILE_STEPS, isCustomerEditable } from "@/components/dashboard/steps";
import { replyToFilingAction } from "../../actions";
import { loadFilingDetail } from "../../_lib/data";

export const metadata: Metadata = {
  title: "Filing",
  robots: { index: false, follow: false },
};

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

  return (
    <Container className="grid gap-8 py-8 sm:py-12">
      <div className="grid gap-4">
        <Link
          href={business ? businessHref(business.id) : "/dashboard"}
          className={backLinkClass}
        >
          <ArrowLeft size={16} aria-hidden />
          {business ? business.legalName : "All businesses"}
        </Link>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">{title}</h1>
            <FilingStatusBadge status={filing.status} />
          </div>
          <p className="max-w-[65ch] text-[15px] text-muted">{CUSTOMER_STATUS_DESCRIPTIONS[filing.status]}</p>
        </div>
      </div>

      <NextStepCard
        filing={{
          id: filing.id,
          status: filing.status,
          isComplete: filing.isComplete,
          authorized: filing.authorized,
          orderStatus: order?.status ?? filing.orderStatus,
        }}
        hasDocuments={documents.length > 0}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <div className="grid content-start gap-10">
          {showDocuments ? (
            <DashboardSection
              id="documents"
              title="Documents and receipts"
              description="Keep these with your business records."
            >
              {receipts.length > 0 ? (
                <Card className="grid gap-4 p-5 sm:p-6">
                  {receipts.map((r) => (
                    <Facts
                      key={r.id}
                      items={[
                        {
                          term: "State confirmation number",
                          value: r.confirmationNumber ? (
                            <span className="tnum font-medium">{r.confirmationNumber}</span>
                          ) : (
                            <span className="text-subtle">Not available</span>
                          ),
                        },
                        {
                          term: "Submitted",
                          value: (
                            <time dateTime={r.submittedAt ?? r.createdAt} className="tnum">
                              {formatTimestamp(r.submittedAt ?? r.createdAt)}
                            </time>
                          ),
                        },
                      ]}
                    />
                  ))}
                </Card>
              ) : null}
              {documents.length > 0 ? (
                <DocumentList documents={documents} />
              ) : (
                <p className="rounded-[var(--radius-surface)] border border-dashed border-border-strong px-4 py-6 text-sm text-muted">
                  Your filed report and the state&apos;s receipt will appear here once we have them.
                </p>
              )}
            </DashboardSection>
          ) : null}

          <DashboardSection
            id="messages"
            title="Messages"
            description="Questions about this filing? Write to our team here."
          >
            <MessageThread messages={messages} />
            {filing.status !== "refunded" ? (
              <Card className="p-5 sm:p-6">
                <ReplyForm action={replyToFilingAction.bind(null, filing.id)} />
              </Card>
            ) : null}
          </DashboardSection>

          <DashboardSection
            id="details"
            title="Filing details"
            description="The information we use to prepare your report."
            action={
              editable ? (
                <Link href={FILE_STEPS.details(filing.id)} className={quietLinkClass}>
                  <PencilSimple size={16} aria-hidden />
                  Edit details
                </Link>
              ) : null
            }
          >
            <Card className="p-5 sm:p-6">
              {filing.schema ? (
                <AnswersSummary schema={filing.schema} answers={filing.answers} />
              ) : (
                <p className="text-sm text-muted">Details aren&apos;t available for this filing.</p>
              )}
            </Card>
          </DashboardSection>

          <DashboardSection id="authorization" title="Authorization">
            <Card className="flex items-start gap-3 p-5 sm:p-6">
              <ShieldCheck
                size={22}
                weight={authorization ? "fill" : "regular"}
                className={authorization ? "mt-0.5 shrink-0 text-accent" : "mt-0.5 shrink-0 text-subtle"}
                aria-hidden
              />
              {authorization ? (
                <div className="grid gap-1 text-[15px]">
                  <p className="text-fg">
                    Signed by <span className="font-medium">{authorization.signerName}</span>, {authorization.signerTitle}
                  </p>
                  <p className="tnum text-sm text-muted">
                    <time dateTime={authorization.createdAt}>{formatTimestamp(authorization.createdAt)}</time>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    You authorized us to prepare and submit this report on the business&apos;s behalf using the details above.
                  </p>
                </div>
              ) : (
                <div className="grid gap-1 text-[15px]">
                  <p className="text-fg">Not authorized yet</p>
                  <p className="text-sm text-muted">
                    Before we can file, you review the details and confirm you&apos;re authorized to act for the business.
                  </p>
                </div>
              )}
            </Card>
          </DashboardSection>
        </div>

        <aside className="grid content-start gap-6" aria-label="Filing summary">
          <Card className="grid gap-4 p-5">
            <h2 className="text-base font-semibold tracking-tight text-fg">Filing</h2>
            <dl className="grid gap-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted">Report year</dt>
                <dd className="tnum text-fg">{filing.periodYear}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted">Due date</dt>
                <dd className="tnum text-right text-fg">{validDue ? formatLongDate(filing.dueDate) : "Not available"}</dd>
              </div>
              {daysLeft !== null && !isClosed ? (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">Time left</dt>
                  <dd className={daysLeft < 0 ? "tnum font-medium text-warning" : "tnum text-fg"}>
                    {describeDaysRemaining(daysLeft)}
                  </dd>
                </div>
              ) : null}
              {formNumber ? (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">State form</dt>
                  <dd className="text-fg">{formNumber}</dd>
                </div>
              ) : null}
              {filing.confirmationNumber ? (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">Confirmation</dt>
                  <dd className="tnum break-all text-right text-fg">{filing.confirmationNumber}</dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted">Started</dt>
                <dd className="tnum text-fg">{formatTimestampDate(filing.createdAt)}</dd>
              </div>
            </dl>
            {validDue ? (
              <p className="border-t border-border pt-4 text-sm text-muted">
                Based on the {agency}&apos;s published requirements, the {filing.periodYear} report is due by{" "}
                {formatLongDate(filing.dueDate)}.
              </p>
            ) : null}
            {officialInfoUrl ? <OfficialSource href={officialInfoUrl} agency={agency} lastVerifiedAt={lastVerifiedAt} /> : null}
          </Card>

          <Card className="grid gap-4 p-5">
            <h2 className="text-base font-semibold tracking-tight text-fg">Payment</h2>
            {order ? (
              <PaymentSummary order={order} payments={payments} refunds={refunds} stateName={stateName} />
            ) : (
              <div className="grid gap-3">
                <p className="text-sm text-muted">
                  Not ordered yet. Before you pay, you&apos;ll see the government filing fee and our service fee listed
                  separately.
                </p>
                {business ? <FileDirectlyNote business={business} /> : null}
              </div>
            )}
          </Card>

          <Card className="grid gap-4 p-5">
            <h2 className="text-base font-semibold tracking-tight text-fg">Status history</h2>
            <StatusTimeline entries={timeline} startedAt={filing.createdAt} />
            <p className="text-xs text-subtle">Times shown in Eastern time.</p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
