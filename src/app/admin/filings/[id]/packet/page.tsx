import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowSquareOut, Warning } from "@phosphor-icons/react/dist/ssr";
import { opsButton } from "@/components/admin/button-classes";
import { formatDate, formatDateTime, money, opsToday } from "@/components/admin/format";
import { answerText } from "@/components/admin/intake-answers";
import { PrintButton } from "@/components/admin/print-button";
import { site } from "@/config/site";
import { getJurisdiction } from "@/lib/compliance/registry";
import { PA_URLS } from "@/lib/compliance/states/pennsylvania";
import type { IntakeField } from "@/lib/compliance/types";
import { describeDaysRemaining, daysBetween, formatLongDate } from "@/lib/domain/dates";
import { requireStaff } from "@/lib/auth/session";
import { governmentFeeFor } from "@/lib/domain/pricing";
import { formatAddress, formatRegisteredOffice, type Address, type Person, type RegisteredOffice } from "@/lib/intake/validate";
import { staffLabel } from "../../../_lib/data";
import { loadFilingDetail } from "../load";

export const metadata: Metadata = { title: "Filing packet" };

/**
 * Printable filing packet: everything the operator needs to file on the state's
 * site, in the order the state asks for it, plus the checklist and signature block.
 */
export default async function FilingPacketPage(props: PageProps<"/admin/filings/[id]/packet">) {
  const staff = await requireStaff();
  const { id } = await props.params;
  const d = await loadFilingDetail(id);
  if (!d) notFound();

  const { filing, business, snapshot, answers, authorization, order } = d;
  const today = opsToday();
  const jurisdiction = getJurisdiction(filing.state_code);
  const stateName = jurisdiction?.name ?? d.stateName;
  const filingName = snapshot.filing_name ?? "Annual Report";
  const title = `${stateName} ${filingName}${snapshot.form_number ? ` (${snapshot.form_number})` : ""} filing packet`;
  const isPA = filing.state_code === "PA";
  const searchUrl = jurisdiction?.agency.businessSearchUrl ?? (isPA ? PA_URLS.businessSearch : null);
  const agencyName = jurisdiction?.agency.name.split(" - ")[0].split(",")[0] ?? `${stateName} filing office`;

  const legalName = str(answers.legal_name) || business?.legal_name || "Not provided";
  const entityNumber = str(answers.entity_number) || business?.state_entity_number || "";
  const governors = (Array.isArray(answers.governors) ? answers.governors : []) as Person[];
  const officers = (Array.isArray(answers.principal_officers) ? answers.principal_officers : []) as Person[];
  const noticeEmail = str(answers.state_notice_email);
  const changesField = findField(d.snapshot.intake_schema?.sections.flatMap((s) => s.fields) ?? [], "changes_since_last_report");
  const changes = answers.changes_since_last_report ? (changesField ? answerText(changesField, answers.changes_since_last_report) : str(answers.changes_since_last_report)) : "";

  const governmentFeeCents =
    order?.government_fee_cents ??
    governmentFeeFor(
      { stateFeeCents: snapshot.state_fee_cents ?? 0, nonprofitStateFeeCents: snapshot.nonprofit_state_fee_cents ?? null },
      { isNonprofit: Boolean(business?.is_nonprofit) },
    );

  const assigned = filing.assigned_to ? d.staff.get(filing.assigned_to) : null;
  const signerOperator = assigned ? staffLabel(assigned) : staff.displayName || staff.email;
  const days = daysBetween(today, filing.due_date);

  return (
    <article className="packet mx-auto grid max-w-3xl gap-6 text-fg print:max-w-none print:gap-4">
      {/* Hide the console chrome when printing. */}
      <style>{`@media print { aside, nav[aria-label="Operations"] { display: none !important; } main { padding: 0 !important; } .packet section { break-inside: avoid; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/admin/filings/${filing.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft size={16} aria-hidden />
          Back to the order
        </Link>
        <PrintButton label="Print packet" />
      </div>

      <header className="grid gap-2 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-[15px] text-muted">
          {legalName} · {filing.period_year} report · Prepared {formatDateTime(new Date().toISOString())}
        </p>
        <p className="text-xs text-subtle">
          Internal working document for {site.name} staff. {site.name} is a private filing service, not a government agency.
        </p>
      </header>

      {!authorization ? (
        <Warn title="No customer authorization is recorded">Do not file. Ask the customer to review and authorize the filing first.</Warn>
      ) : null}
      {d.answersChangedSinceAuthorization ? (
        <Warn title="Answers changed after the customer authorized them">
          Do not file from this packet until the customer authorizes the current information again.
        </Warn>
      ) : null}
      {snapshot.verification_status !== "verified" ? <Warn title="This filing's rule is not verified">Escalate before filing.</Warn> : null}

      <PacketSection title="Deadline">
        <Rows
          rows={[
            ["Due date", <span key="due" className="tnum">{formatLongDate(filing.due_date)}</span>],
            ["Days remaining", <span key="days" className={days < 0 ? "tnum font-semibold text-danger" : "tnum"}>{describeDaysRemaining(days)}</span>],
          ]}
        />
      </PacketSection>

      <PacketSection title="Information to enter">
        <Rows
          rows={[
            ["Legal name", <Copyable key="name">{legalName}</Copyable>],
            [
              "Entity number",
              entityNumber ? (
                <Copyable key="num" mono>
                  {entityNumber}
                </Copyable>
              ) : searchUrl ? (
                <a key="num" href={searchUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
                  Look up on the official business search
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                "Not provided"
              ),
            ],
            ["Jurisdiction of formation", str(answers.jurisdiction_of_formation) || "Not provided"],
            ["Registered office", registeredOfficeText(answers.registered_office)],
            ["Principal office", principalOfficeText(answers.principal_office)],
            ["Governors", <PeopleLines key="gov" people={governors} />],
            ["Principal officers", <PeopleLines key="off" people={officers} emptyText="None listed" />],
            ["State notice email", noticeEmail || <span key="email" className="text-muted">Not provided (optional)</span>],
            ["Customer's note on changes", changes || <span key="chg" className="text-muted">No answer</span>],
          ]}
        />
      </PacketSection>

      <PacketSection title="State fee and official site">
        <div className="grid gap-4">
          <Rows
            rows={[
              ["Government fee to pay on the state site", <span key="fee" className="tnum text-lg font-semibold">{money(governmentFeeCents)}</span>],
              ["Official filing URL", snapshot.official_filing_url ? <span key="url" className="break-all">{snapshot.official_filing_url}</span> : "Not recorded"],
            ]}
          />
          {snapshot.official_filing_url ? (
            <a href={snapshot.official_filing_url} target="_blank" rel="noopener noreferrer" className={opsButton("primary", "w-full sm:w-auto print:hidden")}>
              Open official filing site
              <ArrowSquareOut size={18} aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </PacketSection>

      <PacketSection title="Official process">
        <div className="grid gap-4 text-[15px] leading-relaxed">
          {snapshot.filing_method_summary ? (
            <p>
              Based on the {agencyName}&apos;s published requirements: {snapshot.filing_method_summary}
            </p>
          ) : (
            <p className="text-muted">No filing method is recorded for this rule version.</p>
          )}
          {isPA ? (
            <div className="grid gap-2">
              <h3 className="text-[15px] font-semibold">Pennsylvania checklist</h3>
              <ol className="grid list-decimal gap-2 pl-5 marker:text-muted">
                <Step>
                  Log in to{" "}
                  <a href={PA_URLS.onlineFiling} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    file.dos.pa.gov
                  </a>{" "}
                  with the {site.name} Business Filing Services account.
                </Step>
                <Step>Use Business Search to find the entity{entityNumber ? ` (entity number ${entityNumber})` : " by its exact legal name"}.</Step>
                <Step>Choose &ldquo;File Annual Report&rdquo;.</Step>
                <Step>Confirm or update each field against the information in this packet.</Step>
                <Step>E-sign with the signatory and title in the signature block below.</Step>
                <Step>Pay the state fee of {money(governmentFeeCents)}.</Step>
                <Step>
                  Download the filed form and the Acknowledgement Letter immediately. The Department of State keeps them in the portal for only 60 days.
                </Step>
                <Step>Record the confirmation number and upload both documents on the order page.</Step>
              </ol>
            </div>
          ) : null}
        </div>
      </PacketSection>

      <PacketSection title="Signature block">
        <div className="grid gap-2">
          <p className="rounded-[var(--radius-control)] border border-border-strong bg-surface-2 p-3 text-[15px] leading-relaxed print:bg-white">
            Signed by: {site.name} by {signerOperator}, Authorized Representative, per customer authorization recorded{" "}
            {authorization ? formatDateTime(authorization.created_at) : "(none recorded)"}
            {authorization ? ` (signer: ${authorization.signer_name}, ${authorization.signer_title})` : ""}
          </p>
          <p className="text-xs text-muted">Signature wording pending counsel review.</p>
        </div>
      </PacketSection>

      <PacketSection title="Customer authorization">
        <Rows
          rows={[
            ["Recorded", authorization ? "Yes" : <span key="no" className="font-semibold text-danger">No</span>],
            ["Recorded at", authorization ? formatDateTime(authorization.created_at) : "Not recorded"],
            ["Signer", authorization ? `${authorization.signer_name}, ${authorization.signer_title}` : "Not recorded"],
            ["Answers hash", authorization ? <span key="hash" className="break-all font-mono text-xs">{authorization.answers_sha256}</span> : "Not recorded"],
            ["Terms version", authorization?.terms_version ?? "Not recorded"],
          ]}
        />
      </PacketSection>

      <PacketSection title="Rule">
        <Rows
          rows={[
            ["Rule version", <span key="rv" className="break-all font-mono text-xs">{filing.rule_version_id}</span>],
            ["Version", snapshot.version ? `v${snapshot.version}, effective ${formatDate(snapshot.effective_from)}` : "Unknown"],
            ["Last verified", snapshot.last_verified_at ? formatDate(snapshot.last_verified_at) : "Unknown"],
            ["Verification", snapshot.verification_status === "verified" ? "Verified" : "Not verified"],
          ]}
        />
      </PacketSection>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted">
        <Link href={`/admin/filings/${filing.id}`} className="inline-flex min-h-11 items-center gap-1.5 hover:text-fg print:hidden">
          <ArrowLeft size={16} aria-hidden />
          Back to the order
        </Link>
        <span className="tnum">Order {filing.id}</span>
      </footer>
    </article>
  );
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function findField(fields: IntakeField[], key: string): IntakeField | undefined {
  return fields.find((f) => f.key === key);
}

function registeredOfficeText(value: unknown): string {
  if (!value || typeof value !== "object") return "Not provided";
  const r = value as RegisteredOffice;
  if (r.mode === "crop") return `Commercial registered office provider: ${r.crop_name}, ${r.county} County`;
  return formatRegisteredOffice(r);
}

function principalOfficeText(value: unknown): string {
  if (!value || typeof value !== "object") return "Not provided";
  const a = value as Address;
  return a.county ? `${formatAddress(a)} (${a.county} County)` : formatAddress(a);
}

function PacketSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-4 sm:p-5 print:rounded-none print:border-x-0 print:border-b-0 print:px-0">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid divide-y divide-border text-[15px]">
      {rows.map(([term, value]) => (
        <div key={term} className="grid gap-1 py-2 first:pt-0 last:pb-0 sm:grid-cols-[14rem_1fr] sm:gap-4">
          <dt className="text-sm text-muted">{term}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Copyable({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <span className={mono ? "select-all font-mono text-[15px] font-medium" : "select-all font-medium"}>{children}</span>;
}

function PeopleLines({ people, emptyText = "None listed" }: { people: Person[]; emptyText?: string }) {
  if (!people.length) return <span className="text-muted">{emptyText}</span>;
  return (
    <ul className="grid gap-1">
      {people.map((p, i) => (
        <li key={`${p.name}-${i}`}>
          <span className="font-medium">{p.name}</span>
          <span className="text-muted">, {p.title}</span>
        </li>
      ))}
    </ul>
  );
}

function Step({ children }: { children: ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

function Warn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-[var(--radius-surface)] border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
      <Warning size={20} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <div>
        <p className="font-semibold text-fg">{title}</p>
        <p className="text-muted">{children}</p>
      </div>
    </div>
  );
}
