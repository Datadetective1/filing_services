import type { FaqItem } from "@/lib/compliance/types";
import { registrySource, registryStates, type RegistrySourceInfo } from "@/lib/registry/sources";
import { pickableStateByCode } from "@/lib/services/state-services";

/**
 * Public "business search" pages: one per state whose official register we can search live
 * (see lib/registry/sources.ts). Pennsylvania keeps its older guide at
 * /pennsylvania/business-search, so it isn't repeated here.
 *
 * Same rules as the guides: the register is the state's, Filewell is a private service, and
 * a search result is never a statement about standing or filing history.
 */

export interface BusinessSearchState {
  code: string;
  name: string;
  slug: string;
  path: string;
  source: RegistrySourceInfo;
}

/** Where each searchable state's page lives. Pennsylvania points at its existing guide. */
export function businessSearchPath(code: string): string | null {
  const c = code.toUpperCase();
  if (c === "PA") return "/pennsylvania/business-search";
  const s = pickableStateByCode(c);
  return s && registrySource(c) ? `/business-search/${s.slug}` : null;
}

/** Every state with a live register search, A to Z, Pennsylvania included. */
export function businessSearchStates(): BusinessSearchState[] {
  return registryStates().flatMap((source) => {
    const s = pickableStateByCode(source.code);
    const path = businessSearchPath(source.code);
    return s && path ? [{ code: s.code, name: s.name, slug: s.slug, path, source }] : [];
  });
}

/** States that get a page under /business-search/[state]. */
export function businessSearchPageStates(): BusinessSearchState[] {
  return businessSearchStates().filter((s) => s.code !== "PA");
}

export function businessSearchStateBySlug(slug: string): BusinessSearchState | null {
  return businessSearchPageStates().find((s) => s.slug === slug) ?? null;
}

/** The register's own name for itself, without the "updated ..." tail. */
function registerName(source: RegistrySourceInfo): string {
  return source.source.split(", published on")[0];
}

export function businessSearchTitle(s: BusinessSearchState): string {
  return `${s.name} Business Search: Look Up an LLC or Corporation by Name`;
}

export function businessSearchDescription(s: BusinessSearchState): string {
  return `Search ${s.name}'s business register by name or ${s.source.numberLabel}: entity type, formation date and address on record. Free, no account needed.`;
}

export function businessSearchFaq(s: BusinessSearchState): FaqItem[] {
  const tx = s.code === "TX";
  return [
    {
      q: `Is this the official ${s.name} business search?`,
      a: `No. Filewell is a private service, not a state agency. We search the ${registerName(s.source)}, as published by the state for public use.`,
    },
    {
      q: "Does the search show whether a business is in good standing?",
      a: tx
        ? "No. This record comes from the Texas Comptroller's franchise tax data and doesn't show standing or filing history."
        : "No. The public register doesn't show standing or whether this year's report was filed, so we never say a business is active, compliant or behind.",
    },
    {
      q: "Why can't I find a business?",
      a: `Try fewer words, or search by ${s.source.numberLabel}. A business registered very recently may not appear yet. You can still enter its details by hand.`,
    },
    {
      q: "What happens after I pick a business?",
      a: "You see what it may need to file, when, and what it costs. If you order with us, we fill in what the register shows so you only check it.",
    },
  ];
}
