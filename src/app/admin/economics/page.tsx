import type { Metadata } from "next";
import { money } from "@/components/admin/format";
import { ConsoleHeader, Panel, Stat, StatStrip } from "@/components/admin/layout-bits";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/admin/table";
import { Notice } from "@/components/ui/surface";
import { requireAdmin } from "@/lib/auth/session";
import { SERVICES, isServiceCode, type ServiceCode } from "@/lib/services/catalog";
import { estimateProcessingFeeCents, proposedPriceEstimates, sumEconomics, type EconomicsLine } from "@/lib/services/economics";
import { RA_BENCHMARKS } from "@/lib/services/pricing-reference";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Economics" };

/**
 * Unit economics and business services reporting (admins only). Government fees are shown as
 * pass-through money, never as revenue. Processing fees are actual where Stripe reported them
 * and estimated otherwise; the table says how many rows are estimates.
 */

interface EconRow {
  order_id: string;
  service_code: string;
  fulfillment_method: EconomicsLine["fulfillmentMethod"];
  service_revenue_cents: number;
  government_fees_collected_cents: number;
  government_fees_remitted_cents: number;
  wholesale_cost_cents: number;
  acquisition_cost_cents: number;
  processing_fee_cents: number;
  processing_fee_source: "actual" | "estimated";
  service_refunds_cents: number;
  government_refunds_cents: number;
  tax_collected_cents: number;
  price_variant: string;
}

function pct(n: number | null): string {
  return n === null ? "" : `${n.toFixed(1)}%`;
}

