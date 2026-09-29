import type { EntityType } from "@/lib/domain/types";

/**
 * Presentation copy for entity types on public pages (titles and sentences).
 * These are wording choices only. Every compliance fact comes from the rules registry.
 */
export const ENTITY_COPY: Record<EntityType, { title: string; singular: string; plural: string }> = {
  llc: { title: "LLC", singular: "LLC", plural: "LLCs" },
  corporation: { title: "Corporation", singular: "business corporation", plural: "business corporations" },
  nonprofit_corporation: {
    title: "Nonprofit Corporation",
    singular: "nonprofit corporation",
    plural: "nonprofit corporations",
  },
  lp: { title: "Limited Partnership", singular: "limited partnership", plural: "limited partnerships" },
  llp: {
    title: "Limited Liability Partnership",
    singular: "limited liability partnership",
    plural: "limited liability partnerships",
  },
  electing_partnership: { title: "Electing Partnership", singular: "electing partnership", plural: "electing partnerships" },
  professional_association: {
    title: "Professional Association",
    singular: "professional association",
    plural: "professional associations",
  },
  business_trust: { title: "Business Trust", singular: "business trust", plural: "business trusts" },
  other: { title: "Other Entity", singular: "entity", plural: "entities" },
};

/** "a" or "an" for a noun phrase, by sound ("an LLC", "a business trust"). */
export function article(noun: string): "a" | "an" {
  return /^(llc|llp|lp|[aeio])/i.test(noun) ? "an" : "a";
}

/** Join words as "a, b and c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
