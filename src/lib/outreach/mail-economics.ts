/**
 * Postcard pilot cost and unit economics (estimates; nothing is purchased).
 *
 * Prices are 4x6 First-Class, print + postage included, as published by the vendors and
 * read on 2026-09-30 (lob.com/pricing/print-mail, postgrid.com/pricing-print-mail).
 * Lob's prices rise on 2026-11-01; a December 31 pilot mails in November, so the
 * post-increase prices are used.
 */

export interface VendorPlan {
  id: string;
  vendor: string;
  plan: string;
  monthlyFee: number;
  perPiece: number;
  monthlyCap: number | null;
  note: string;
}

export const VENDOR_PLANS: VendorPlan[] = [
  { id: "lob_developer", vendor: "Lob", plan: "Developer (free)", monthlyFee: 0, perPiece: 0.909, monthlyCap: null, note: "From Nov 1, 2026 ($0.905 before)" },
  { id: "lob_startup", vendor: "Lob", plan: "Startup", monthlyFee: 260, perPiece: 0.649, monthlyCap: null, note: "One month of the plan for the pilot" },
  { id: "postgrid_starter", vendor: "PostGrid", plan: "Starter (free)", monthlyFee: 0, perPiece: 0.902, monthlyCap: 500, note: "500 pieces a month cap" },
];

/** Paid order: our $49 fee minus Stripe's card fee on the $56 charge (the $7 state fee passes through). */
export const SERVICE_FEE = 49;
export const ORDER_TOTAL = 56;
export const STRIPE_FEE = Math.round((ORDER_TOTAL * 0.029 + 0.3) * 100) / 100;
export const NET_PER_ORDER = Math.round((SERVICE_FEE - STRIPE_FEE) * 100) / 100;

/** Pieces-to-paid-order rates to model (assumptions, not measured). */
export const CONVERSION_SCENARIOS = [0.0025, 0.005, 0.01, 0.02] as const;

export interface PilotCost {
  pieces: number;
  plan: VendorPlan;
  months: number;
  cost: number;
  costPerPiece: number;
  breakEvenOrders: number;
  breakEvenRate: number;
  scenarios: { rate: number; orders: number; net: number }[];
}

export function pilotCost(pieces: number, plan: VendorPlan): PilotCost {
  const months = plan.monthlyCap ? Math.ceil(pieces / plan.monthlyCap) : 1;
  const cost = Math.round((plan.monthlyFee * months + plan.perPiece * pieces) * 100) / 100;
  const breakEvenOrders = Math.ceil(cost / NET_PER_ORDER);
  return {
    pieces,
    plan,
    months,
    cost,
    costPerPiece: Math.round((cost / pieces) * 1000) / 1000,
    breakEvenOrders,
    breakEvenRate: breakEvenOrders / pieces,
    scenarios: CONVERSION_SCENARIOS.map((rate) => {
      const orders = Math.round(pieces * rate * 10) / 10;
      return { rate, orders, net: Math.round((orders * NET_PER_ORDER - cost) * 100) / 100 };
    }),
  };
}

/** The cheapest available plan for a pilot size (ignoring plans whose cap would split it over months). */
export function cheapestPlan(pieces: number): PilotCost {
  return VENDOR_PLANS.map((p) => pilotCost(pieces, p))
    .filter((c) => c.months === 1)
    .sort((a, b) => a.cost - b.cost)[0];
}

export const PILOT_SIZES = [100, 500, 1000, 5000] as const;
