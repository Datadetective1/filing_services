import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Email link landing: handles both the PKCE `code` flow and the `token_hash` flow
 * (email confirmation, password recovery), then redirects to a same-origin path.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"), "/dashboard");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
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