export default async function EconomicsPage() {
  await requireAdmin();
  const db = await createClient();
  const [{ data: econ }, { data: arOrders }, { data: subs }, { data: paidOrders }, { data: refunds }] = await Promise.all([
    db.from("order_economics").select("*"),
    db.from("orders").select("id, user_id, service_fee_cents, government_fee_cents, total_cents, status").eq("order_type", "annual_report").in("status", ["paid", "partially_refunded", "refunded"]),
    db.from("ra_subscriptions").select("id, plan, billing_status, service_status, cancel_at_period_end, current_period_end, user_id"),
    db.from("orders").select("id, user_id, order_type, service_fee_cents").in("status", ["paid", "partially_refunded", "refunded"]),
    db.from("refunds").select("amount_cents, service_fee_cents, government_fee_cents, status").eq("status", "succeeded"),
  ]);

  // Annual report orders predate per-order economics rows: derive them (self-filed, estimated fee).
  const lines: (EconomicsLine & { variant: string })[] = [
    ...((econ ?? []) as EconRow[])
      .filter((r) => isServiceCode(r.service_code))
      .map((r) => ({
        serviceCode: r.service_code as ServiceCode,
        fulfillmentMethod: r.fulfillment_method,
        serviceRevenueCents: r.service_revenue_cents,
        governmentFeesCollectedCents: r.government_fees_collected_cents,
        governmentFeesRemittedCents: r.government_fees_remitted_cents,
        wholesaleCostCents: r.wholesale_cost_cents,
        acquisitionCostCents: r.acquisition_cost_cents,
        processingFeeCents: r.processing_fee_cents,
        processingFeeSource: r.processing_fee_source,
        serviceRefundsCents: r.service_refunds_cents,
        governmentRefundsCents: r.government_refunds_cents,
        taxCollectedCents: r.tax_collected_cents,
        variant: r.price_variant,
      })),
    ...(arOrders ?? []).map((o) => ({
      serviceCode: "annual_report" as const,
      fulfillmentMethod: "internal_manual" as const,
      serviceRevenueCents: o.service_fee_cents,
      governmentFeesCollectedCents: o.government_fee_cents,
      governmentFeesRemittedCents: o.government_fee_cents,
      wholesaleCostCents: 0,
      acquisitionCostCents: 0,
      processingFeeCents: estimateProcessingFeeCents(o.total_cents),
      processingFeeSource: "estimated" as const,
      serviceRefundsCents: 0,
      governmentRefundsCents: 0,
      taxCollectedCents: 0,
      variant: "standard",
    })),
  ];
  const byService = new Map<string, typeof lines>();
  for (const l of lines) {
    const key = `${l.serviceCode}|${l.variant}`;
    byService.set(key, [...(byService.get(key) ?? []), l]);
  }
  const total = sumEconomics(lines);

  const allSubs = subs ?? [];
  const paidSubs = allSubs.filter((s) => s.billing_status !== "pending");
  const activeEntities = allSubs.filter((s) => s.service_status === "active").length;
  const in30 = Date.now() + 30 * 86_400_000;
  const upcoming = allSubs.filter((s) => s.billing_status === "active" && !s.cancel_at_period_end && s.current_period_end && Date.parse(s.current_period_end) <= in30).length;
  const failed = allSubs.filter((s) => s.billing_status === "past_due" || s.billing_status === "unpaid").length;
  const bundles = paidSubs.filter((s) => s.plan === "ra_annual_report_bundle").length;

  const orders = paidOrders ?? [];
  const byUser = new Map<string, { count: number; revenue: number; types: Set<string> }>();
  for (const o of orders) {
    const u = byUser.get(o.user_id) ?? { count: 0, revenue: 0, types: new Set<string>() };
    u.count += 1;
    u.revenue += o.service_fee_cents;
    u.types.add(o.order_type);
    byUser.set(o.user_id, u);
  }
  const customers = byUser.size;
  const repeat = [...byUser.values()].filter((u) => u.count > 1).length;
  const arCustomers = [...byUser.values()].filter((u) => u.types.has("annual_report"));
  const crossSold = arCustomers.filter((u) => u.types.has("business_services")).length;
  const refundTotal = (refunds ?? []).reduce((n, r) => n + r.amount_cents, 0);

  return (
    <div className="grid gap-6">
      <ConsoleHeader
        title="Economics"
        description="Revenue and contribution by service. Government fees are pass-through money and never count as revenue. Planning estimates and competitor prices below are not verified."
      />

      <StatStrip cols={4}>
        <Stat label="Net service revenue" value={money(total.netServiceRevenueCents)} />
        <Stat label="Contribution" value={money(total.contributionCents)} hint={pct(total.contributionMarginPct)} />
        <Stat label="Government fee balance" value={money(total.governmentFeeBalanceCents)} hint="Collected minus paid to states minus refunded" />
        <Stat label="Refunds issued" value={money(refundTotal)} />
      </StatStrip>

      <StatStrip cols={4}>
        <Stat label="Active registered agent entities" value={String(activeEntities)} />
        <Stat label="Renewals in the next 30 days" value={String(upcoming)} />
        <Stat label="Failed renewals" value={String(failed)} tone={failed ? "danger" : "neutral"} />
        <Stat label="Bundle adoption" value={paidSubs.length ? `${Math.round((bundles / paidSubs.length) * 100)}%` : "No sales yet"} hint={`${bundles} of ${paidSubs.length} paid subscriptions`} />
      </StatStrip>

      <StatStrip cols={3}>
        <Stat label="Average service revenue per customer" value={customers ? money(Math.round(orders.reduce((n, o) => n + o.service_fee_cents, 0) / customers)) : "No sales yet"} />
        <Stat label="Repeat customers" value={`${repeat} of ${customers}`} />
        <Stat label="Annual report customers who bought business services" value={`${crossSold} of ${arCustomers.length}`} />
      </StatStrip>

      <Panel title="By service" description={`${total.estimatedFeeLines} of ${total.lines} rows use an estimated card fee (2.9% + 30¢).`} bodyClassName="p-0">
        <TableScroll variant="inset" className="rounded-none border-0">
          <Table>
            <THead>
              <tr>
                <TH>Service</TH>
                <TH>Price variant</TH>
                <TH>Orders</TH>
                <TH>Net revenue</TH>
                <TH>Contribution</TH>
                <TH>Margin</TH>
                <TH>Gov fee balance</TH>
              </tr>
            </THead>
            <tbody>
              {[...byService.entries()].map(([key, ls]) => {
                const [code, variant] = key.split("|");
                const r = sumEconomics(ls);
                return (
                  <TR key={key}>
                    <TD>{SERVICES[code as ServiceCode]?.name ?? code}</TD>
                    <TD>{variant}</TD>
                    <TD className="tnum">{r.lines}</TD>
                    <TD className="tnum">{money(r.netServiceRevenueCents)}</TD>
                    <TD className="tnum">{money(r.contributionCents)}</TD>
                    <TD className="tnum">{pct(r.contributionMarginPct)}</TD>
                    <TD className="tnum">{money(r.governmentFeeBalanceCents)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
      </Panel>

      <Panel title="Planning estimates at proposed prices" description="Per sale, estimated card fee, provider wholesale rates as quoted (agreement not signed)." bodyClassName="p-0">
        <TableScroll variant="inset" className="rounded-none border-0">
          <Table>
            <THead>
              <tr>
                <TH>Scenario</TH>
                <TH>Service fee</TH>
                <TH>Wholesale</TH>
                <TH>Absorbed</TH>
                <TH>Card fee</TH>
                <TH>Contribution</TH>
                <TH>Margin</TH>
              </tr>
            </THead>
            <tbody>
              {proposedPriceEstimates().map((e) => (
                <TR key={e.label}>
                  <TD>{e.label}</TD>
                  <TD className="tnum">{money(e.serviceFeeCents)}</TD>
                  <TD className="tnum">{money(e.wholesaleCents)}</TD>
                  <TD className="tnum">{money(e.acquisitionCents)}</TD>
                  <TD className="tnum">{money(e.processingFeeCents)}</TD>
                  <TD className="tnum">{money(e.contributionCents)}</TD>
                  <TD className="tnum">{pct(e.marginPct)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </Panel>

      <Panel title="Competitor reference (internal, not verified)" bodyClassName="p-0">
        <Notice tone="warning" className="m-4">
          <p>Provisional research inputs. None has been checked on the provider&apos;s own site. Never publish a comparison from this table.</p>
        </Notice>
        <TableScroll variant="inset" className="rounded-none border-0">
          <Table>
            <THead>
              <tr>
                <TH>Provider</TH>
                <TH>First year</TH>
                <TH>Renewal</TH>
                <TH>Conditions</TH>
                <TH>Notes</TH>
              </tr>
            </THead>
            <tbody>
              {RA_BENCHMARKS.map((b) => (
                <TR key={b.provider}>
                  <TD>{b.provider}</TD>
                  <TD className="tnum">{b.firstYearCents === null ? "" : money(b.firstYearCents)}</TD>
                  <TD className="tnum">{b.renewalCents === null ? "" : money(b.renewalCents)}</TD>
                  <TD>{b.promotionalConditions ?? ""}</TD>
                  <TD className="text-muted">{b.notes}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </Panel>
    </div>
  );
}
