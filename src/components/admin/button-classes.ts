import { buttonClasses } from "@/components/ui/button";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Design-system button classes at a 44px touch height (the console is dense, but
 * every control stays comfortably tappable). Swaps the medium size's height token
 * rather than stacking a second height utility.
 */
export function opsButton(variant: Variant = "secondary", className?: string): string {
  return buttonClasses(variant, "md", className).replace("h-10 ", "h-11 ");
}
