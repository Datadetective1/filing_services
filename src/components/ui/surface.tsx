import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[var(--radius-surface)] border border-border bg-surface shadow-[0_1px_2px_rgb(23_35_29/0.04)]", className)}
      {...props}
    />
  );
}

export function Container({ className, ...props }: ComponentProps<"div">) {
  // cn() does not merge conflicting utilities, so only apply the default width when none is given.
  const hasWidth = /(^|\s)max-w-/.test(className ?? "");
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", hasWidth ? null : "max-w-7xl", className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="grid gap-2">
        <h1 className="text-[28px] font-semibold leading-tight text-fg sm:text-[34px]">{title}</h1>
        {description ? <p className="max-w-[62ch] text-base text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

type NoticeTone = "neutral" | "info" | "warning" | "danger" | "success";

const noticeTones: Record<NoticeTone, string> = {
  neutral: "border-border bg-surface-2 text-fg",
  info: "border-info/25 bg-info-soft text-fg",
  warning: "border-warning/30 bg-warning-soft text-fg",
  danger: "border-danger/30 bg-danger-soft text-fg",
  success: "border-accent/25 bg-accent-soft text-fg",
};

export function Notice({
  tone = "neutral",
  title,
  children,
  className,
  role,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  return (
    <div role={role} className={cn("rounded-[var(--radius-control)] border px-4 py-3.5 text-[15px]", noticeTones[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn("text-muted", title ? "mt-1" : "")}>{children}</div> : null}
    </div>
  );
}

/** Two-column facts list (term / value). Collapses to stacked on mobile. */
export function Facts({ items, className }: { items: { term: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(10rem,14rem)_1fr]", className)}>
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-[15px] text-muted">{item.term}</dt>
          <dd className="text-[15px] font-medium text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-surface)] border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-fg">{title}</p>
      {body ? <p className="mx-auto mt-1.5 max-w-md text-[15px] text-muted">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-xl font-semibold text-fg", className)}>{children}</h2>;
}
