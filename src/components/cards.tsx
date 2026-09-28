import Link from "next/link";
import type { Alert, ProtectionKey } from "@prisma/client";
import { Icon } from "./icon";
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

export type AlertAction = { label: string; href?: string; flow?: { key: ProtectionKey; childId: string } };

/** What a parent can do about an alert. */
export function alertAction(a: Pick<Alert, "resolveKey" | "category" | "childId" | "deviceId" | "title" | "resolvedAt">): AlertAction | null {
  if (a.resolvedAt) return null;
  const [k] = (a.resolveKey ?? "").split(":");
  if (k && k in PROTECTION_BY_KEY && a.childId) {
    return { label: k === "LOCATION" ? "Guide me" : k === "BEDTIME" ? "Set bedtime" : "Review setting", flow: { key: k as ProtectionKey, childId: a.childId } };
  }
  if (k === "OFFLINE" && a.deviceId) return { label: "View device", href: `/devices/${a.deviceId}` };
  if (k === "APPREQ" && a.childId) return { label: "Review request", href: `/children/${a.childId}?tab=apps` };
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
