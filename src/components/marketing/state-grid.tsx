import { isStateVerified, listJurisdictions, stateSupportLabel } from "@/lib/compliance/registry";
import { StateDirectory } from "./state-directory";

/**
 * All 50 states + DC with an honest status. States with verified rules are
 * labelled by stateSupportLabel ("Filing supported" only while sales are open); everything else is
 * "Not yet verified", never implied otherwise.
 * Renders a filterable list (the full list works without JavaScript).
 */
export function StateGrid({
  basePath,
  className,
  filedCodes,
}: {
  basePath: "/annual-report" | "/states";
  className?: string;
  /** States where an annual report can be ordered now (our partner files some of them), shown as such. */
  filedCodes?: ReadonlySet<string>;
}) {
  const items = listJurisdictions()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((j) => {
      const filed = filedCodes?.has(j.code) ?? false;
      return {
        code: j.code,
        name: j.name,
        slug: j.slug,
        verified: filed || isStateVerified(j.code),
        label: filed ? "We file it" : stateSupportLabel(j.code),
        // An unverified guide page only points to the agency, so a state we file in goes to its order page.
        href: filed && !isStateVerified(j.code) ? `/services/${j.slug}#annual-report` : undefined,
      };
    });
  return <StateDirectory items={items} basePath={basePath} className={className} />;
}
