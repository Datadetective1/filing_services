import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** One section of a long state or entity guide: a modest heading, an optional lede, then content. */
export function GuideSection({
  id,
  title,
  lede,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("grid scroll-mt-24 content-start gap-6", className)}>
      <div className="grid max-w-[46rem] gap-3">
        <h2 id={`${id}-title`} className="text-[27px] font-semibold leading-[1.1] text-fg text-balance sm:text-[34px]">
          {title}
        </h2>
        {lede ? <div className="text-[16px] leading-7 text-muted sm:text-[17px]">{lede}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Body copy block for guide sections: readable measure, calm color. */
export function GuideText({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid max-w-[68ch] gap-4 text-[16px] leading-7 text-muted", className)}>{children}</div>;
}
