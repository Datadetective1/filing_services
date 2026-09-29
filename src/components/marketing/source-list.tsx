import { ArrowSquareOut, CaretDown, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { verifiedText } from "@/lib/compliance/view";
import { plainDashes, type SourceGroup } from "@/lib/seo/content";

/**
 * Official sources, one row each, with the review date. The verbatim excerpts each
 * fact was checked against sit behind a disclosure so the list stays scannable.
 */
export function SourceList({ groups }: { groups: SourceGroup[] }) {
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
      {groups.map((g, i) => (
        <li key={g.url} className="grid gap-3 p-4 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-x-4 sm:p-5">
          <span
            aria-hidden
            className="tnum grid size-8 place-items-center rounded-full bg-accent-soft font-display text-[13px] font-bold text-accent-soft-fg max-sm:hidden"
          >
            {i + 1}
          </span>
          <div className="grid min-w-0 gap-1.5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <a
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1.5 font-semibold leading-snug text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg [overflow-wrap:anywhere]"
              >
                <span>{g.title}</span>
                <ArrowSquareOut size={14} weight="bold" aria-hidden className="mt-1 shrink-0" />
                <span className="sr-only">(opens the official website in a new tab)</span>
              </a>
              <p className="tnum flex shrink-0 items-center gap-1 text-[12px] font-medium text-subtle">
                <SealCheck size={13} weight="fill" aria-hidden className="text-accent" />
                Last verified {verifiedText(g.lastVerifiedAt)}
              </p>
            </div>
            <p className="text-[14px] text-muted">{g.publisher}</p>
            <details className="group mt-1">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full text-[13px] font-semibold text-accent hover:text-accent-hover [&::-webkit-details-marker]:hidden">
                {g.quotes.length === 1 ? "What we checked" : `What we checked (${g.quotes.length} excerpts)`}
                <CaretDown size={13} weight="bold" aria-hidden className="transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-2 grid gap-2">
                {g.quotes.map((q) => (
                  <li key={q}>
                    <blockquote className="rounded-[var(--radius-control)] border border-border bg-surface-2/60 px-3.5 py-2.5 text-[14px] leading-6 text-muted">
                      &ldquo;{plainDashes(q)}&rdquo;
                    </blockquote>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </li>
      ))}
    </ol>
  );
}
