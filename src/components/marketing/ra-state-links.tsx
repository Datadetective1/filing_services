import Link from "next/link";
import { textLinkClasses } from "@/components/ui/button";
import { raJurisdictionsWithPublicFacts } from "@/lib/registered-agent/jurisdictions";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";

/** Every other state's registered agent page (or its change guide), as a compact list of internal links. */
export function RaOtherStates({ currentCode, title, hrefSuffix = "" }: { currentCode?: string; title: string; hrefSuffix?: "" | "/change" }) {
  if (!businessServicesPagesEnabled()) return null;
  const states = raJurisdictionsWithPublicFacts().filter((j) => j.code !== currentCode);
  if (!states.length) return null;
  return (
    <nav aria-label={title} className="grid gap-4">
      <h2 className="text-xl font-semibold text-fg">{title}</h2>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-3 lg:grid-cols-4">
        {states.map((j) => (
          <li key={j.code}>
            <Link href={`/registered-agent/${j.slug}${hrefSuffix}`} className={textLinkClasses}>
              {j.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
