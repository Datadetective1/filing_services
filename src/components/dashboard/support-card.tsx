import Link from "next/link";
import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";
import { Photo } from "@/components/media/photo";
import { cn } from "@/components/ui/cn";
import { quietLinkClass } from "./section";

/** A way to reach a person, for the dashboard's side column. */
export function SupportCard({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface", className)}>
      <Photo
        photo="tailorSewingPhone"
        rounded={false}
        decorative
        sizes="(min-width: 1024px) 24rem, 100vw"
        className="aspect-[16/8]"
        focus="55% 38%"
      />
      <div className="grid gap-1.5 p-5">
        <p className="font-display text-lg font-semibold text-fg">Rather ask a person?</p>
        <p className="text-[15px] leading-6 text-muted">
          Someone on our team reads every message and writes back. For a filing, write to us on its page.
        </p>
        <Link href="/help" className={cn(quietLinkClass, "mt-1 justify-self-start")}>
          <ChatCircleText size={18} weight="bold" aria-hidden />
          Get help
        </Link>
      </div>
    </div>
  );
}
