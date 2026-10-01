import type { MetadataRoute } from "next";
import { absoluteUrl, isIndexable } from "@/config/site";

/** Previews and staging are never crawled. Production allows public pages only. */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
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
