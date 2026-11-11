"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };
type Group = { label: string; links: NavLink[] };

/** The console's sections, in groups. Paths are as the browser sees them on the console host (/families, not /console/families). */
const GROUPS: Group[] = [
  { label: "Dashboard", links: [{ href: "/", label: "Dashboard" }] },
  {
    label: "Accounts",
    links: [
      { href: "/families", label: "Families" },
      { href: "/parents", label: "Parents" },
      { href: "/children", label: "Children" },
      { href: "/subscriptions", label: "Subscriptions" },
      { href: "/organizations", label: "Organizations" },
    ],
  },
  {
    label: "Devices",
    links: [
      { href: "/devices", label: "Devices" },
      { href: "/diagnostics", label: "Device diagnostics" },
      { href: "/policies", label: "Policies" },
      { href: "/config-health", label: "Configuration health" },
    ],
  },
  {
    label: "Support",
    links: [
      { href: "/tickets", label: "Support tickets" },
      { href: "/alerts", label: "Alerts" },
      { href: "/broadcasts", label: "Email" },
      { href: "/care", label: "Parent care" },
    ],
  },
  {
    label: "Platform",
    links: [
      { href: "/security", label: "Security" },
      { href: "/audit", label: "Audit logs" },
      { href: "/flags", label: "Feature flags" },
      { href: "/status", label: "System status" },
    ],
  },
];

const matches = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function ConsoleNav() {
  const path = usePathname().replace(/^\/console(?=\/|$)/, "") || "/";
  const active = GROUPS.find((g) => g.links.some((l) => matches(path, l.href))) ?? GROUPS[0];
  return (
    <>
      <nav className="cn-nav" aria-label="Console">
        {GROUPS.map((g) => (
          <Link key={g.label} href={g.links[0].href} className="cn-nav-link" aria-current={g === active ? (g.links.length === 1 ? "page" : "true") : undefined}>{g.label}</Link>
        ))}
      </nav>
      {active.links.length > 1 ? (
        <nav className="cn-subnav" aria-label={active.label}>
          {active.links.map((l) => (
            <Link key={l.href} href={l.href} className="cn-subnav-link" aria-current={matches(path, l.href) ? "page" : undefined}>{l.label}</Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
