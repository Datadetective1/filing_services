"use client";

import { ArrowRight, MapPin } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export interface PickableState {
  code: string;
  name: string;
  slug: string;
}

/**
 * Step one for every visitor: pick the state. Opens the page that lists everything we can do
 * there. Works without JavaScript too (a plain GET form to /services).
 */
export function StatePicker({
  states,
  initialSlug = "",
  label = "Where is your business?",
  cta = "See my options",
  className,
  tone = "default",
}: {
  states: PickableState[];
  initialSlug?: string;
  label?: string;
  cta?: string;
  className?: string;
  tone?: "default" | "glass";
}) {
  const id = useId();
  const router = useRouter();
  const [slug, setSlug] = useState(states.some((s) => s.slug === initialSlug) ? initialSlug : "");
  const [error, setError] = useState(false);

  return (
    <form
      action="/services"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        if (!slug) {
          setError(true);
          return;
        }
        router.push(`/services/${slug}`);
      }}
      className={cn("grid gap-3", className)}
    >
      <label htmlFor={id} className={cn("flex items-center gap-2 text-[15px] font-semibold", tone === "glass" ? "text-ink-fg" : "text-fg")}>
        <MapPin size={20} weight="fill" aria-hidden className={tone === "glass" ? "text-highlight" : "text-accent"} />
        {label}
      </label>
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          id={id}
          name="state"
          value={slug}
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setSlug(e.target.value);
            setError(false);
          }}
          className="h-14 w-full min-w-0 rounded-[12px] border border-border-strong bg-bg px-4 text-[17px] font-medium text-fg focus:outline-2 focus:outline-ring"
        >
          <option value="" disabled>
            Choose your state
          </option>
          {states.map((s) => (
            <option key={s.code} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses(tone === "glass" ? "inverse" : "primary", "lg", "h-14 w-full sm:w-auto")}>
          {cta}
          <ArrowRight size={18} weight="bold" aria-hidden />
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className={cn("text-sm font-medium", tone === "glass" ? "text-highlight" : "text-danger")}>
          Choose your state first.
        </p>
      ) : null}
    </form>
  );
}
