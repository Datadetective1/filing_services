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
          <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-fg">
            {title}
          </h2>
          {description ? <p className="max-w-[65ch] text-sm text-muted">{description}</p> : null}
        </div>
        {action ? <div className="text-sm">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Understated text link used for secondary navigation inside the dashboard. */
export const quietLinkClass =
  "inline-flex min-h-11 items-center gap-1 font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg sm:min-h-0";

/** "Back" link above a page title. */
export const backLinkClass =
  "inline-flex min-h-11 items-center gap-1.5 self-start rounded-[var(--radius-control)] text-sm text-muted hover:text-fg sm:min-h-0";
