import type { ReactNode } from "react";
import { Photo } from "@/components/media/photo";
import { cn } from "@/components/ui/cn";
import { Container } from "@/components/ui/surface";
import type { PhotoKey } from "@/lib/media/photos";

/**
 * Inner-page hero: headline on the left, a photograph on the right with the page's
 * status object resting on it. On phones the order is headline, status, actions, so
 * the key facts come before anything else.
 */
export function PhotoHero({
  id,
  breadcrumbs,
  eyebrow,
  title,
  lede,
  actions,
  note,
  photo,
  focus,
  focusWide,
  panel,
  className,
}: {
  id: string;
  breadcrumbs?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
  photo: PhotoKey;
  focus?: string;
  focusWide?: string;
  panel?: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("overflow-hidden", className)}>
      <Container className="grid grid-cols-1 gap-x-14 gap-y-7 pb-14 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:grid-rows-[auto_1fr] lg:pb-20 lg:pt-12">
        <div className="grid content-start gap-5 lg:col-start-1 lg:row-start-1 lg:self-end lg:pt-6">
          {breadcrumbs}
          {eyebrow}
          <h1
            id={id}
            className="max-w-[14ch] text-[40px] font-semibold leading-[1.03] tracking-[-0.03em] text-fg sm:text-[56px] lg:text-[64px]"
          >
            {title}
          </h1>
          {lede ? <div className="max-w-[44ch] text-[17px] leading-relaxed text-muted sm:text-lg">{lede}</div> : null}
        </div>

        <div className="relative lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pl-8 xl:pl-12">
          <Photo
            photo={photo}
            priority
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/5]"
            focus={focus}
            focusWide={focusWide}
          />
          {panel ? (
            <div className="relative z-10 mx-2.5 -mt-16 sm:mx-auto sm:-mt-28 sm:max-w-[27rem] lg:absolute lg:bottom-8 lg:left-0 lg:mx-0 lg:mt-0 lg:w-[23rem] xl:-left-4 xl:w-[25.5rem]">
              {panel}
            </div>
          ) : null}
        </div>

        {actions || note ? (
          <div className="grid content-start gap-5 lg:col-start-1 lg:row-start-2">
            {actions}
            {note}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
