import { CalendarCheck, CalendarPlus, Warning } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";

const STEPS = [
  {
    icon: CalendarPlus,
    when: "January 1, 2027",
    title: "Filing opens",
    body: "Every business that files can submit its 2027 report from this day.",
  },
  {
    icon: CalendarCheck,
    when: "June 30, Sept 30 or Dec 31",
    title: "Your due date",
    body: "Corporations by June 30, LLCs by September 30, other associations by December 31.",
  },
  {
    icon: Warning,
    when: "Six months after the due date",
    title: "Dissolution can start",
    body: "A business that hasn't filed its 2027 report can be dissolved and lose its name protection.",
  },
] as const;

/**
 * What changes with Pennsylvania reports due in 2027, as three steps on a dark band.
 * Every line restates the Department of State's annual report page, which it links.
 */
export function Pa2027Timeline({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="pa-2027-title"
      className={cn("relative overflow-hidden rounded-[var(--radius-surface)] bg-ink p-6 text-ink-fg shadow-lift sm:p-8", className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--highlight) 0%, transparent 70%)" }}
      />
      <div className="relative grid gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-highlight">New for 2027</p>
        <h2 id="pa-2027-title" className="text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">
          Pennsylvania starts enforcing annual reports
        </h2>
      </div>
      <ol className="relative mt-7 grid gap-6 md:grid-cols-3 md:gap-4">
        <span aria-hidden className="absolute left-[19px] top-10 bottom-10 w-px bg-gradient-to-b from-highlight/70 via-ink-muted/40 to-highlight/70 md:left-10 md:right-10 md:top-[19px] md:bottom-auto md:h-px md:w-auto md:bg-gradient-to-r" />
        {STEPS.map(({ icon: Icon, when, title, body }, i) => (
          <li key={title} className="relative grid grid-cols-[40px_1fr] content-start gap-4 md:grid-cols-1 md:gap-3">
            <span
              className={cn(
                "relative z-10 grid size-10 place-items-center rounded-full ring-4 ring-ink",
                i === 2 ? "bg-highlight text-highlight-fg" : "bg-ink-2 text-highlight",
              )}
            >
              <Icon size={20} weight="fill" aria-hidden />
            </span>
            <div className="grid gap-1">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{when}</p>
              <p className="font-display text-lg font-semibold">{title}</p>
              <p className="text-[15px] leading-6 text-ink-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="relative mt-7 text-sm text-ink-muted">
        Source: <span className="font-semibold text-ink-fg">Pennsylvania Department of State, Annual Reports</span>. Reports due in 2025 and 2026 aren&apos;t covered by this rule.
      </p>
    </section>
  );
}
