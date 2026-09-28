import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { isStateVerified, listJurisdictions, RULES } from "@/lib/compliance/registry";
import { ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { LEGAL_LAST_UPDATED, LEGAL_PAGES } from "@/lib/seo/legal";

/**
 * Only indexable pages. Unverified state pages are noindex and deliberately left out,
 * as are signed-in, admin, checkout and utility routes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const verifiedRules = RULES.filter((r) => r.verificationStatus === "verified");
  const latest = verifiedRules.reduce<string | null>((max, r) => (!max || r.lastVerifiedAt > max ? r.lastVerifiedAt : max), null);
  const rulesUpdated = latest ? new Date(`${latest}T00:00:00Z`) : undefined;
  const verifiedStates = listJurisdictions().filter((j) => isStateVerified(j.code));

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: rulesUpdated, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/annual-report"), lastModified: rulesUpdated, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/states"), lastModified: rulesUpdated, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/pricing"), changeFrequency: "monthly", priority: 0.7 },
  ];

  for (const j of verifiedStates) {
    const stateRules = verifiedRules.filter((r) => r.stateCode === j.code);
    const stateLatest = stateRules.reduce((max, r) => (r.lastVerifiedAt > max ? r.lastVerifiedAt : max), "");
    const lastModified = stateLatest ? new Date(`${stateLatest}T00:00:00Z`) : undefined;
    entries.push(
      { url: absoluteUrl(`/annual-report/${j.slug}`), lastModified, changeFrequency: "weekly", priority: 0.9 },
      { url: absoluteUrl(`/states/${j.slug}`), lastModified, changeFrequency: "monthly", priority: 0.6 },
      ...stateRules.map((r) => ({
        url: absoluteUrl(`/annual-report/${j.slug}/${ENTITY_TYPE_SLUGS[r.entityType]}`),
        lastModified: new Date(`${r.lastVerifiedAt}T00:00:00Z`),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
    );
  }

  const legalUpdated = new Date(`${LEGAL_LAST_UPDATED}T00:00:00Z`);
  for (const page of LEGAL_PAGES) {
    entries.push({ url: absoluteUrl(page.path), lastModified: legalUpdated, changeFrequency: "yearly", priority: 0.2 });
  }

  return entries;
}
