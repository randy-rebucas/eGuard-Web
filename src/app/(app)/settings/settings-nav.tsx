"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { SECTIONS } from "./sections";


export function SettingsNav() {
  const path = usePathname();
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {SECTIONS.map(([k, l, ic]) => (
        <Link key={k} href={`/settings/${k}`} aria-current={path === `/settings/${k}` ? "page" : undefined}><Icon name={ic} />{l}</Link>
      ))}
    </nav>
  );
}
