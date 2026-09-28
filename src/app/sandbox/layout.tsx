import { Flask } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Test checkout",
  robots: { index: false, follow: false },
};

/**
 * Hosted-checkout simulator shell (sandbox payments only). Deliberately plain and
 * clearly labeled as a test so it can't be mistaken for a real payment page.
 */
export default function SandboxLayout({ children }: LayoutProps<"/sandbox">) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-2">
      <div
        role="note"
        className="border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-center text-sm font-medium text-fg"
      >
        <span className="inline-flex items-center gap-2">
          <Flask size={18} weight="bold" className="text-warning" aria-hidden />
          Test checkout. Sandbox mode. No real card, no real charge.
        </span>
      </div>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:py-14">{children}</main>
      <footer className="px-4 pb-6 text-center text-xs text-subtle">
        Payment simulator for development and testing. No payment processor is contacted.
      </footer>
    </div>
  );
}
