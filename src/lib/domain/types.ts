export const ENTITY_TYPES = [
  "llc",
  "corporation",
  "nonprofit_corporation",
  "lp",
  "llp",
  "electing_partnership",
  "professional_association",
  "business_trust",
  "other",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  llc: "LLC",
  corporation: "Corporation",
  nonprofit_corporation: "Nonprofit corporation",
  lp: "Limited partnership (LP / LLLP)",
  llp: "Limited liability partnership (LLP)",
  electing_partnership: "Electing partnership",
  professional_association: "Professional association",
  business_trust: "Business trust",
  other: "Other",
};

/** Short, URL-safe slugs used by SEO pages (e.g. /annual-report/pennsylvania/llc). */
export const ENTITY_TYPE_SLUGS: Record<EntityType, string> = {
  llc: "llc",
  corporation: "corporation",
  nonprofit_corporation: "nonprofit-corporation",
  lp: "limited-partnership",
  llp: "limited-liability-partnership",
  electing_partnership: "electing-partnership",
  professional_association: "professional-association",
  business_trust: "business-trust",
  other: "other",
};

export function entityTypeFromSlug(slug: string): EntityType | null {
  const hit = (Object.entries(ENTITY_TYPE_SLUGS) as [EntityType, string][]).find(
    ([, s]) => s === slug,
  );
  return hit ? hit[0] : null;
}

export function isEntityType(value: unknown): value is EntityType {
  return typeof value === "string" && (ENTITY_TYPES as readonly string[]).includes(value);
}

export type VerificationStatus = "verified" | "unverified";
export type SupportLevel = "unsupported" | "manual" | "assisted" | "automated";

export type ISODate = string; // YYYY-MM-DD
