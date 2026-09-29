import type { ReactNode } from "react";
import { LogoMark } from "@/components/layout/logo";
import { cn } from "@/components/ui/cn";

/**
 * A paper receipt: a torn bottom edge and a monospaced header. Used wherever money
 * is shown as an object (pricing, order confirmation, dashboard payments).
 */
export function Receipt({
  title,
  meta,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("drop-shadow-[0_18px_28px_rgb(23_35_29/0.14)]", className)}>
      <div className="receipt-edge rounded-t-[14px] bg-surface px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-border pb-4">
          <div className="flex items-center gap-2.5">
            <LogoMark className="scale-[0.85]" />
            <div>
              <p className="font-display text-[15px] font-semibold leading-tight text-fg">{title}</p>
              {meta ? <p className="font-mono text-[11px] uppercase tracking-wider text-subtle">{meta}</p> : null}
            </div>
          </div>
        </div>
        <div className="pt-4">{children}</div>
        {footer ? <div className="mt-5 text-[13px] leading-5 text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
