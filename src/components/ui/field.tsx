import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const control =
  "block w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[15px] text-fg placeholder:text-subtle transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:bg-surface-2 disabled:text-muted aria-[invalid=true]:border-danger";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-11 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm text-muted">
      {children}
    </p>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-sm font-medium text-danger">
      {children}
    </p>
  );
}

/** Label above, control, hint, then error below. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? <span className="ml-1 font-normal text-subtle">(optional)</span> : null}
      </Label>
      {children}
      {hint ? <FieldHint id={`${htmlFor}-hint`}>{hint}</FieldHint> : null}
      <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
    </div>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn("mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--accent)]", className)}
      {...props}
    />
  );
}
