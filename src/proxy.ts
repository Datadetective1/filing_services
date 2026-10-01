import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canonicalRedirectUrl } from "@/config/environments";
import { CANONICAL_PRODUCTION_URL, isProductionEnvironment } from "@/config/site";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  classifyTouch,
  mergeTouch,
  parseAttribution,
  serializeAttribution,
} from "@/lib/analytics/attribution";

const PRIVATE_PREFIXES = ["/admin", "/dashboard", "/file/", "/api/", "/sandbox", "/auth/"];

/**
 * First/last-touch attribution for public page loads (GET documents only). First-party,
 * no personal data; skipped when the browser sends Global Privacy Control.
 */
function withAttribution(request: NextRequest, response: NextResponse): NextResponse {
  try {
    if (request.method !== "GET") return response;
    const path = request.nextUrl.pathname;
    if (PRIVATE_PREFIXES.some((p) => path.startsWith(p))) return response;
    const dest = request.headers.get("sec-fetch-dest");
    const accept = request.headers.get("accept") ?? "";
    if (dest ? dest !== "document" : !accept.includes("text/html")) return response;
    if (request.headers.has("next-router-prefetch") || request.headers.get("rsc") === "1") return response;
    if (request.headers.get("sec-gpc") === "1") return response;

    const host = (request.headers.get("host") ?? request.nextUrl.host).toLowerCase();
    const selfHosts = [host, new URL(CANONICAL_PRODUCTION_URL).hostname, "getfilewell.com"];
    const today = new Date().toISOString().slice(0, 10);
    const touch = classifyTouch({ url: request.nextUrl, referrer: request.headers.get("referer"), selfHosts, today });
    const existing = parseAttribution(request.cookies.get(ATTRIBUTION_COOKIE)?.value);
    const merged = mergeTouch(existing, touch);
    if (!merged || merged === existing) return response;
    response.cookies.set(ATTRIBUTION_COOKIE, serializeAttribution(merged), {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: ATTRIBUTION_MAX_AGE,
    });
  } catch {
    // Attribution never breaks a page.
  }
  return response;
}

/**
 * Proxy: sends production traffic on *.vercel.app aliases to the canonical domain,
 * refreshes the Supabase session cookie and does OPTIMISTIC redirects for signed-out
 * visitors. It is not the authorization layer — every protected page, server action
 * and route handler re-checks the user (and staff role) on the server.
 */
export async function proxy(request: NextRequest) {
  const canonical = canonicalRedirectUrl({
    host: request.headers.get("host") ?? request.nextUrl.host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    production: isProductionEnvironment(),
  });
  if (canonical) return NextResponse.redirect(canonical, 308);

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return withAttribution(request, response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        if (headers) for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const needsAuth = path.startsWith("/dashboard") || path.startsWith("/admin") || path.startsWith("/file/");

  if (needsAuth && !signedIn) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  return withAttribution(request, response);
}

export const config = {
  matcher: [
    // Everything except static assets, images and webhook endpoints (which must see the raw body).
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
