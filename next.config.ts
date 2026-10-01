import type { NextConfig } from "next";

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();

/**
 * Content Security Policy. Next.js inlines bootstrap scripts, so script-src needs
 * 'unsafe-inline' without nonces (nonces would force every SEO page to render
 * dynamically). Everything else is locked to self + Supabase + Stripe Checkout.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/**
 * Mirrors isIndexable() in src/config/site.ts. Evaluated at build time, like the
 * NEXT_PUBLIC_* values it reads. Until indexing is explicitly allowed on production,
 * every response also says noindex in a header (robots.txt disallow-all means
 * crawlers never see the page's meta tag).
 */
const indexable = process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Receipt uploads (<= 4 MB) go through server actions; Vercel allows 4.5 MB bodies.
    serverActions: { bodySizeLimit: "4.5mb" },
    proxyClientMaxBodySize: "4.5mb",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...(indexable ? [] : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]),
      {
        // Signed, per-person or utility URLs: never indexed, whatever robots.txt says.
        source: "/(m|rs|r|reminders|outreach|unsubscribe|auth)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      { source: "/find/result", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      {
        source: "/(dashboard|admin|file|sandbox)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
