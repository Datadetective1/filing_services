"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Section list for a long legal document, built from its h2 headings after load
 * (progressive enhancement: without JavaScript the document reads the same, just
 * without the list). Gives each heading an id so the links and deep links work.
 */
export function LegalToc({ containerId, variant }: { containerId: string; variant: "aside" | "inline" }) {
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;
    const seen = new Set<string>();
    const found = [...root.querySelectorAll("h2")].map((h) => {
      let id = h.id || slugify(h.textContent ?? "");
      while (seen.has(id)) id = `${id}-2`;
      seen.add(id);
      if (!h.id) h.id = id;
      return { id, label: (h.textContent ?? "").trim() };
    });
    // Reading headings from the server-rendered document can only happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(found);
  }, [containerId]);

  if (items.length < 3) return null;

  const links = items.map((item) => (
    <a
      key={item.id}
      href={`#${item.id}`}
      className={cn(
        "flex rounded-[var(--radius-control)] px-3 text-muted transition-colors hover:bg-surface-2 hover:text-fg",
        variant === "aside" ? "min-h-9 items-center py-1.5 text-[13px] leading-5" : "min-h-11 items-center text-[15px]",
      )}
    >
      {item.label}
    </a>
  ));

  if (variant === "aside") {
    return (
      <nav aria-label="Sections" className="grid gap-0.5">
        <p className="mb-1.5 px-3 text-[12px] font-semibold uppercase tracking-wider text-subtle">On this page</p>
        {links}
      </nav>
    );
  }

  return (
    <details className="group rounded-[var(--radius-surface)] border border-border bg-surface lg:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
        Sections in this document
        <CaretDown size={16} weight="bold" aria-hidden className="text-muted transition-transform group-open:rotate-180" />
      </summary>
      <nav aria-label="Sections" className="grid border-t border-border p-2">
        {links}
      </nav>
    </details>
  );
}
