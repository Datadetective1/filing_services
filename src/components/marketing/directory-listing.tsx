import { ArrowUpRight, Buildings, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { JurisdictionDef } from "@/lib/compliance/types";
import { verifiedText } from "@/lib/compliance/view";

const linkRow =
  "group flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-bg px-4 py-2.5 transition-colors hover:border-accent/40 hover:bg-accent-soft/40";

/** Agency details from our jurisdiction directory, clearly labeled as a listing, not requirements. */
export function DirectoryListing({ j }: { j: JurisdictionDef }) {
  return (
    <div className="grid content-start gap-5 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-fg">
          <Buildings size={22} weight="duotone" />
        </span>
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold tracking-tight text-fg">Official agency</h2>
          <p className="text-[14px] leading-5 text-muted">
            Directory listing. This is contact information only, not a summary of requirements.
          </p>
        </div>
      </div>

      <dl className="grid gap-4 text-[15px]">
        <div className="grid gap-1">
          <dt className="text-[13px] font-medium text-muted">Agency</dt>
          <dd className="font-medium leading-snug text-fg">{j.agency.name}</dd>
        </div>
        <div className="grid gap-1.5">
          <dt className="text-[13px] font-medium text-muted">Official website</dt>
          <dd>
            <a href={j.agency.websiteUrl} target="_blank" rel="noopener noreferrer" className={linkRow}>
              <span className="min-w-0 font-semibold text-fg [overflow-wrap:anywhere]">{new URL(j.agency.websiteUrl).host}</span>
              <ArrowUpRight size={16} weight="bold" aria-hidden className="shrink-0 text-muted group-hover:text-accent" />
              <span className="sr-only">(opens the official website in a new tab)</span>
            </a>
          </dd>
        </div>
        {j.agency.businessSearchUrl ? (
          <div className="grid gap-1.5">
            <dt className="text-[13px] font-medium text-muted">Business search</dt>
            <dd>
              <a href={j.agency.businessSearchUrl} target="_blank" rel="noopener noreferrer" className={linkRow}>
                <span className="flex min-w-0 items-center gap-2 font-semibold text-fg">
                  <MagnifyingGlass size={16} weight="bold" aria-hidden className="shrink-0 text-muted" />
                  Search {j.name} business records
                </span>
                <ArrowUpRight size={16} weight="bold" aria-hidden className="shrink-0 text-muted group-hover:text-accent" />
                <span className="sr-only">(opens the official website in a new tab)</span>
              </a>
            </dd>
          </div>
        ) : null}
        {j.agency.periodicReportName ? (
          <div className="grid gap-1">
            <dt className="text-[13px] font-medium text-muted">Report name used on the agency&apos;s website</dt>
            <dd className="font-medium text-fg">{j.agency.periodicReportName}</dd>
          </div>
        ) : null}
      </dl>
      {j.agency.lastVerifiedAt ? (
        <p className="tnum border-t border-border pt-4 text-[12px] text-subtle">
          Directory entry last checked {verifiedText(j.agency.lastVerifiedAt)}.
        </p>
      ) : null}
    </div>
  );
}
