import { Info } from "@phosphor-icons/react/dist/ssr";
import { site } from "@/config/site";
import { cn } from "@/components/ui/cn";

/**
 * The disclaimer every selling surface carries, plus the reminder that a business
 * can always file directly with the state for the state fee alone.
 */
export function DisclaimerNote({
  stateName,
  filingUrl,
  className,
}: {
  stateName?: string;
  filingUrl?: string;
  className?: string;
}) {
  const host = filingUrl ? new URL(filingUrl).host : null;
  return (
    <div className={cn("flex gap-3 rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3.5 text-sm leading-6 text-muted", className)}>
      <Info size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
      <p>
        <strong className="font-semibold text-fg">{site.disclaimer}</strong>{" "}
        {stateName && filingUrl && host ? (
          <>
            You can file directly with {stateName} at{" "}
            <a href={filingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent">
              {host}
            </a>{" "}
            and pay only the state fee.
          </>
        ) : (
          <>You can always file directly with your state and pay only the state fee.</>
        )}
      </p>
    </div>
  );
}
