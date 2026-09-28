import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { verifiedText } from "@/lib/compliance/view";
import { plainDashes, type SourceGroup } from "@/lib/seo/content";

/** Official sources with the short excerpt each fact was taken from and the review date. */
export function SourceList({ groups }: { groups: SourceGroup[] }) {
  return (
    <ol className="grid gap-4">
      {groups.map((g) => (
        <li key={g.url} className="rounded-[var(--radius-surface)] border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <a
              href={g.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1.5 font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              <span>{g.title}</span>
              <ArrowSquareOut size={14} weight="bold" aria-hidden className="mt-1 shrink-0" />
              <span className="sr-only">(opens the official website in a new tab)</span>
            </a>
            <p className="shrink-0 text-xs text-subtle">Last verified {verifiedText(g.lastVerifiedAt)}</p>
          </div>
          <p className="mt-1 text-sm text-muted">{g.publisher}</p>
          <ul className="mt-3 grid gap-2">
            {g.quotes.map((q) => (
              <li key={q}>
                <blockquote className="border-l-2 border-border-strong pl-3 text-sm leading-6 text-muted">
                  &ldquo;{plainDashes(q)}&rdquo;
                </blockquote>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
