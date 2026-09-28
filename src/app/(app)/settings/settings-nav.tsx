"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { SECTIONS } from "./sections";

/** Shown above every section except Privacy, which it links to. */
export function PrivacyHero() {
  if (usePathname() === "/settings/privacy") return null;
  return (
    <div className="privacy-hero">
      <span className="ico-tile"><Icon name="lock" /></span>
      <div>
        <h2 style={{ fontSize: 20 }}>Your Family&apos;s Privacy</h2>
        <p className="muted" style={{ marginTop: 4, maxWidth: "60ch" }}>eGuard does not sell your children&apos;s data. We collect only what&apos;s needed to verify protections, and you can export or delete it at any time.</p>
      </div>
      <Link className="btn btn-primary" href="/settings/privacy">Privacy Controls</Link>
    </div>
  );
}

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
