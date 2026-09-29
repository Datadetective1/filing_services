import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** A titled page section with an optional description and trailing action. */
export function DashboardSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("grid scroll-mt-6 content-start gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="grid gap-1">
          <h2 id={`${id}-title`} className="text-xl font-semibold text-fg sm:text-[22px]">
            {title}
          </h2>
          {description ? <p className="max-w-[62ch] text-[15px] leading-6 text-muted">{description}</p> : null}
        </div>
        {action ? <div className="text-sm">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Understated text link used for secondary navigation inside the dashboard. */
export const quietLinkClass =
  "inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent underline decoration-accent/30 decoration-2 underline-offset-4 transition-colors hover:decoration-accent sm:min-h-0";

/** "Back" link above a page title. */
export const backLinkClass =
  "group inline-flex min-h-11 items-center gap-1.5 self-start rounded-full pr-3 text-sm font-medium text-muted transition-colors hover:text-fg sm:min-h-9";

/** Dashed placeholder for a section with nothing in it yet. */
export function QuietEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-[var(--radius-surface)] border border-dashed border-border-strong bg-surface/50 px-5 py-6 text-[15px] leading-6 text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
