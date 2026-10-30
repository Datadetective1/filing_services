import type { Metadata } from "next";
import { isIndexable, site } from "@/config/site";

/**
 * The shared social card (app/opengraph-image.tsx). Next replaces a parent's whole
 * `openGraph` object when a page sets its own, which drops the file-based image, so every
 * page names it explicitly.
 */
export const SOCIAL_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${site.name}: ${site.tagline}` };

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
      images: [SOCIAL_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE.url] },
    ...(noindex ? { robots: { index: false, follow: isIndexable() } } : {}),
  };
}
