"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "./icon";
import { Avatar } from "./ui";
import { fmtMinutes, fmtMinutesPadded } from "@/lib/protections";

/** `limits` is the limit on each day of `week` (weekends can differ). */
export type Series = { id: string; name: string; hue: number; photo: string | null; limits: number[]; week: number[]; last: number[] };
export type DayLabel = { dow: string; date: string };

/**
 * Small multiples, one per child: this week as bars, last week's same day as a tick,
 * daily limit as a dashed line. The last day is today (in progress).
 */
export function WeeklyChart({ series, days, title = "Weekly Screen Time Trend", subtitle, single }: { series: Series[]; days: DayLabel[]; title?: string; subtitle: string; single?: boolean }) {
  const [table, setTable] = useState(false);
  return (
    <section className="card card-pad" aria-labelledby="wk-title">
      <div className="card-head">
        <div><h2 id="wk-title">{title}</h2><div className="sub">{subtitle}</div></div>
        <div className="row" style={{ gap: 8 }}>
          <span className="date-chip"><Icon name="calendar" />Last 7 days</span>
          <button className="btn btn-secondary btn-sm" aria-pressed={table} onClick={() => setTable((t) => !t)}>
            <Icon name={table ? "chart-column" : "table"} />{table ? "Chart" : "Table"}
          </button>
        </div>
      </div>
      {table ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Child</th>{days.map((d) => <th key={d.date}>{d.dow} {d.date.split(" ")[1]}</th>)}</tr></thead>
            <tbody>
              {series.flatMap((s) => [
                <tr key={s.id + "w"}><td><b>{s.name}</b> this week</td>{s.week.map((m, i) => <td key={i}>{fmtMinutes(m)}</td>)}</tr>,
                <tr key={s.id + "l"}><td className="muted">{s.name} last week</td>{s.last.map((m, i) => <td key={i} className="muted">{fmtMinutes(m)}</td>)}</tr>,
              ])}
            </tbody>
          </table>
          <p className="t-meta" style={{ marginTop: 8 }}>Today&apos;s figure is so far.</p>
        </div>
      ) : (
        <>
          <div className="chart-legend">
            <span><i className="lg-bar" />This week</span><span><i className="lg-tick" />Last week, same day</span><span><i className="lg-limit" />Daily limit</span>
          </div>
          <div className="multiples chart-wrap" style={{ marginTop: 14, ...(single ? { gridTemplateColumns: "minmax(0,1fr)" } : {}) }}>
            {series.map((s) => <Multiple key={s.id} s={s} days={days} wide={single} />)}
          </div>
        </>
      )}
    </section>
  );
}

