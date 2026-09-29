"use client";

import { useEffect } from "react";
import { opsButton } from "@/components/admin/button-classes";

/** Error boundary for console pages. The admin navigation (layout) stays usable. */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-6 grid max-w-xl gap-3 rounded-[var(--radius-surface)] border border-danger/30 bg-surface px-6 py-6 shadow-card">
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-danger-soft font-display text-lg font-semibold text-danger">
        !
      </span>
      <h1 className="text-[22px] font-semibold text-fg">This page could not be loaded</h1>
      <p className="text-sm text-muted">
        Nothing was changed. Try again, and if it keeps failing, check the server logs
        {error.digest ? (
          <>
            {" "}
            for reference <span className="font-mono text-xs text-fg">{error.digest}</span>
          </>
        ) : null}
        .
      </p>
      <div>
        <button type="button" onClick={() => retry()} className={opsButton("secondary")}>
          Try again
        </button>
      </div>
    </div>
  );
}
