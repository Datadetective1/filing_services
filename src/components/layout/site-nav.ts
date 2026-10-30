/** Public navigation, shared by the desktop header, the mobile menu and the footer. */
export const SITE_NAV = [
  { href: "/annual-report", label: "Annual reports" },
  { href: "/states", label: "States" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
] as const;

export type NavItem = { href: string; label: string };

const REGISTERED_AGENT_NAV: NavItem = { href: "/registered-agent", label: "Registered agent" };

/**
 * The main navigation, with the registered agent page right after annual reports once the
 * business services pages are live. Computed on the server (the switch is a server env var)
 * and passed to the mobile menu as a prop.
 */
export function siteNav(businessServicesPages: boolean): NavItem[] {
  if (!businessServicesPages) return [...SITE_NAV];
  return [SITE_NAV[0], REGISTERED_AGENT_NAV, ...SITE_NAV.slice(1)];
}
