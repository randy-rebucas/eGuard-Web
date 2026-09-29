import Link from "next/link";
import type { Alert, BrowserInstallation, ProtectionKey } from "@prisma/client";
import { Icon } from "./icon";
import { RemoveBrowserButton } from "./forms";
import { isOffline } from "@/lib/health";
import { Avatar, DeviceIcon, SEVERITY, StatusBadge, statusLabel, platformName } from "./ui";
import type { ChildView, DeviceView } from "@/lib/queries";
import type { DeviceState } from "@/lib/health";
import { dayTime } from "@/lib/format";
import { PROTECTION_BY_KEY } from "@/lib/protections";

export function ChildCard({ c }: { c: ChildView }) {
  const d = c.primary;
  return (
    <Link href={`/children/${c.id}`} className="card child-card interactive" aria-label={`${c.name}, ${c.age} years old, ${statusLabel(c.status)}`}>
      <div className="cc-head">
        <Avatar name={c.name} hue={c.hue} size="lg" />
        <div className="grow"><div className="cc-name">{c.name}</div><div className="t-meta">{c.age} years old</div></div>
      </div>
      <div><StatusBadge status={c.status} /></div>
      <div className="cc-dev">
        {d ? <DeviceIcon kind={d.kind} className="dev" /> : <Icon name="plus" className="dev" />}
        <div className="grow">
          <div className="t-title" style={{ fontSize: 14 }}>{d ? d.name : "No device yet"}</div>
          <div className="t-meta">{d ? `${d.osVersion}${c.devices.length > 1 ? ` · +${c.devices.length - 1} more` : ""}` : "Add one from the eGuard app"}</div>
        </div>
        <span className="go"><Icon name="arrow-right" /></span>
      </div>
    </Link>
  );
}

export function DeviceCard({ d, state, tz }: { d: DeviceView; state: DeviceState; tz: string }) {
  const issues = state.issues ? <StatusBadge status="issues" count={state.issues} /> : null;
  const badge = state.key === "healthy" ? <StatusBadge status="healthy" /> : state.key === "offline" ? <span className="row" style={{ gap: 6 }}><StatusBadge status="offline" />{issues}</span> : issues;
  const status = [
    state.key === "healthy" ? "Healthy" : state.key === "offline" ? "Offline" : null,
    state.issues ? `${state.issues} ${state.issues === 1 ? "issue" : "issues"}` : null,
  ].filter(Boolean).join(", ");
  return (
    // The label replaces the card's text for screen readers, so it carries the status and last sync too
    <Link href={`/devices/${d.id}`} className="card device-card interactive" aria-label={`${d.name}, ${d.child.name}'s device, ${status}, last synced ${dayTime(d.lastSeenAt, tz)}`}>
      <div className="device-visual">
        <DeviceIcon kind={d.kind} />
        <span className="pill tone-muted plat-chip" style={{ background: "var(--surface)" }}>{platformName(d.platform)}</span>
      </div>
      <div><div className="t-title">{d.name}</div><div className="t-meta">{d.child.name} · {d.osVersion}</div></div>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        {badge}
        <span className="t-meta num" title="Last synchronization"><Icon name="refresh-cw" size={13} style={{ verticalAlign: -2 }} /> {dayTime(d.lastSeenAt, tz).replace("Today, ", "")}</span>
      </div>
    </Link>
  );
}

export type BrowserView = Pick<BrowserInstallation, "id" | "deviceLabel" | "browser" | "browserVersion" | "extensionVersion" | "lastSeenAt" | "revokedAt"> & { child: { name: string } };

/**
 * A connected eGuard browser extension. Browser policies aren't enforced yet, so a connected browser is
 * described as connected, never as protected.
 */
export function BrowserCard({ b, tz }: { b: BrowserView; tz: string }) {
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
      <RemoveBrowserButton installationId={b.id} name={name} />
    </div>
  );
}

export type AlertAction ={ label: string; href?: string; flow?: { key: ProtectionKey; childId: string } };

/** What a parent can do about an alert. */
export function alertAction(a: Pick<Alert, "resolveKey" | "category" | "childId" | "deviceId" | "title" | "resolvedAt">): AlertAction | null {
  if (a.resolvedAt) return null;
  const [k] = (a.resolveKey ?? "").split(":");
  if (k && k in PROTECTION_BY_KEY && a.childId) {
    return { label: k === "LOCATION" ? "Guide me" : k === "BEDTIME" ? "Set bedtime" : "Review setting", flow: { key: k as ProtectionKey, childId: a.childId } };
  }
  if (k === "OFFLINE" && a.deviceId) return { label: "View device", href: `/devices/${a.deviceId}` };
  if (k === "APPREQ" && a.childId) return { label: "Review request", href: `/children/${a.childId}?tab=apps` };
  if (k === "WEBREQ" && a.childId) return { label: "Review request", href: `/children/${a.childId}?tab=browser#access-requests` };
  if (k === "BROWSER_REVOKED") return { label: "View browsers", href: "/devices#add-browser" };
  // Browser health: drift, private windows, Safe Browsing, silence
  if (k?.startsWith("BROWSER_") && a.childId) return { label: "View browser", href: `/children/${a.childId}?tab=browser` };
  switch (a.category) {
    case "APPS": return a.childId ? { label: "Review app", href: `/children/${a.childId}?tab=apps` } : null;
    case "SCREEN_TIME": return a.childId ? { label: "View activity", href: `/children/${a.childId}?tab=screen` } : null;
    case "DEVICES": return a.deviceId ? { label: "View device", href: `/devices/${a.deviceId}` } : null;
    case "PROTECTION": return a.childId ? { label: "Review", href: `/children/${a.childId}?tab=history` } : null;
    case "SYSTEM": return { label: "Manage plan", href: "/settings/subscription" };
    default: return null;
  }
}

export function severityTile(a: Pick<Alert, "severity">) {
  return SEVERITY[a.severity].tile;
}
