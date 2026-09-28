import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
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
    <p className="text-sm text-muted">
      {label}:{" "}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
      >
        {agency}
        <ArrowSquareOut size={14} weight="bold" aria-hidden />
        <span className="sr-only">(opens the government website in a new tab)</span>
      </a>
      {lastVerifiedAt ? <span className="text-subtle"> · Last reviewed {verifiedText(lastVerifiedAt)}</span> : null}
    </p>
  );
}
