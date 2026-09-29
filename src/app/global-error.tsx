"use client";

import "./globals.css";

/**
 * Last-resort fallback when the root layout itself fails. It replaces the whole document, so it
 * brings its own <html>, <body> and styles, and uses plain links (full page loads) in case the
 * client router is what broke. Production error messages are redacted by Next and never shown.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong</title>
        <main className="flex flex-1 items-center justify-center px-4 py-16 sm:py-24">
          <div className="mx-auto grid max-w-md justify-items-center gap-5 text-center">
            <div className="grid gap-2">
              <h1 className="text-2xl font-semibold text-fg sm:text-[28px]">We couldn&apos;t load this page</h1>
              <p className="text-[15px] leading-7 text-muted">
                Something went wrong on our side. Your filings and data are safe. Please try again in a moment.
              </p>
            </div>
            <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-fg hover:bg-accent-hover"
              >
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full page load on purpose: the app shell failed. */}
              <a
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-full border border-border-strong bg-surface px-5 text-[15px] font-semibold text-fg hover:bg-surface-2"
              >
                Go to the home page
              </a>
            </div>
            <p className="text-sm text-muted">
              Still stuck?{" "}
              <a href="/help" className="font-semibold text-accent underline decoration-accent/30 decoration-2 underline-offset-4 hover:decoration-accent">
                Get help
              </a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
