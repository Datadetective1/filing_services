import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/components/ui/cn";
import { PHOTOS, type PhotoKey } from "@/lib/media/photos";

/**
 * A locally stored photograph cropped by its container. The container sets the
 * aspect ratio per breakpoint (pass `className`, e.g. "aspect-[4/5] lg:aspect-auto");
 * the photo's focus point keeps the subject in frame at every crop.
 */
export function Photo({
  photo,
  className,
  imgClassName,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority = false,
  rounded = true,
  focus,
  focusWide,
  decorative = false,
}: {
  photo: PhotoKey;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  rounded?: boolean;
  /** Override the library focus point for this placement. */
  focus?: string;
  focusWide?: string;
  /** Purely atmospheric use (text nearby already says it all): empty alt. */
  decorative?: boolean;
}) {
  const p = PHOTOS[photo];
  const f = focus ?? p.focus;
  const fw = focusWide ?? ("focusWide" in p ? (p.focusWide as string) : undefined) ?? f;
  const style = { "--focus": f, "--focus-wide": fw } as CSSProperties;
  // cn() does not merge utilities, so only add `relative` when the caller hasn't positioned it.
  const positioned = /(^|\s)(absolute|fixed|sticky)(\s|$)/.test(className ?? "");
  return (
    <div
      className={cn(
        "overflow-hidden bg-surface-3",
        !positioned && "relative",
        rounded && "rounded-[var(--radius-photo)]",
        className,
      )}
      style={style}
    >
      <Image
        src={p.src}
        alt={decorative ? "" : p.alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        className={cn("object-cover object-[var(--focus)] lg:object-[var(--focus-wide)]", imgClassName)}
      />
    </div>
  );
}
