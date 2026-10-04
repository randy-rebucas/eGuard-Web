import Link from "next/link";
import type { BrowserInstallation } from "@prisma/client";
import { Icon } from "./icon";
import { RemoveBrowserButton } from "./device-forms";
import { browserStatus } from "./cards";
import { dayTime } from "@/lib/format";

/* Apart from cards.tsx so pages showing child and device cards don't also ship the device forms. */

export { BROWSER_STATE } from "./cards";

export type BrowserView = Pick<BrowserInstallation, "id" | "childId" | "deviceLabel" | "browser" | "browserVersion" | "extensionVersion" | "lastSeenAt" | "revokedAt" | "protectionState"> & { child: { name: string } };

/** A connected eGuard browser extension, described by what it last reported about its own protection. */
export function BrowserCard({ b, tz, hasPassword }: { b: BrowserView; tz: string; hasPassword: boolean }) {
  const major = b.browserVersion?.split(".")[0];
  const name = `${b.browser} on ${b.deviceLabel}`;
  const [tone, text, note] = browserStatus(b);
  return (
    <div className="card device-card" aria-label={`${name}, ${b.child.name}'s browser, ${text}`}>
      <div className="device-visual">
        <Icon name="monitor" />
        <span className="pill tone-muted plat-chip" style={{ background: "var(--surface)" }}><Icon name="globe" size={12} style={{ verticalAlign: -2 }} /> {b.browser}</span>
      </div>
      <div>
        <div className="t-title">{b.deviceLabel}</div>
        <div className="t-meta">{b.child.name} · {b.browser}{major ? ` ${major}` : ""} · eGuard {b.extensionVersion}</div>
      </div>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span className={`pill ${tone}`}>{text}</span>
        <span className="t-meta num" title="Last check-in"><Icon name="refresh-cw" size={13} style={{ verticalAlign: -2 }} /> {dayTime(b.lastSeenAt, tz).replace("Today, ", "")}</span>
      </div>
      {note ? <p className="t-meta">{note}</p> : null}
      {/* The rules and the child's site requests live on their Browser tab; not a card-wide link, since Remove sits inside */}
      <Link className="link-btn" href={`/children/${b.childId}?tab=browser`} style={{ minHeight: 0 }}>Browser settings <Icon name="arrow-right" /></Link>
      <RemoveBrowserButton installationId={b.id} name={name} hasPassword={hasPassword} />
    </div>
  );
}
