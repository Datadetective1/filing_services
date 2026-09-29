import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { FilingStatus } from "@/lib/domain/filing-status";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { DocumentSheet, DocumentTile } from "@/components/visual/document-tile";
import type { DocumentView, ReceiptView } from "@/app/(app)/dashboard/_lib/data";
import { DOCUMENT_KIND_LABELS, formatBytes, formatTimestamp, formatTimestampDate } from "./format";

function isAccepted(status: FilingStatus | undefined): boolean {
  return status === "accepted" || status === "completed";
}

function stampFor(kind: string, status: FilingStatus | undefined): string | undefined {
  if (!isAccepted(status)) return undefined;
  if (kind === "filed_report") return "Filed";
  if (kind === "state_receipt" || kind === "acknowledgement") return "Accepted";
  return undefined;
}

/**
 * Documents shared with the customer, drawn as paper. Downloads go through
 * /api/documents/[id], which checks access as the signed-in user and issues a
 * short-lived link.
 */
export function DocumentList({
  documents,
  receipts = [],
  filingStatus,
}: {
  documents: DocumentView[];
  /** State confirmations, listed first as slips. */
  receipts?: ReceiptView[];
  filingStatus: FilingStatus;
}) {
  return (
    <ul className="grid gap-3 xl:grid-cols-2">
      {receipts.map((r) => (
        <li key={r.id} className="min-w-0">
          <ConfirmationSlip receipt={r} filingStatus={filingStatus} className="h-full" />
        </li>
      ))}
      {documents.map((doc) => {
        const kind = DOCUMENT_KIND_LABELS[doc.kind] ?? "Document";
        const size = formatBytes(doc.sizeBytes);
        return (
          <li key={doc.id} className="min-w-0">
            <DocumentTile
              className="h-full"
              title={kind}
              stamp={stampFor(doc.kind, filingStatus)}
              subtitle={
                <>
                  <span className="block truncate" title={doc.fileName}>
                    {doc.fileName}
                  </span>
                  <span className="tnum block text-[13px] text-subtle">
                    Added {formatTimestampDate(doc.createdAt)}
                    {size ? ` · ${size}` : ""}
                  </span>
                </>
              }
              action={
                <a href={`/api/documents/${doc.id}`} className={buttonClasses("secondary", "sm", "min-h-11 sm:min-h-10")}>
                  <DownloadSimple size={16} weight="bold" aria-hidden />
                  Download
                  <span className="sr-only">
                    {kind}, {doc.fileName}
                  </span>
                </a>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

/** The state's confirmation for a filing, as a slip you keep. */
export function ConfirmationSlip({
  receipt,
  filingStatus,
  className,
}: {
  receipt: ReceiptView;
  filingStatus: FilingStatus;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-5 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(23_35_29/0.04)] sm:gap-6 sm:p-6",
        className,
      )}
    >
      <DocumentSheet
        title="State confirmation"
        size="sm"
        stamp={isAccepted(filingStatus) ? "Accepted" : undefined}
        className="max-[379px]:hidden"
      />
      <dl className="grid min-w-0 gap-3">
        <div className="grid gap-1">
          <dt className="text-[13px] font-medium text-muted">State confirmation number</dt>
          <dd className="break-all font-mono text-[22px] font-semibold leading-tight tracking-wide text-fg sm:text-[26px]">
            {receipt.confirmationNumber ?? <span className="font-sans text-base font-normal text-subtle">Not available</span>}
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-[13px] font-medium text-muted">Submitted</dt>
          <dd className="text-[15px] text-fg">
            <time dateTime={receipt.submittedAt ?? receipt.createdAt} className="tnum">
              {formatTimestamp(receipt.submittedAt ?? receipt.createdAt)}
            </time>
          </dd>
        </div>
      </dl>
    </div>
  );
}