function Multiple({ s, days, wide }: { s: Series; days: DayLabel[]; wide?: boolean }) {
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const wrap = useRef<HTMLElement>(null);
  const W = wide ? 560 : 220, H = wide ? 170 : 140, pl = 2, pr = 2, pt = 10, pb = 20;
  const max = Math.max(240, Math.ceil(Math.max(...s.week, ...s.last, ...s.limits) / 60) * 60);
  const iw = W - pl - pr, ih = H - pt - pb, bw = iw / 7;
  const y = (v: number) => pt + ih - (v / max) * ih;
  const full = (a: number[]) => a.slice(0, 6);
  const avg = (a: number[]) => Math.round(full(a).reduce((x, v) => x + v, 0) / Math.max(1, full(a).length));
  const tw = avg(s.week), lw = avg(s.last), delta = lw ? Math.round(((tw - lw) / lw) * 100) : 0;
  const grid = [];
  for (let v = 60; v <= max; v += 60) grid.push(v);
  // One dashed step per run of days sharing a limit (weekday vs weekend)
  const limitPath = s.limits.map((l, i) => `${i && l === s.limits[i - 1] ? "" : `M${pl + i * bw} ${y(l)}`}H${pl + (i + 1) * bw}`).join("");

  return (
    <figure className="multiple" style={{ margin: 0, position: "relative" }} ref={wrap}>
      <h4><Avatar name={s.name} hue={s.hue} photo={s.photo} /><span>{s.name}</span></h4>
      <p className="insight">
        Averaging <b className="num">{fmtMinutesPadded(tw)}</b> a day
        {!lw ? ", no usage last week to compare" : delta === 0 ? ", the same as last week" : <>, <b>{delta < 0 ? `${-delta}% less` : `${delta}% more`}</b> than last week</>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.name}'s daily screen time this week versus last week. Average ${fmtMinutesPadded(tw)} per day this week, ${fmtMinutesPadded(lw)} last week.`}>
        {grid.map((v) => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={W - pr} y={y(v) - 3} textAnchor="end" fontSize={9}>{v / 60}h</text>
          </g>
        ))}
        <path d={limitPath} fill="none" stroke="var(--limit)" strokeWidth={1.5} strokeDasharray="4 3" />
        {s.week.map((v, i) => {
          const x = pl + i * bw + bw * 0.22, w = bw * 0.56, top = y(v), r = Math.min(4, w / 2, (pt + ih - top) / 2);
          const today = i === s.week.length - 1;
          const ly = y(s.last[i] ?? 0);
          return (
            <g key={i}>
              <path d={`M${x} ${pt + ih} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + w - r} Q${x + w} ${top} ${x + w} ${top + r} V${pt + ih} Z`} fill="var(--bar)" fillOpacity={today ? 0.45 : 1} />
              <rect x={x - 2} y={ly - 1.5} width={w + 4} height={3} rx={1.5} fill="var(--bar-last)" stroke="var(--surface)" strokeWidth={1.5} paintOrder="stroke" />
              <rect
                x={pl + i * bw} y={pt} width={bw} height={ih} fill="transparent"
                onMouseEnter={(e) => {
                  const box = wrap.current!.getBoundingClientRect(), rb = (e.target as SVGRectElement).getBoundingClientRect();
                  setTip({ x: rb.left - box.left + rb.width / 2, y: rb.top - box.top + 8, lines: [`${s.name} · ${days[i].dow}, ${days[i].date}`, `This week: ${fmtMinutes(v)}${today ? " (so far)" : ""}`, `Last week: ${fmtMinutes(s.last[i] ?? 0)}`, `Limit: ${fmtMinutes(s.limits[i])}`] });
                }}
                onMouseLeave={() => setTip(null)}
              />
              <text x={pl + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize={10}>{days[i].dow[0]}</text>
            </g>
          );
        })}
        <line x1={pl} x2={W - pr} y1={pt + ih} y2={pt + ih} stroke="var(--line-strong)" strokeWidth={1} />
      </svg>
      {tip ? <div className="tooltip" style={{ left: tip.x, top: tip.y }}><b>{tip.lines[0]}</b>{tip.lines[1]}<br />{tip.lines[2]}<br />{tip.lines[3]}</div> : null}
    </figure>
  );
}

export type ActivityChild = {
  id: string; name: string; hue: number; photo: string | null; deviceName: string; used: number; limit: number;
  apps: [string, number][];
  /** available: has a fix; waiting: sharing on, no fix yet; off: sharing off; nodevice; plan: not on the family's plan */
  location: { state: "available" | "waiting" | "off" | "nodevice" | "plan"; place: string | null; updated: string | null };
  devices: { id: string; name: string; state: "healthy" | "issues" | "offline"; issues: number; firstCheck: boolean }[];
  /** Connected browser extensions: `tone` and `label` from browserStatus */
  browsers: { id: string; name: string; tone: string; label: string }[];
};

const TABS = [["screen", "Screen Time"], ["apps", "App Usage"], ["location", "Location"], ["status", "Device Status"]] as const;
type Tab = (typeof TABS)[number][0];

const LOCATION_COPY: Record<Exclude<ActivityChild["location"]["state"], "available">, { icon: string; title: string; text: string }> = {
  waiting: { icon: "map-pin", title: "Waiting for location", text: "Sharing is on. The first location appears after the device syncs." },
  off: { icon: "map-pin-off", title: "Location unavailable", text: "Sharing is off on this child's devices" },
  nodevice: { icon: "map-pin-off", title: "No device yet", text: "Pair a device to see location" },
  plan: { icon: "crown", title: "Not on your plan", text: "Location sharing isn't included in your plan" },
};

