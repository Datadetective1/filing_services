import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { TILES } from "@/components/visual/us-tile-map";
import { listJurisdictions } from "@/lib/compliance/registry";

/**
 * The tile map tilted into a 3D plane, with the states whose register can be searched raised
 * and lit. Raised tiles link to that state's search page; the rest are scenery (aria-hidden),
 * because a text list of the same links always sits beside the map.
 */
export function SearchTileMap({
  links,
  active,
  className,
}: {
  /** State code to its search page. */
  links: Record<string, string>;
  /** The state this page is about, lit brightest. */
  active?: string;
  className?: string;
}) {
  const tiles = listJurisdictions()
    .filter((j) => TILES[j.code])
    .map((j) => ({ j, col: TILES[j.code][0], row: TILES[j.code][1], href: links[j.code] }))
    .sort((a, b) => a.row - b.row || a.col - b.col);

  return (
    <div className={cn("[perspective:1100px]", className)}>
      <ul
        aria-label="States you can search"
        className="grid grid-cols-11 gap-[3px] [transform:rotateX(28deg)_rotateZ(-8deg)] [transform-style:preserve-3d] sm:gap-1.5"
      >
        {tiles.map(({ j, col, row, href }) => {
          const lit = Boolean(href);
          const isActive = active === j.code;
          return (
            <li
              key={j.code}
              style={{ gridColumn: col + 1, gridRow: row + 1 }}
              className="aspect-square min-w-0 [transform-style:preserve-3d]"
              aria-hidden={lit ? undefined : true}
            >
              {lit && href ? (
                <Link
                  href={href}
                  aria-label={`Search ${j.name} businesses`}
                  className={cn(
                    "grid size-full place-items-center rounded-[6px] font-display text-[10px] font-bold leading-none tracking-wide sm:rounded-[10px] sm:text-[13px]",
                    "transition-[transform,box-shadow,background-color] duration-200 [transform:translateZ(14px)] hover:[transform:translateZ(26px)]",
                    isActive
                      ? "bg-highlight text-fg shadow-[0_18px_28px_-10px_rgb(31_90_67/0.75)]"
                      : "bg-accent text-accent-fg shadow-[0_14px_22px_-10px_rgb(31_90_67/0.8)] hover:bg-accent-hover",
                  )}
                >
                  {j.code}
                </Link>
              ) : (
                <span className="grid size-full place-items-center rounded-[6px] border border-border bg-surface/70 font-display text-[9px] font-semibold text-subtle/70 sm:rounded-[10px] sm:text-[11px]">
                  {j.code}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
