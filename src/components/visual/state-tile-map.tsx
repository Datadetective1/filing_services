import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { TILES } from "./us-tile-map";

/**
 * The tile map for the "pick your state" pages. Every tile opens that state's services page.
 * With `active`, the chosen state lifts and glows; with `tilt`, the whole map leans back in
 * 3D. A tilted map is decoration (the picker beside it is the control), so it is hidden from
 * assistive technology and not focusable.
 */
export function StateTileMap({
  states,
  active,
  tilt = false,
  className,
}: {
  states: { code: string; name: string; slug: string }[];
  active?: string;
  tilt?: boolean;
  className?: string;
}) {
  const tiles = states
    .filter((s) => TILES[s.code])
    .map((s) => ({ ...s, col: TILES[s.code][0], row: TILES[s.code][1] }))
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const grid = (
    <ul
      aria-label={tilt ? undefined : "Map of the 50 states and DC"}
      className={cn(
        "grid grid-cols-11 gap-[3px] sm:gap-1.5",
        tilt && "[transform:rotateX(48deg)_rotateZ(-10deg)] [transform-style:preserve-3d]",
      )}
    >
      {tiles.map((t) => {
        const on = t.code === active;
        const tileClass = cn(
          "relative grid size-full place-items-center rounded-[5px] font-display text-[9px] font-bold leading-none tracking-wide sm:rounded-[8px] sm:text-[12px]",
          "transition-[background-color,border-color,color,transform,box-shadow] duration-200",
          tilt
            ? on
              ? "bg-highlight text-highlight-fg [transform:translateZ(26px)] shadow-[0_0_0_2px_rgb(242_178_58/0.45),0_18px_30px_-6px_rgb(242_178_58/0.65)]"
              : "border border-white/10 bg-white/[0.06] text-ink-muted shadow-[0_4px_0_rgb(0_0_0/0.35)]"
            : on
              ? "bg-highlight text-highlight-fg"
              : "border border-border bg-surface text-muted hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-accent-fg hover:shadow-[0_10px_20px_-10px_rgb(31_90_67/0.8)]",
        );
        return (
          <li key={t.code} style={{ gridColumn: t.col + 1, gridRow: t.row + 1 }} className="aspect-square min-w-0">
            {tilt ? (
              <span className={tileClass}>{t.code}</span>
            ) : (
              <Link href={`/services/${t.slug}`} aria-label={t.name} title={t.name} className={tileClass}>
                {t.code}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (!tilt) return <div className={className}>{grid}</div>;
  return (
    <div aria-hidden className={cn("[perspective:1100px]", className)}>
      {grid}
    </div>
  );
}
