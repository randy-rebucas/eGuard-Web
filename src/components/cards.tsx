import Link from "next/link";
import type { Alert, BrowserInstallation, ProtectionKey } from "@prisma/client";
import { Icon } from "./icon";
import { Avatar, DeviceIcon, SEVERITY, StatusBadge, statusLabel, platformName } from "./ui";
import type { ChildView, DeviceView } from "@/lib/queries";
import { isOffline, type DeviceState } from "@/lib/health";
import { ageLabel, dayTime } from "@/lib/format";
import { PROTECTION_BY_KEY } from "@/lib/protections";

/** `browsers`: connected eGuard browser extensions, so a browser-only child isn't shown as having nothing at all. */
export function ChildCard({ c, browsers = 0 }: { c: ChildView; browsers?: number }) {
  const d = c.primary;
  const extra = browsers ? `${browsers} ${browsers === 1 ? "browser" : "browsers"}` : "";
  return (
    <Link href={`/children/${c.id}`} className="card child-card interactive" aria-label={`${c.name}, ${ageLabel(c.age)}, ${statusLabel(c.status)}`}>
      <div className="cc-head">
        <Avatar name={c.name} hue={c.hue} size="lg" photo={c.photo} />
        <div className="grow"><div className="cc-name">{c.name}</div><div className="t-meta">{ageLabel(c.age)}</div></div>
      </div>
      <div><StatusBadge status={c.status} /></div>
      <div className="cc-dev">
        {d ? <DeviceIcon kind={d.kind} className="dev" /> : <Icon name="plus" className="dev" />}
        <div className="grow">
          <div className="t-title" style={{ fontSize: 14 }}>{d ? d.name : "No device yet"}</div>
          <div className="t-meta">{d ? `${d.osVersion}${c.devices.length > 1 ? ` · +${c.devices.length - 1} more` : ""}${extra ? ` · ${extra}` : ""}`
            // A browser only covers websites: screen time, apps and the rest need the phone or tablet
            : extra ? `${extra} · pair a phone or tablet` : "Pair one with a code from Devices"}</div>
        </div>
        <span className="go"><Icon name="arrow-right" /></span>
      </div>
    </Link>
  );
}

export function DeviceCard({ d, state, tz }: { d: DeviceView; state: DeviceState; tz: string }) {
  // Just paired: every protection is unreported, which is a wait, not ten problems
  const first = state.firstCheck;
  const issues = first ? <span className="pill tone-muted"><Icon name="loader-circle" />Waiting for first check</span>
    : state.issues ? <StatusBadge status="issues" count={state.issues} /> : null;
  const badge = state.key === "healthy" ? <StatusBadge status="healthy" /> : state.key === "offline" ? <span className="row" style={{ gap: 6 }}><StatusBadge status="offline" />{issues}</span> : issues;
  const status = [
    state.key === "healthy" ? "Healthy" : state.key === "offline" ? "Offline" : null,
    first ? "waiting for first check" : state.issues ? `${state.issues} ${state.issues === 1 ? "issue" : "issues"}` : null,
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

/** The extension's own answer from its latest health report (docs/browser-extension-api.md, POST /health). */
export const BROWSER_STATE: Record<string, [tone: string, label: string, note: string]> = {
  PROTECTED: ["tone-ok", "Protected", "Blocking sites with your browser settings."],
  NEEDS_ATTENTION: ["tone-warn", "Needs attention", "Some of its checks need review. Your alerts say which, and so does eGuard's popup in the browser."],
  ACTION_REQUIRED: ["tone-crit", "Action required", "Sites may not be blocked. Your alerts say what to fix, and so does eGuard's popup in the browser."],
  SYNC_PAUSED: ["tone-warn", "Sync paused", "It keeps blocking with its last settings, but isn't getting your changes."],
  UNSUPPORTED: ["tone-muted", "Not supported", "This browser can't run eGuard's protection. Update it, or use Chrome, Edge or Firefox."],
};

type BrowserLike = Pick<BrowserInstallation, "lastSeenAt" | "revokedAt" | "protectionState">;

/** A browser's [tone, label, note]: disconnected and silent override what it last reported. */
export function browserStatus(b: BrowserLike): [tone: string, label: string, note: string] {
  if (b.revokedAt) return ["tone-crit", "Disconnected for security", "Remove it, then add it again with a new code."];
  // Silent for a day: whatever it last reported can't be confirmed now
  if (isOffline(b)) return ["tone-warn", "Not seen for a day", "Its last settings stay active, but eGuard can't confirm them until the browser is opened again."];
  // A state this server doesn't know yet (a newer extension) reads as plain "Connected"
  return (b.protectionState ? BROWSER_STATE[b.protectionState] : undefined) ?? ["tone-accent", "Connected", b.protectionState ? "" : "Waiting for its first health check."];
}

/** A browser at a glance, beside the device cards; links to its child's Browser tab (removing it stays on Devices). */
export function BrowserStatusCard({ b, tz }: { b: BrowserLike & Pick<BrowserInstallation, "id" | "childId" | "browser" | "deviceLabel"> & { child: { name: string } }; tz: string }) {
  const [tone, text] = browserStatus(b);
  return (
    <Link href={`/children/${b.childId}?tab=browser`} className="card device-card interactive" aria-label={`${b.browser} on ${b.deviceLabel}, ${b.child.name}'s browser, ${text}, last check-in ${dayTime(b.lastSeenAt, tz)}`}>
      <div className="device-visual">
        <Icon name="monitor" />
        <span className="pill tone-muted plat-chip" style={{ background: "var(--surface)" }}><Icon name="globe" size={12} style={{ verticalAlign: -2 }} /> {b.browser}</span>
      </div>
      <div><div className="t-title">{b.deviceLabel}</div><div className="t-meta">{b.child.name} · {b.browser}</div></div>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span className={`pill ${tone}`}>{text}</span>
        <span className="t-meta num" title="Last check-in"><Icon name="refresh-cw" size={13} style={{ verticalAlign: -2 }} /> {dayTime(b.lastSeenAt, tz).replace("Today, ", "")}</span>
      </div>
    </Link>
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
