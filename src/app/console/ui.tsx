import Link from "next/link";
import { seenWithin } from "./format";

/** "Older" (and "Newest") links for a list paged by time. `query` is the rest of the list's query string. */
export function Pager({ nextBefore, paged, query = {} }: { nextBefore: Date | null; paged: boolean; query?: Record<string, string> }) {
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...query, ...extra }).filter(([, v]) => v));
    const s = p.toString();
    return s ? `?${s}` : "?";
  };
  if (!nextBefore && !paged) return null;
  return (
    <div className="cn-pager">
      {paged ? <Link className="btn btn-secondary btn-sm" href={qs({})}>Newest</Link> : <span />}
      {nextBefore ? <Link className="btn btn-secondary btn-sm" href={qs({ before: nextBefore.toISOString() })}>Older</Link> : null}
    </div>
  );
}

export function TicketPill({ status }: { status: string }) {
  return <span className={`pill ${status === "OPEN" ? "tone-warn" : "tone-muted"}`}>{status === "OPEN" ? "Open" : status === "CLOSED" ? "Closed" : status}</span>;
}

const BROADCAST_PILL: Record<string, [string, string]> = {
  DRAFT: ["tone-muted", "Draft"], SCHEDULED: ["tone-accent", "Scheduled"], SENDING: ["tone-warn", "Sending"],
  SENT: ["tone-ok", "Sent"], CANCELLED: ["tone-muted", "Cancelled"],
};

export function BroadcastPill({ status }: { status: string }) {
  const [tone, label] = BROADCAST_PILL[status] ?? ["tone-muted", status];
  return <span className={`pill ${tone}`}>{label}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="cn-empty">{children}</p>;
}

const CARE_TABS = [["/care", "Engagement"], ["/care/automations", "Automations"], ["/care/delivery", "Delivery"], ["/care/trust", "Trust and compliance"]] as const;

/** The Parent care section's pages */
export function CareTabs({ active }: { active: (typeof CARE_TABS)[number][0] }) {
  return (
    <nav className="cn-tabs" aria-label="Parent care">
      {CARE_TABS.map(([href, label]) => <Link key={href} className="cn-tab" href={href} aria-current={href === active ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}

/** "42.5% (17 of 40)", or a dash with nothing to divide by */
export function RateText({ r }: { r: { n: number; of: number; pct: number | null } }) {
  return r.pct === null ? <span className="cn-muted">— (none yet)</span> : <span>{r.pct}% <span className="cn-muted">({r.n.toLocaleString("en-US")} of {r.of.toLocaleString("en-US")})</span></span>;
}

/**
 * Filter links for a list: one query parameter, the rest of the query kept (paging is dropped, back to the newest).
 * The first option is usually "All" with value "".
 */
export function FilterTabs({ label, base, param, value, options, query = {} }: {
  label: string; base: string; param: string; value: string; options: { value: string; label: string }[]; query?: Record<string, string>;
}) {
  const href = (v: string) => {
    const p = new URLSearchParams(Object.entries({ ...query, [param]: v }).filter(([, x]) => x));
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav className="cn-tabs" aria-label={label}>
      {options.map((o) => <Link key={o.value} href={href(o.value)} className="cn-tab" aria-current={value === o.value ? "page" : undefined}>{o.label}</Link>)}
    </nav>
  );
}

const CHECK_TONE: Record<string, string> = { PASS: "tone-ok", WARNING: "tone-warn", ACTION_REQUIRED: "tone-crit", NOT_CONFIGURED: "tone-muted", UNSUPPORTED: "tone-muted" };

/** A Configuration Health check result (or a config request state) as a pill */
export function CheckPill({ status }: { status: string }) {
  const tone = CHECK_TONE[status] ?? (status === "FAILED" ? "tone-crit" : status === "VERIFIED" ? "tone-ok" : status === "CANCELLED" ? "tone-muted" : "tone-accent");
  return <span className={`pill ${tone}`}>{status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ")}</span>;
}

/** Online when seen within `afterMs`; Never synced; or Offline */
export function SeenPill({ at, afterMs }: { at: Date | null; afterMs: number }) {
  if (!at) return <span className="pill tone-muted">Never synced</span>;
  return seenWithin(at, afterMs) ? <span className="pill tone-ok">Online</span> : <span className="pill tone-warn">Offline</span>;
}

/** Yes/no as a pill, with words for each */
export function OkPill({ ok, yes = "Yes", no = "No", bad = false }: { ok: boolean; yes?: string; no?: string; bad?: boolean }) {
  return <span className={`pill ${ok ? "tone-ok" : bad ? "tone-crit" : "tone-muted"}`}>{ok ? yes : no}</span>;
}

export type Stat = { label: string; value: number | string; hint?: string; href?: string; tone?: "bad" | "warn" | "ok" };

/** Stat tiles in a fixed grid (4 across, 2 on phones), so every row lines up. */
export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="cn-stats cn-stats-4">
      {stats.map((s) => {
        const body = (
          <>
            <span className="cn-stat-label">{s.label}</span>
            <span className={`cn-stat-value${s.tone ? ` cn-tone-${s.tone}` : ""}`}>{typeof s.value === "number" ? s.value.toLocaleString("en-US") : s.value}</span>
            {s.hint ? <span className="cn-stat-hint">{s.hint}</span> : <span className="cn-stat-hint" aria-hidden="true">&nbsp;</span>}
          </>
        );
        return s.href
          ? <Link key={s.label} href={s.href} className="card cn-stat cn-stat-link">{body}</Link>
          : <div key={s.label} className="card cn-stat">{body}</div>;
      })}
    </div>
  );
}
