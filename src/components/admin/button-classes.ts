import { buttonClasses } from "@/components/ui/button";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Design-system button classes at the 44px medium touch height (the console is
 * dense, but every control stays comfortably tappable).
 */
export function opsButton(variant: Variant = "secondary", className?: string): string {
  return buttonClasses(variant, "md", className);
}
