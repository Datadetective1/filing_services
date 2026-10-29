import { formatCents } from "@/lib/domain/money";
import type { ServiceQuote } from "@/lib/services/quote";

/**
 * Order summary: Filewell's service charge, the government fee, optional add-ons, the
 * recurring renewal price and the total due today, each on its own line.
 */
export function QuoteSummary({ quote }: { quote: ServiceQuote }) {
  const main = quote.lines.filter((l) => !l.addOn);
  const addOns = quote.lines.filter((l) => l.addOn);
  return (
    <div className="grid gap-3">
      <dl className="grid gap-2 text-[15px]">
        {main.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">
              {l.description}
              {l.kind === "government_fee" ? <span className="block text-xs text-subtle">Passed to the state at cost</span> : null}
            </dt>
            <dd className="tnum font-medium text-fg">{formatCents(l.amountCents)}</dd>
          </div>
        ))}
        {addOns.length > 0 ? (
          <>
            <p className="mt-2 text-sm font-semibold text-fg">Optional add-ons you chose</p>
            {addOns.map((l, i) => (
              <div key={`a${i}`} className="flex items-baseline justify-between gap-4">
                <dt className="text-muted">{l.description}</dt>
                <dd className="tnum font-medium text-fg">{formatCents(l.amountCents)}</dd>
              </div>
            ))}
          </>
        ) : null}
      </dl>
      <div className="grid gap-1 border-t border-border pt-3 text-[15px]">
        <div className="flex justify-between gap-4">
          <span className="text-muted">Filewell service</span>
          <span className="tnum">{formatCents(quote.serviceFeeCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Government fees</span>
          <span className="tnum">{formatCents(quote.governmentFeeCents)}</span>
        </div>
        <div className="flex justify-between gap-4 font-semibold text-fg">
          <span>Total due today</span>
          <span className="tnum">{formatCents(quote.dueTodayCents)}</span>
        </div>
        {quote.renewal ? (
          <p className="mt-1 text-sm text-muted">
            Then {formatCents(quote.renewal.amountCents)} per year: {quote.renewal.description.toLowerCase()}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
