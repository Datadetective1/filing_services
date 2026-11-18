"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";

export interface BadgeOption {
  slug: string;
  name: string;
  imageSrc: string;
  embedHtml: string;
}

/** Pick a state, see the badge, copy the code. Nothing is sent anywhere. */
export function BadgeBuilder({ options, initial }: { options: BadgeOption[]; initial: string }) {
  const [slug, setSlug] = useState(initial);
  const [copied, setCopied] = useState(false);
  const current = options.find((o) => o.slug === slug) ?? options[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(current.embedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-4">
        <label htmlFor="badge-state" className="text-sm font-semibold text-fg">
          State
        </label>
        <select
          id="badge-state"
          value={current.slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setCopied(false);
          }}
          className="min-h-12 rounded-[10px] border border-border-strong bg-surface px-3 text-[16px] text-fg"
        >
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
        <label htmlFor="badge-code" className="mt-2 text-sm font-semibold text-fg">
          Code for your site
        </label>
        <textarea
          id="badge-code"
          readOnly
          rows={5}
          value={current.embedHtml}
          onFocus={(e) => e.currentTarget.select()}
          className="rounded-[10px] border border-border bg-surface-2 p-3 font-mono text-[12px] leading-5 text-fg"
        />
        <button type="button" onClick={copy} className={buttonClasses("primary", "md", "justify-self-start")}>
          {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
          {copied ? "Copied" : "Copy code"}
        </button>
        <p aria-live="polite" className="sr-only">
          {copied ? "Code copied" : ""}
        </p>
      </div>
      <div className="grid place-items-center rounded-[var(--radius-surface)] border border-border bg-surface-2 p-6 [perspective:1200px] sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- the live SVG, exactly as other sites will show it */}
        <img
          key={current.slug}
          src={current.imageSrc}
          alt={`${current.name} annual report due date badge`}
          width={360}
          className="h-auto w-full max-w-[360px] drop-shadow-[0_30px_40px_rgb(14_42_32/0.35)] transition-transform duration-500 [transform:rotateX(8deg)_rotateY(-10deg)] hover:[transform:rotateX(0deg)_rotateY(0deg)]"
        />
      </div>
    </div>
  );
}
