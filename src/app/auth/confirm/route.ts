import { NextResponse, type NextRequest } from "next/server";
import { clearAfterAuth, pickAfterAuth, readAfterAuth } from "@/lib/auth/after-auth";
import { safeNextPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Email link landing (email confirmation, password recovery). Only the PKCE `code`
 * flow is accepted: the code is bound to a verifier cookie set in the requesting
 * browser, so a link crafted by someone else cannot sign this browser into their
 * account (a `token_hash` verified on GET would allow that login-CSRF/session swap).
 *
 * Where the visitor was headed (`next`, or the target remembered at sign-up) is kept
 * when the exchange fails too, so signing in with the password picks up the same order.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = pickAfterAuth(safeNextPath(url.searchParams.get("next"), "/dashboard"), await readAfterAuth());
  const code = url.searchParams.get("code");
  const supabase = await createClient();

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const dest = request.nextUrl.clone();
  dest.search = "";
  if (!ok) {
    dest.pathname = "/login";
    dest.searchParams.set("error", "link");
    if (next !== "/dashboard" && next !== "/reset-password") dest.searchParams.set("next", next);
    return NextResponse.redirect(dest);
  }
  await clearAfterAuth();
  const target = new URL(next, request.nextUrl.origin);
  return NextResponse.redirect(target);
}
