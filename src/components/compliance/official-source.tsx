import { ArrowSquareOut, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { verifiedText } from "@/lib/compliance/view";

/** Citation of the official government source a fact came from. */
export function OfficialSource({
  href,
  agency,
  lastVerifiedAt,
  label = "Official source",
}: {
  href: string;
  agency: string;
  lastVerifiedAt?: string | null;
  label?: string;
}) {
  return (
    <p className="flex items-start gap-2 text-sm leading-6 text-muted">
      <SealCheck size={17} weight="fill" aria-hidden className="mt-[3px] shrink-0 text-accent" />
      <span>
        {label}:{" "}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-fg underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-fg"
        >
          {agency}
          <ArrowSquareOut size={13} weight="bold" aria-hidden className="ml-1 inline align-[-1px]" />
          <span className="sr-only"> (opens the government website in a new tab)</span>
        </a>
        {lastVerifiedAt ? <span className="tnum text-subtle"> · Last reviewed {verifiedText(lastVerifiedAt)}</span> : null}
      </span>
    </p>
  );
}
