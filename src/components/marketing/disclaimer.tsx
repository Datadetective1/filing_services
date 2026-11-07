import { Info } from "@phosphor-icons/react/dist/ssr";
import { site } from "@/config/site";
import { cn } from "@/components/ui/cn";

/** The disclaimer every selling surface carries: a private service, not the state. */
export function DisclaimerNote({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3.5 text-sm leading-6 text-muted", className)}>
      <Info size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
      <p>
        <strong className="font-semibold text-fg">{site.disclaimer}</strong>
      </p>
    </div>
  );
}
