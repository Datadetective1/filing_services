import { ArrowRight, FileText } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { providerReportOpenState } from "@/lib/registered-agent/provider-report";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";

/**
 * "We file it for you" on a state's guide, only where a provider-filed annual report can be
 * ordered right now: one line, the all-in price per entity type, one button.
 */
export async function ProviderReportBand({ stateCode }: { stateCode: string }) {
  if (!businessServicesPagesEnabled()) return null;
  const open = providerReportOpenState(stateCode);
  if (!open) return null;
  const service = (await publicServicePrices()).provider_annual_report;
  if (service === undefined) return null;
  const types = (["llc", "corporation"] as const).filter((t) => open.feeCents[t] !== undefined);
  const first = types[0];
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
                  <span className="tnum font-semibold text-fg">{formatCents(service + (open.feeCents[t] ?? 0), { trimZeros: true })}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">
              {formatCents(service, { trimZeros: true })} service plus the state fee. Nothing renews.
            </p>
          </div>
          {first ? (
            <Link href={`/dashboard/services/annual-report?state=${open.code}&type=${first}`} className={buttonClasses("primary", "md", "gap-1.5")}>
              File it for me
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
