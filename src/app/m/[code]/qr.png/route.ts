import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { landingUrl, verifyLandingCode } from "@/lib/outreach/mail-codes";

export const dynamic = "force-dynamic";

/**
 * QR image for a postcard: encodes that card's own signed landing URL. Only valid codes get
 * an image, so this can't be used to make QR codes for arbitrary links. 600 px wide so a
 * 0.9 in print size stays above 300 dpi.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/m/[code]/qr.png">) {
  const { code } = await ctx.params;
  if (!verifyLandingCode(code)) return new NextResponse("Not found", { status: 404 });
  const png = await QRCode.toBuffer(landingUrl(code), { type: "png", width: 600, margin: 1, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable", "X-Robots-Tag": "noindex" },
  });
}
