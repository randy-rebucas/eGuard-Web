import Link from "next/link";
import { Icon } from "@/components/icon";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1></div></div>
      <div className="privacy-hero">
        <span className="ico-tile"><Icon name="lock" /></span>
        <div>
          <h2 style={{ fontSize: 20 }}>Your Family&apos;s Privacy</h2>
          <p className="muted" style={{ marginTop: 4, maxWidth: "60ch" }}>eGuard does not sell your children&apos;s data. We collect only what&apos;s needed to verify protections, and you can export or delete it at any time.</p>
        </div>
        <Link className="btn btn-primary" href="/settings/privacy">Privacy Controls</Link>
      </div>
      <div className="settings-layout">
        <SettingsNav />
        <section className="card card-pad">{children}</section>
      </div>
    </>
  );
}
