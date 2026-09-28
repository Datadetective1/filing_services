/** One-line context for the filing being worked on, shown above each step's heading. */
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
    <p className="text-sm text-muted [overflow-wrap:anywhere]">
      <span className="font-medium text-fg">{businessName}</span>
      <span aria-hidden> · </span>
      <span className="sr-only">, </span>
      {stateName} {filingName} <span className="tnum">{periodYear}</span>
    </p>
  );
}
