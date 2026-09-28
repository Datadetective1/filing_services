import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Container } from "@/components/ui/surface";

/** Page section with consistent vertical rhythm. `band` gives a full-width surface background. */
export function Section({
  id,
  labelledBy,
  band = false,
  className,
  containerClassName,
  children,
}: {
  id?: string;
  labelledBy?: string;
  band?: boolean;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("py-14 sm:py-20", band && "border-y border-border bg-surface", className)}
    >
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  id,
  title,
  lede,
  className,
  as: Tag = "h2",
}: {
  id?: string;
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("grid max-w-2xl gap-3", className)}>
      <Tag id={id} className="text-2xl font-semibold tracking-tight text-fg text-balance sm:text-[32px] sm:leading-tight">
        {title}
      </Tag>
      {lede ? <p className="text-base leading-relaxed text-muted text-pretty sm:text-[17px]">{lede}</p> : null}
    </div>
  );
}

/** Top-of-page intro for inner pages: optional breadcrumbs, H1 and a short lede. */
export function PageIntro({
  breadcrumbs,
  title,
  lede,
  children,
  className,
}: {
  breadcrumbs?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border", className)}>
      <Container className="grid gap-5 py-10 sm:py-14">
        {breadcrumbs}
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-fg text-balance sm:text-[44px] sm:leading-[1.1]">
          {title}
        </h1>
        {lede ? <div className="max-w-2xl text-base leading-relaxed text-muted text-pretty sm:text-lg">{lede}</div> : null}
        {children}
      </Container>
    </div>
  );
}

/** Long-form text styling without a typography plugin. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[68ch] text-[15px] leading-7 text-muted sm:text-base",
        "[&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-fg [&>*:first-child]:mt-0",
        "[&_h3]:mt-8 [&_h3]:font-semibold [&_h3]:text-fg",
        "[&_p]:mt-4 [&_ul]:mt-4 [&_ul]:grid [&_ul]:gap-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:mt-4 [&_ol]:grid [&_ol]:gap-2 [&_ol]:pl-5 [&_ol]:list-decimal",
        "[&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-fg",
        "[&_a]:font-medium [&_a]:text-fg [&_a]:underline [&_a]:decoration-border-strong [&_a]:underline-offset-4 [&_a:hover]:decoration-fg",
        className,
      )}
    >
      {children}
    </div>
  );
}
