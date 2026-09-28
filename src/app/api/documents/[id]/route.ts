import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentUser, getStaff } from "@/lib/auth/session";
import { signedUrlForDocument } from "@/lib/documents/storage";

export const dynamic = "force-dynamic";

/**
 * Secure document download: authorization is enforced by row-level security (the
 * document row is read as the requesting user), then a 60-second signed URL is issued.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not found", { status: 404 });
  const { id } = await ctx.params;
  const signed = await signedUrlForDocument(id);
  if (!signed) return new NextResponse("Not found", { status: 404 });
  const staff = await getStaff();
  await audit({
    actorUserId: user.id,
    actorType: staff ? "staff" : "customer",
    action: "document.downloaded",
    entityType: "filing_document",
    entityId: id,
  }).catch(() => {});
  const res = NextResponse.redirect(signed.url, { status: 302 });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
