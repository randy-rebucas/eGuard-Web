import type { BrowserInstallation } from "@prisma/client";
import { Icon } from "./icon";
import { RemoveBrowserButton } from "./device-forms";
import { isOffline } from "@/lib/health";
import { dayTime } from "@/lib/format";

/* Apart from cards.tsx so pages showing child and device cards don't also ship the device forms. */

export type BrowserView = Pick<BrowserInstallation, "id" | "deviceLabel" | "browser" | "browserVersion" | "extensionVersion" | "lastSeenAt" | "revokedAt"> & { child: { name: string } };

/**
 * A connected eGuard browser extension. Browser policies aren't enforced yet, so a connected browser is
 * described as connected, never as protected.
 */
export function BrowserCard({ b, tz, hasPassword }: { b: BrowserView; tz: string; hasPassword: boolean }) {
  const quiet = isOffline(b);
  const major = b.browserVersion?.split(".")[0];
  const name = `${b.browser} on ${b.deviceLabel}`;
  const [tone, text] = b.revokedAt ? ["tone-crit", "Disconnected for security"] : quiet ? ["tone-warn", "Not seen for a day"] : ["tone-accent", "Connected"];
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
      <p className="t-meta">{b.revokedAt ? "Remove it, then add it again with a new code." : "Website protection for browsers is coming soon. Nothing is blocked in this browser yet."}</p>
      <RemoveBrowserButton installationId={b.id} name={name} hasPassword={hasPassword} />
    </div>
  );
}
