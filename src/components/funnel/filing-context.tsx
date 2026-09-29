/** Two-line context for the filing being worked on, shown above each step's heading. */
export function FilingContext({
  businessName,
  stateName,
  filingName,
  periodYear,
}: {
  businessName: string;
  stateName: string;
  filingName: string;
  periodYear: number;
}) {
  return (
    <p className="flex items-start gap-2.5 text-sm leading-5 [overflow-wrap:anywhere]">
      <span aria-hidden className="relative mt-0.5 inline-block h-[17px] w-[14px] shrink-0 rounded-[2.5px] border border-border-strong bg-surface">
        <span className="absolute right-[-1px] top-[-1px] size-[5px] rounded-bl-[2px] bg-highlight" />
        <span className="absolute left-[2.5px] top-[7px] h-px w-[7px] bg-border-strong" />
        <span className="absolute left-[2.5px] top-[10px] h-px w-[5px] bg-border-strong" />
      </span>
      <span className="grid min-w-0">
        <span className="font-semibold text-fg">{businessName}</span>
        <span className="sr-only">, </span>
        <span className="text-muted">
          {stateName} {filingName} <span className="tnum">{periodYear}</span>
        </span>
      </span>
    </p>
  );
}
