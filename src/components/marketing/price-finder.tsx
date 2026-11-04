"use client";

import { ArrowRight, MapPin } from "@phosphor-icons/react";
import Link from "next/link";
import { useId, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { track } from "@/lib/analytics/client";
import { formatCents } from "@/lib/domain/money";
import type { StatePrice } from "@/lib/services/plan-offers";

const money = (c: number) => formatCents(c, { trimZeros: true });

/** Pick a state, see the all-in annual report price per entity type, and start the order. */
export function PriceFinder({ states, initialCode }: { states: StatePrice[]; initialCode?: string }) {
  const id = useId();
  const [code, setCode] = useState(states.some((s) => s.code === initialCode) ? initialCode! : (states[0]?.code ?? ""));
  const state = states.find((s) => s.code === code);
  if (states.length === 0) return null;

  return (
    <div className="grid gap-5 rounded-[28px] border border-border bg-surface p-5 shadow-lift sm:p-8">
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,18rem)] sm:items-center sm:justify-between">
        <label htmlFor={id} className="flex items-center gap-2 font-display text-xl font-semibold text-fg">
          <MapPin size={22} weight="fill" aria-hidden className="text-accent" />
          Your state
        </label>
        <select
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 w-full rounded-[10px] border border-border-strong bg-bg px-3 text-base font-medium text-fg focus:outline-2 focus:outline-ring"
        >
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {state ? (
        <ul className="grid gap-3 sm:grid-cols-2" aria-live="polite">
          {state.rows.map((r) => (
            <li key={r.label} className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-bg p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 font-semibold text-fg">{r.label}</span>
                <span className="tnum font-display text-[32px] font-semibold leading-none text-fg">{money(r.totalCents)}</span>
              </div>
              <p className="tnum text-sm text-muted">
                {r.stateCents === 0 ? "No state fee" : `${money(r.stateCents)} state fee`} + {money(r.serviceCents)} ours
              </p>
              <Link
                href={r.href}
                onClick={() => track("filing_cta_clicked", { stateCode: state.code })}
                className={buttonClasses("primary", "md", "w-full")}
              >
                File it for me
                <ArrowRight size={16} weight="bold" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
