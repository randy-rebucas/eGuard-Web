"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/families", label: "Families" },
  { href: "/tickets", label: "Tickets" },
  { href: "/organizations", label: "Organizations" },
  { href: "/audit", label: "Audit log" },
];

/** The console's sections. Paths are as the browser sees them on the console host (/families, not /console/families). */
export function ConsoleNav() {
  const path = usePathname().replace(/^\/console(?=\/|$)/, "") || "/";
  return (
    <nav className="cn-nav" aria-label="Console">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path === l.href || path.startsWith(`${l.href}/`);
        return <Link key={l.href} href={l.href} className="cn-nav-link" aria-current={active ? "page" : undefined}>{l.label}</Link>;
      })}
    </nav>
  );
}
