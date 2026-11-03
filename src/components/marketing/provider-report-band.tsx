import { ArrowRight, FileText } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { providerReportOpenState, type ProviderReportOpenState } from "@/lib/registered-agent/provider-report";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";

export interface ProviderReportOffer {
  open: ProviderReportOpenState;
  /** Filewell's service fee, from the approved public price. */
  serviceCents: number;
  /** Entity types open here, LLC first. */
  types: ("llc" | "corporation")[];
  /** Where "File it for me" goes: the order page for this state and the first open type. */
  orderHref: string;
}

/** The provider-filed annual report this state sells right now, or null when it sells none. */
export async function providerReportOffer(stateCode: string): Promise<ProviderReportOffer | null> {
  if (!businessServicesPagesEnabled()) return null;
  const open = providerReportOpenState(stateCode);
  if (!open) return null;
  const serviceCents = (await publicServicePrices()).provider_annual_report;
  if (serviceCents === undefined) return null;
  const types = (["llc", "corporation"] as const).filter((t) => open.feeCents[t] !== undefined);
  if (types.length === 0) return null;
  return { open, serviceCents, types, orderHref: `/dashboard/services/annual-report?state=${open.code}&type=${types[0]}` };
}

/**
 * "We file it for you" on a state's guide, only where a provider-filed annual report can be
 * ordered right now: one line, the all-in price per entity type, one button.
 */
export async function ProviderReportBand({ stateCode }: { stateCode: string }) {
  const offer = await providerReportOffer(stateCode);
  if (!offer) return null;
  const { open, serviceCents, types, orderHref } = offer;
  return (
    <section aria-labelledby="report-band-title" className="pb-6 sm:pb-8">
      <Container>
        <div className="flex flex-col gap-5 rounded-[var(--radius-surface)] border border-accent/30 bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <FileText size={22} weight="fill" aria-hidden />
          </span>
          <div className="grid flex-1 gap-3">
            <h2 id="report-band-title" className="font-display text-lg font-semibold text-fg">
              We file your {open.name} {open.reportName.toLowerCase()}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {types.map((t) => (
                <li key={t} className="rounded-full border border-border bg-bg px-3 py-1.5 text-sm">
                  <span className="text-muted">{t === "llc" ? "LLC" : "Corporation"} </span>
                  <span className="tnum font-semibold text-fg">{formatCents(serviceCents + (open.feeCents[t] ?? 0), { trimZeros: true })}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">
              {formatCents(serviceCents, { trimZeros: true })} service plus the state fee. Nothing renews.
            </p>
          </div>
          <Link href={orderHref} className={buttonClasses("primary", "md", "gap-1.5")}>
            File it for me
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
