import Link from "next/link";
import type { AlertSeverity, CheckStatus } from "@prisma/client";
import { Icon } from "./icon";
import { CHECK_META, CAPABILITY_META, type Capability } from "@/lib/protections";

export type StatusKey = "protected" | "attention" | "action" | "offline" | "notconfigured" | "healthy" | "issues";

const STATUS: Record<Exclude<StatusKey, "issues">, { label: string; icon: string; tone: string }> = {
  protected: { label: "Protected", icon: "shield-check", tone: "ok" },
  attention: { label: "Needs attention", icon: "triangle-alert", tone: "warn" },
  action: { label: "Action required", icon: "octagon-alert", tone: "crit" },
  offline: { label: "Offline", icon: "wifi-off", tone: "muted" },
  notconfigured: { label: "Not configured", icon: "circle-dashed", tone: "muted" },
  healthy: { label: "Healthy", icon: "circle-check", tone: "ok" },
};
export const statusLabel = (k: Exclude<StatusKey, "issues">) => STATUS[k].label;

export function StatusBadge({ status, count }: { status: StatusKey; count?: number }) {
  if (status === "issues") {
    return <span className="pill tone-warn"><Icon name="triangle-alert" />{count} {count === 1 ? "issue" : "issues"}</span>;
  }
  const s = STATUS[status];
  return <span className={`pill tone-${s.tone}`}><Icon name={s.icon} />{s.label}</span>;
}

export function CheckBadge({ status, code }: { status: CheckStatus; code?: boolean }) {
  const m = CHECK_META[status];
  return <span className={`pill tone-${m.tone}`}><Icon name={m.icon} />{code ? <span className="code">{status}</span> : m.label}</span>;
}

export function CapabilityChip({ cap, platform }: { cap: Capability; platform: string }) {
  const m = CAPABILITY_META[cap];
  const cls = { AVAILABLE: "available", GUIDED: "guided", VERIFY_ONLY: "verify", UNSUPPORTED: "unsupported" }[cap];
  return (
    <div className={`cap ${cls}`}>
      <span className="plat">{platform}</span>
      <b><Icon name={m.icon} />{m.label}</b>
    </div>
  );
}

export const SEVERITY: Record<AlertSeverity, { label: string; icon: string; tone: string; tile: string }> = {
  INFO: { label: "Info", icon: "info", tone: "accent", tile: "" },
  ATTENTION: { label: "Attention", icon: "triangle-alert", tone: "warn", tile: "warn" },
  ACTION_REQUIRED: { label: "Action required", icon: "octagon-alert", tone: "crit", tile: "crit" },
  CRITICAL: { label: "Critical", icon: "siren", tone: "crit", tile: "crit" },
};

export function SeverityLabel({ severity }: { severity: AlertSeverity }) {
  const s = SEVERITY[severity];
  return (
    <span className="sev" style={{ color: `var(--${s.tone === "accent" ? "accent-ink" : s.tone + "-ink"})` }}>
      <Icon name={s.icon} />{s.label}
    </span>
  );
}

