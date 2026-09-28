import { DownloadSimple, FileText } from "@phosphor-icons/react/dist/ssr";
import type { DocumentView } from "@/app/(app)/dashboard/_lib/data";
import { DOCUMENT_KIND_LABELS, formatBytes, formatTimestampDate } from "./format";

/**
 * Documents shared with the customer. Downloads go through /api/documents/[id],
 * which checks access as the signed-in user and issues a short-lived link.
 */
export function DocumentList({ documents }: { documents: DocumentView[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
      {documents.map((doc) => {
        const kind = DOCUMENT_KIND_LABELS[doc.kind] ?? "Document";
        const size = formatBytes(doc.sizeBytes);
        return (
          <li key={doc.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-content-center rounded-[var(--radius-control)] bg-surface-2 text-muted"
            >
              <FileText size={20} />
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="font-medium text-fg">{kind}</p>
              <p className="truncate text-sm text-muted" title={doc.fileName}>
                {doc.fileName}
              </p>
              <p className="tnum text-xs text-subtle">
                Added {formatTimestampDate(doc.createdAt)}
                {size ? ` · ${size}` : ""}
              </p>
            </div>
            <a
              href={`/api/documents/${doc.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              <DownloadSimple size={16} weight="bold" aria-hidden />
              Download
              <span className="sr-only">
                {kind}, {doc.fileName}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
