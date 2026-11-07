import { Buildings } from "@phosphor-icons/react/dist/ssr";
import type { JurisdictionDef } from "@/lib/compliance/types";
import { verifiedText } from "@/lib/compliance/view";

/** Agency details from our jurisdiction directory, clearly labeled as a listing, not requirements. No links out. */
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
            The state agency that handles these filings. This is not a summary of requirements.
          </p>
        </div>
      </div>

      <dl className="grid gap-4 text-[15px]">
        <div className="grid gap-1">
          <dt className="text-[13px] font-medium text-muted">Agency</dt>
          <dd className="font-medium leading-snug text-fg">{j.agency.name}</dd>
        </div>
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
