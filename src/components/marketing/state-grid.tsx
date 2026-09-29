import { isStateVerified, listJurisdictions } from "@/lib/compliance/registry";
import { StateDirectory } from "./state-directory";

/**
 * All 50 states + DC with an honest status. Only states with verified rules say
 * "Filing supported"; everything else is "Not yet verified", never implied otherwise.
 * Renders a filterable list (the full list works without JavaScript).
 */
export function StateGrid({ basePath, className }: { basePath: "/annual-report" | "/states"; className?: string }) {
  const items = listJurisdictions()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((j) => ({ code: j.code, name: j.name, slug: j.slug, verified: isStateVerified(j.code) }));
  return <StateDirectory items={items} basePath={basePath} className={className} />;
}
