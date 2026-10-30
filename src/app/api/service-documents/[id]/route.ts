import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentUser, getStaff } from "@/lib/auth/session";
import { signedUrlForServiceDocument } from "@/lib/registered-agent/operations";

export const dynamic = "force-dynamic";

/**
 * Registered agent document download. Row-level security decides access (the row is read as
 * the requesting user); then a 60-second signed URL is issued. Every download is audited.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/service-documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not found", { status: 404 });
  const { id } = await ctx.params;
  const signed = await signedUrlForServiceDocument(id);
  if (!signed) return new NextResponse("Not found", { status: 404 });
  const staff = await getStaff();
  await audit({
    actorUserId: user.id,
    actorType: staff ? "staff" : "customer",
    action: "service_document.downloaded",
    entityType: "service_document",
    entityId: id,
  }).catch(() => {});
  const res = NextResponse.redirect(signed.url, { status: 302 });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
