import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import { verifiedText } from "@/lib/compliance/view";

/**
 * Citation of the official government source a fact came from. Plain text, no link:
 * pages never send a visitor off to the state's own filing site.
 */
export function OfficialSource({
  agency,
  lastVerifiedAt,
  label = "Official source",
}: {
  agency: string;
  lastVerifiedAt?: string | null;
  label?: string;
}) {
  return (
    <p className="flex items-start gap-2 text-sm leading-6 text-muted">
      <SealCheck size={17} weight="fill" aria-hidden className="mt-[3px] shrink-0 text-accent" />
      <span>
        {label}: <span className="font-semibold text-fg">{agency}</span>
        {lastVerifiedAt ? <span className="tnum text-subtle"> · Last reviewed {verifiedText(lastVerifiedAt)}</span> : null}
      </span>
    </p>
  );
}
