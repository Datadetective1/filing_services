import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { JurisdictionDef } from "@/lib/compliance/types";
import { verifiedText } from "@/lib/compliance/view";

/** Agency details from our jurisdiction directory, clearly labeled as a listing, not requirements. */
export function DirectoryListing({ j }: { j: JurisdictionDef }) {
  return (
    <div className="grid content-start gap-5 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-fg">Official agency</h2>
        <p className="text-sm text-muted">Directory listing. This is contact information only, not a summary of requirements.</p>
      </div>
      <dl className="grid gap-4 text-[15px]">
        <div className="grid gap-1">
          <dt className="text-sm text-muted">Agency</dt>
          <dd className="text-fg">{j.agency.name}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-sm text-muted">Official website</dt>
          <dd>
            <a
              href={j.agency.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 break-all font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              {new URL(j.agency.websiteUrl).host}
              <ArrowUpRight size={15} aria-hidden className="shrink-0" />
              <span className="sr-only">(opens the official website in a new tab)</span>
            </a>
          </dd>
        </div>
        {j.agency.businessSearchUrl ? (
          <div className="grid gap-1">
            <dt className="text-sm text-muted">Business search</dt>
            <dd>
              <a
                href={j.agency.businessSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
              >
                Search {j.name} business records
                <ArrowUpRight size={15} aria-hidden className="shrink-0" />
                <span className="sr-only">(opens the official website in a new tab)</span>
              </a>
            </dd>
          </div>
        ) : null}
        {j.agency.periodicReportName ? (
          <div className="grid gap-1">
            <dt className="text-sm text-muted">Report name used on the agency&apos;s website</dt>
            <dd className="text-fg">{j.agency.periodicReportName}</dd>
          </div>
        ) : null}
      </dl>
      {j.agency.lastVerifiedAt ? (
        <p className="tnum text-xs text-subtle">Directory entry last checked {verifiedText(j.agency.lastVerifiedAt)}.</p>
      ) : null}
    </div>
  );
}
