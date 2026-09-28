import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Email link landing (email confirmation, password recovery). Only the PKCE `code`
 * flow is accepted: the code is bound to a verifier cookie set in the requesting
 * browser, so a link crafted by someone else cannot sign this browser into their
 * account (a `token_hash` verified on GET would allow that login-CSRF/session swap).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"), "/dashboard");
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
    return NextResponse.redirect(dest);
  }
  const target = new URL(next, request.nextUrl.origin);
  return NextResponse.redirect(target);
}
