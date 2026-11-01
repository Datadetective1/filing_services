import { ArrowRight, Buildings } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Container } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { getRaJurisdiction, raJurisdictionsWithPublicFacts } from "@/lib/registered-agent/jurisdictions";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";

/**
 * A short registered agent offer under a state's annual report guide: every state needs an
 * agent on file, so this links each guide to that state's registered agent page.
 */
export async function RaStateBand({ stateCode }: { stateCode: string }) {
  if (!businessServicesPagesEnabled()) return null;
  const j = getRaJurisdiction(stateCode);
  if (!j) return null;
  const hasPage = raJurisdictionsWithPublicFacts().some((x) => x.code === j.code);
  const ra = (await publicServicePrices()).registered_agent;
  const href = hasPage ? `/registered-agent/${j.slug}` : "/registered-agent";
  return (
    <section aria-labelledby="ra-band-title" className="pb-14 sm:pb-20">
      <Container>
        <Link
          href={href}
          className="group flex flex-col gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card transition-[border-color] hover:border-accent/40 sm:flex-row sm:items-center sm:p-6"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg">
            <Buildings size={22} weight="fill" aria-hidden />
          </span>
          <span className="grid flex-1 gap-1">
            <span id="ra-band-title" className="font-display text-lg font-semibold text-fg">
              Need a registered agent in {j.name}?
            </span>
            <span className="text-[15px] text-muted">
              {ra !== undefined ? `${formatCents(ra, { trimZeros: true })} a year, the same at renewal. ` : ""}Switching? We file the change for you.
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
            {j.name} registered agent
            <ArrowRight size={16} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </Container>
    </section>
  );
}
