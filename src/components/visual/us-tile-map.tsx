import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { isStateVerified, listJurisdictions } from "@/lib/compliance/registry";

/**
 * Tile-grid map of the 50 states and DC (the familiar approximate geographic layout,
 * 11 columns by 8 rows). Column and row are zero-based.
 */
const TILES: Record<string, [col: number, row: number]> = {
  AK: [0, 0], ME: [10, 0],
  VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7],
};

/**
 * Every jurisdiction as a linked tile. Supported states are pine; everything else is
 * muted "not yet verified". Each tile is a real link whose accessible name carries
 * the full state name and its status, in reading order (row by row). A text list
 * should always accompany the map for filtering and for small screens.
 */
export function UsTileMap({
  basePath = "/states",
  className,
  label = "Map of the 50 states and DC",
}: {
  basePath?: "/states" | "/annual-report";
  className?: string;
  label?: string;
}) {
  const tiles = listJurisdictions()
    .filter((j) => TILES[j.code])
    .map((j) => ({ j, col: TILES[j.code][0], row: TILES[j.code][1], verified: isStateVerified(j.code) }))
    .sort((a, b) => a.row - b.row || a.col - b.col);

  return (
    <ul aria-label={label} className={cn("grid grid-cols-11 gap-[3px] sm:gap-1.5 lg:gap-2", className)}>
      {tiles.map(({ j, col, row, verified }) => {
        const status = verified ? "filing supported" : "not yet verified";
        return (
          <li key={j.code} style={{ gridColumn: col + 1, gridRow: row + 1 }} className="aspect-square min-w-0">
            <Link
              href={`${basePath}/${j.slug}`}
              aria-label={`${j.name}: ${status}`}
              title={`${j.name}: ${status}`}
              className={cn(
                "relative grid size-full place-items-center rounded-[6px] font-display font-bold leading-none tracking-wide transition-[background-color,border-color,color,transform,box-shadow] duration-150 sm:rounded-[10px]",
                "text-[10px] sm:text-[13px] lg:text-[15px]",
                verified
                  ? "bg-accent text-accent-fg shadow-[0_6px_16px_-8px_rgb(31_90_67/0.8)] hover:bg-accent-hover"
                  : "border border-border bg-surface text-subtle hover:-translate-y-px hover:border-accent/50 hover:text-fg hover:shadow-card",
              )}
            >
              {j.code}
              {verified ? (
                <span aria-hidden className="absolute right-[3px] top-[3px] size-1.5 rounded-full bg-highlight sm:right-1.5 sm:top-1.5 sm:size-2" />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Two-item key for the map. */
export function UsTileMapLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="Map key" className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-muted", className)}>
      <li className="flex items-center gap-2">
        <span aria-hidden className="relative size-4 rounded-[4px] bg-accent">
          <span className="absolute right-0.5 top-0.5 size-1 rounded-full bg-highlight" />
        </span>
        <span className="font-semibold text-fg">Filing supported</span>
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="size-4 rounded-[4px] border border-border-strong bg-surface" />
        Not yet verified
      </li>
    </ul>
  );
}
