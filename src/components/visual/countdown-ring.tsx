import { cn } from "@/components/ui/cn";

/**
 * Days-until-due as a ring that fills as the date approaches (full = due).
 * `window` is how many days the ring represents; anything further out shows a
 * nearly empty ring. Past due shows a full marigold ring.
 */
export function CountdownRing({
  days,
  window = 120,
  size = 76,
  className,
  label,
}: {
  days: number;
  window?: number;
  size?: number;
  className?: string;
  /** Accessible description, e.g. "2 days until the September 30 deadline". */
  label: string;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const overdue = days < 0;
  const progress = overdue ? 1 : Math.min(1, Math.max(0.04, 1 - days / window));
  const urgent = overdue || days <= 30;
  const shown = Math.abs(days);

  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          className={urgent ? "stroke-highlight" : "stroke-accent"}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center" role="img" aria-label={label}>
        <span className="tnum font-display font-semibold leading-none text-fg" style={{ fontSize: Math.round(size * 0.3) }}>
          {shown}
        </span>
        <span className="mt-0.5 text-[11px] font-medium leading-none text-muted">
          {overdue ? (shown === 1 ? "day late" : "days late") : shown === 1 ? "day" : "days"}
        </span>
      </div>
    </div>
  );
}
