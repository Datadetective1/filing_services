import type { EntityType } from "@/lib/domain/types";

const NOUNS: Record<EntityType, string> = {
  llc: "LLC",
  corporation: "corporation",
  nonprofit_corporation: "nonprofit corporation",
  lp: "limited partnership",
  llp: "limited liability partnership",
  electing_partnership: "electing partnership",
  professional_association: "professional association",
  business_trust: "business trust",
  other: "business of this type",
};

/** "a Pennsylvania LLC", "an Ohio corporation": for use mid-sentence. */
export function entityPhrase(stateName: string, entityType: EntityType): string {
  const article = /^[AEIOU]/i.test(stateName) ? "an" : "a";
  return `${article} ${stateName} ${NOUNS[entityType]}`;
}
