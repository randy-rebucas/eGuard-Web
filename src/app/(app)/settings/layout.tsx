import { PrivacyHero, SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1></div></div>
      <PrivacyHero />
      <div className="settings-layout">
        <SettingsNav />
        <section className="card card-pad">{children}</section>
      </div>
    </>
  );
}
