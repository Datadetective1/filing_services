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
      disallow: ["/admin", "/dashboard", "/file", "/api/", "/sandbox", "/r/", "/unsubscribe"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
