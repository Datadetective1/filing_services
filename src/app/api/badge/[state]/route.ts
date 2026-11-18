import { badgeRow, badgeSvg } from "@/lib/seo/badge";

/**
 * The annual report deadline badge image other sites embed. Built from verified rules only, so
 * an unknown or unverified state is a 404. Cached for a day at the edge; rules change rarely.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const row = badgeRow(state.replace(/\.svg$/, ""));
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(badgeSvg(row), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Robots-Tag": "noindex",
    },
  });
}