export function ActivityPanel({ kids, dateLabel }: { kids: ActivityChild[]; dateLabel: string }) {
  const [tab, setTab] = useState<Tab>("screen");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  // Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern, automatic activation)
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = TABS.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next][0]);
    tabs.current[next]?.focus();
  };
  return (
    <section className="card card-pad" aria-labelledby="act-title">
      <div className="card-head">
        <div><h2 id="act-title">Today&apos;s Activity</h2><div className="sub">Usage so far today, against each child&apos;s daily limit</div></div>
        <span className="date-chip"><Icon name="calendar" />{dateLabel}</span>
      </div>
      <div className="tabs" role="tablist" aria-label="Activity view" style={{ marginBottom: 16 }}>
        {TABS.map(([k, l], i) => (
          <button
            key={k} ref={(el) => { tabs.current[i] = el; }} type="button" className="tab" role="tab" id={`act-tab-${k}`} aria-controls="act-panel"
            aria-selected={tab === k} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)} onKeyDown={(e) => onKey(e, i)}
          >{l}</button>
        ))}
      </div>
      <div className="activity-grid" role="tabpanel" id="act-panel" aria-labelledby={`act-tab-${tab}`}>
        {kids.map((c) => {
          const head = (
            <div className="row">
              <Avatar name={c.name} hue={c.hue} size="sm" photo={c.photo} />
              <div className="grow"><div className="t-title">{c.name}</div><div className="t-meta">{c.deviceName}</div></div>
            </div>
          );
          if (tab === "screen") {
            const pct = Math.min(100, Math.round((c.used / Math.max(1, c.limit)) * 100));
            // The bar stops at 100%, so past the limit say by how much
            const over = c.limit > 0 && c.used > c.limit, reached = c.limit > 0 && c.used === c.limit;
            return (
              <div className="act" key={c.id}>{head}
                <div className="usage-big num">{fmtMinutesPadded(c.used)} <small>/ {fmtMinutes(c.limit)}</small></div>
                <div className={`bar ${over ? "over" : pct >= 85 ? "warn" : ""}`} role="progressbar" aria-label={`${c.name} screen time`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                  aria-valuetext={over ? `Over the limit by ${fmtMinutes(c.used - c.limit)}` : `${pct}% of the daily limit`}><span style={{ width: `${pct}%` }} /></div>
                {over ? <div className="limit-note crit"><Icon name="octagon-alert" size={14} />Over by {fmtMinutes(c.used - c.limit)}</div>
                  : reached ? <div className="limit-note warn"><Icon name="hourglass" size={14} />Limit reached</div> : null}
                <div className="app-rows">{c.apps.length ? c.apps.map(([a, m]) => <div key={a}><span>{a}</span><span>{fmtMinutes(m)}</span></div>) : <div><span>No usage reported yet today</span><span /></div>}</div>
              </div>
            );
          }
          if (tab === "apps") {
            // "Others" comes last but can exceed the top app, so scale to the largest row
            const max = Math.max(1, ...c.apps.map(([, m]) => m));
            return (
              <div className="act" key={c.id}>{head}
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {c.apps.map(([a, m]) => (
                    <div key={a}>
                      <div className="row" style={{ justifyContent: "space-between", fontSize: 13.5 }}><span>{a}</span><b className="num">{fmtMinutes(m)}</b></div>
                      <div className="bar" style={{ margin: "6px 0 0", height: 6 }}><span style={{ width: `${Math.round((m / max) * 100)}%` }} /></div>
                    </div>
                  ))}
                  {!c.apps.length ? <p className="t-meta">No app usage reported yet today.</p> : null}
                </div>
              </div>
            );
          }
          if (tab === "location") {
            const l = c.location, copy = l.state === "available" ? null : LOCATION_COPY[l.state];
            return (
              <div className="act" key={c.id}>{head}
                <div style={{ marginTop: 14 }} className="row">
                  {!copy ? (
                    <><span className="ico-tile ok"><Icon name="map-pin" /></span><div><div className="t-title">{l.place ?? "Location available"}</div><div className="t-meta">Updated {l.updated}</div></div></>
                  ) : (
                    <>
                      <span className="ico-tile muted"><Icon name={copy.icon} /></span>
                      <div>
                        <div className="t-title">{copy.title}</div>
                        <div className="t-meta">{copy.text}</div>
                        {l.state === "plan" ? <Link className="link-btn" href="/settings/subscription">See plans <Icon name="arrow-right" /></Link> : null}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div className="act" key={c.id}>{head}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {!c.devices.length && !c.browsers.length ? <p className="t-meta">No devices paired yet.</p> : null}
                {c.devices.map((d) => (
                  <div className="row" key={d.id} style={{ justifyContent: "space-between" }}>
                    <span className="t-meta" style={{ color: "var(--ink-2)" }}>{d.name}</span>
                    {d.state === "healthy" ? <span className="pill tone-ok"><Icon name="circle-check" />Healthy</span>
                      : d.state === "offline" ? <span className="pill tone-muted"><Icon name="wifi-off" />Offline</span>
                      : d.firstCheck ? <span className="pill tone-muted"><Icon name="loader-circle" />Waiting for first check</span>
                      : <span className="pill tone-warn"><Icon name="triangle-alert" />{d.issues} {d.issues === 1 ? "issue" : "issues"}</span>}
                  </div>
                ))}
                {c.browsers.map((b) => (
                  <div className="row" key={b.id} style={{ justifyContent: "space-between" }}>
                    <span className="t-meta" style={{ color: "var(--ink-2)" }}><Icon name="monitor" size={13} style={{ verticalAlign: -2 }} /> {b.name}</span>
                    <span className={`pill ${b.tone}`}>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
