import type { MetadataRoute } from "next";
import { absoluteUrl, isIndexable } from "@/config/site";

const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

/** Previews and staging are never crawled. Production allows public pages only. */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Cloudflare's Content Signals: fine to index and to quote in AI answers, not to train on.
      // AI search crawlers are allowed through this same rule; none is blocked.
      other: { "Content-Signal": CONTENT_SIGNAL },
      // Private, per-person or signed URLs. Public pages that must not be indexed (login,
      // /find) stay crawlable so crawlers can read their noindex directive.
      disallow: [
        "/admin",
        "/dashboard",
        "/file",
        "/api/",
        "/sandbox",
        "/auth/",
        "/r/",
        "/rs/",
        "/m/",
        "/unsubscribe",
        "/outreach/",
        "/reminders/",
        "/find/result",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
