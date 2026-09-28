import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { formatCents } from "@/lib/domain/money";
import { Badge, PaymentStatusBadge } from "@/components/ui/badge";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import type { OrderView, PaymentView, RefundView } from "@/app/(app)/dashboard/_lib/data";
import { formatTimestamp, formatTimestampDate, safeHttpsUrl } from "./format";

const REFUND_STATUS: Record<string, { label: string; tone: "neutral" | "success" | "danger" }> = {
  pending: { label: "Processing", tone: "neutral" },
  succeeded: { label: "Refunded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

/** Government fee and our service fee, always shown separately, plus payment state. */
export function PaymentSummary({
  order,
  payments,
  refunds,
  stateName,
}: {
  order: OrderView;
  payments: PaymentView[];
  refunds: RefundView[];
  stateName: string;
}) {
  const paid = order.status === "paid" || order.status === "partially_refunded" || order.status === "refunded";
  const receiptUrl = payments.map((p) => safeHttpsUrl(p.receiptUrl)).find(Boolean) ?? null;

  return (
    <div className="grid gap-5">
      <PriceBreakdown
        quote={{
          governmentFeeCents: order.governmentFeeCents,
          serviceFeeCents: order.serviceFeeCents,
          totalCents: order.totalCents,
        }}
        stateName={stateName}
        totalLabel={paid ? "Total paid" : "Total"}
      />
      <dl className="grid gap-3 border-t border-border pt-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Payment status</dt>
          <dd>
            <PaymentStatusBadge status={order.status} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Order date</dt>
          <dd className="tnum text-fg">
            <time dateTime={order.createdAt}>{formatTimestampDate(order.createdAt)}</time>
          </dd>
        </div>
        {order.paidAt ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Paid</dt>
            <dd className="tnum text-right text-fg">
              <time dateTime={order.paidAt}>{formatTimestamp(order.paidAt)}</time>
            </dd>
          </div>
        ) : null}
      </dl>
      {receiptUrl ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
        >
          View payment receipt
          <ArrowSquareOut size={14} weight="bold" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}

      {refunds.length > 0 ? (
        <div className="grid gap-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-fg">Refunds</p>
          <ul className="grid gap-3">
            {refunds.map((r) => {
              const s = REFUND_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
              return (
                <li key={r.id} className="grid gap-1 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="tnum font-medium text-fg">{formatCents(r.amountCents)}</span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <p className="tnum text-muted">
                    Government fee {formatCents(r.governmentFeeCents)}, service fee {formatCents(r.serviceFeeCents)}
                  </p>
                  <p className="tnum text-xs text-subtle">
                    <time dateTime={r.createdAt}>{formatTimestampDate(r.createdAt)}</time>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
