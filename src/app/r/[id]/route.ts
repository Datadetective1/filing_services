import { NextResponse, type NextRequest } from "next/server";
import { trackServer } from "@/lib/analytics/server";
import { safeNextPath } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Email CTA redirect: records the click, then sends the user to an internal path only. */
export async function GET(request: NextRequest, ctx: RouteContext<"/r/[id]">) {
  const { id } = await ctx.params;
  const to = safeNextPath(request.nextUrl.searchParams.get("to"), "/dashboard");
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    try {
      const db = createAdminClient();
      const { data } = await db
        .from("notifications")
        .update({ clicked_at: new Date().toISOString() })
        .eq("id", id)
        .is("clicked_at", null)
        .select("user_id, template_key")
        .maybeSingle();
      if (data && String(data.template_key).startsWith("reminder_")) {
        await trackServer("reminder_clicked", { userId: data.user_id, properties: { template: data.template_key } });
      }
    } catch {
      // Tracking never blocks the redirect.
    }
  }
  return NextResponse.redirect(new URL(to, request.nextUrl.origin), { status: 302 });
}
