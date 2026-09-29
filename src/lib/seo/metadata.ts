import type { Metadata } from "next";
import { isIndexable, site } from "@/config/site";

/**
 * Page metadata for public pages: title, description, canonical URL and Open Graph.
 * Relative paths resolve against `metadataBase` set in the root layout.
 *
 * `noindex` is for pages that must never be indexed (unverified states). Indexable
 * pages omit `robots` so the root layout's environment check (production only) wins.
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  absoluteTitle?: boolean;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      title: absoluteTitle ? title : `${title} | ${site.name}`,
      description,
      url: path,
    },
    twitter: { card: "summary_large_image", title, description },
    ...(noindex ? { robots: { index: false, follow: isIndexable() } } : {}),
  };
}