export function Avatar({ name, hue, size }: { name: string; hue: number; size?: "lg" | "xl" | "sm" }) {
  const sm = size === "sm" ? { width: 32, height: 32, fontSize: 13 } : undefined;
  return (
    <span className={`avatar ${size && size !== "sm" ? size : ""}`} style={{ ["--h" as string]: hue, ...sm }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Overlapping avatars; past `max`, the rest collapse into a "+N" chip. */
export function AvatarGroup({ people, max = 6 }: { people: { id: string; name: string; hue: number }[]; max?: number }) {
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const more = people.length - shown.length;
  return (
    <div className="avatar-group">
      {shown.map((p) => <Avatar key={p.id} name={p.name} hue={p.hue} />)}
      {more ? <span className="avatar" style={{ ["--h" as string]: 220 }} aria-hidden="true">+{more}</span> : null}
    </div>
  );
}

export function DeviceIcon({ kind, className }: { kind: "PHONE" | "TABLET"; className?: string }) {
  return <Icon name={kind === "TABLET" ? "tablet" : "smartphone"} className={className} />;
}

export const platformName = (p: "ANDROID" | "IOS") => (p === "IOS" ? "iOS" : "Android");

export function EmptyState({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="ico-tile"><Icon name={icon} /></span>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {children}
    </div>
  );
}

/** Where a plan doesn't include something: says what, and links to the plans. `compact` for inline use in a list. */
export function UpgradeNote({ title, text, icon = "crown", compact }: { title: string; text: string; icon?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="upgrade-note">
        <Icon name={icon} /><span className="grow">{text}</span>
        <Link className="link-btn" href="/settings/subscription">See plans <Icon name="arrow-right" /></Link>
      </div>
    );
  }
  return (
    <EmptyState icon={icon} title={title} text={text}>
      <Link className="btn btn-primary" href="/settings/subscription"><Icon name="crown" />See plans</Link>
    </EmptyState>
  );
}

/** A placeholder while something loads; announced to screen readers once. */
export function Loading({ height, label = "Loading", radius, style }: { height: number; label?: string; radius?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" role="status" aria-label={label} style={{ height, borderRadius: radius, ...style }} />;
}

/** Page-level skeleton pieces for route `loading.tsx` files. */
export function PageHeadSkeleton({ action }: { action?: boolean }) {
  return (
    <div className="page-head" aria-hidden="true">
      <div className="dash-col" style={{ gap: 10, flex: 1 }}>
        <div className="skeleton" style={{ height: 34, width: "min(280px, 60%)" }} />
        <div className="skeleton" style={{ height: 16, width: "min(460px, 85%)" }} />
      </div>
      {action ? <div className="skeleton" style={{ height: 42, width: 130, borderRadius: 999 }} /> : null}
    </div>
  );
}

export function PageSkeleton({ label, action, children }: { label: string; action?: boolean; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="dash-col" style={{ gap: 20 }}>
      <PageHeadSkeleton action={action} />
      <div aria-hidden="true" className="dash-col" style={{ gap: 20 }}>{children}</div>
    </div>
  );
}

export function PageHead({ title, text, children, crumbs }: { title: string; text?: string; children?: React.ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <div className="page-head">
      <div>
        {crumbs ? (
          <div className="crumbs">
            {crumbs.map((c) => (
              <span key={c.href} className="row" style={{ gap: 6 }}>
                <Link className="link-btn" href={c.href} style={{ fontWeight: 500, minHeight: 0 }}>{c.label}</Link>
                <Icon name="chevron-right" size={14} />
              </span>
            ))}
          </div>
        ) : null}
        <h1>{title}</h1>
        {text ? <p>{text}</p> : null}
      </div>
      {children ? <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>{children}</div> : null}
    </div>
  );
}

/** Segmented 10-check ring: one arc per Configuration Health check. */
export function HealthRing({ score, total = 10, small, label = "Configuration health" }: { score: number; total?: number; small?: boolean; label?: string }) {
  const r = 62, cx = 74, cy = 74, gap = 4.2, seg = 360 / total;
  const arcs = Array.from({ length: total }, (_, i) => {
    const a0 = ((i * seg + gap / 2) * Math.PI) / 180, a1 = (((i + 1) * seg - gap / 2) * Math.PI) / 180;
    const d = `M${(cx + r * Math.cos(a0)).toFixed(2)} ${(cy + r * Math.sin(a0)).toFixed(2)} A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(2)} ${(cy + r * Math.sin(a1)).toFixed(2)}`;
    return <path key={i} d={d} stroke={i < score ? "var(--accent)" : "var(--warn)"} strokeWidth={10} fill="none" strokeLinecap="round" />;
  });
  return (
    <div className={`health-ring ${small ? "sm" : ""}`} role="img" aria-label={`${label}: ${score} of ${total} checks passing`}>
      <svg viewBox="0 0 148 148">{arcs}</svg>
      <div className="ring-label"><div><b className="num">{score}<small> / {total}</small></b><span>checks passing</span></div></div>
    </div>
  );
}

export function SegMeter({ score, total = 10 }: { score: number; total?: number }) {
  return (
    <div className="seg-meter" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < score ? "on" : "warn"} />)}
    </div>
  );
}

export function Timeline({ items }: { items: { id: string; icon: string; title: string; by: string; time: string; from?: string | null; to?: string | null }[] }) {
  return (
    <div className="timeline">
      {items.map((h) => (
        <div className="tl-item" key={h.id}>
          <span className="tl-dot"><Icon name={h.icon} /></span>
          <div>
            <div className="t-title">{h.title}</div>
            <div className="t-meta">{h.by}</div>
            {h.from || h.to ? (
              <div className="change">
                {h.from ? <><s>{h.from}</s><Icon name="arrow-right" size={14} /></> : null}
                {h.to ? <b>{h.to}</b> : null}
              </div>
            ) : null}
          </div>
          <time className="t-meta num" style={{ whiteSpace: "nowrap" }}>{h.time}</time>
        </div>
      ))}
    </div>
  );
}
