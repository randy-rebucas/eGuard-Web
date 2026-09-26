"use client";

import { useRef, useState } from "react";
import { Icon } from "./icon";
import { Avatar } from "./ui";
import { fmtMinutes, fmtMinutesPadded } from "@/lib/protections";

export type Series = { id: string; name: string; hue: number; limit: number; week: number[]; last: number[] };
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
          <span className="select-btn"><Icon name="calendar" />Last 7 days</span>
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
  const max = Math.max(240, Math.ceil(Math.max(...s.week, ...s.last, s.limit) / 60) * 60);
  const iw = W - pl - pr, ih = H - pt - pb, bw = iw / 7;
  const y = (v: number) => pt + ih - (v / max) * ih;
  const full = (a: number[]) => a.slice(0, 6);
  const avg = (a: number[]) => Math.round(full(a).reduce((x, v) => x + v, 0) / Math.max(1, full(a).length));
  const tw = avg(s.week), lw = avg(s.last), delta = lw ? Math.round(((tw - lw) / lw) * 100) : 0;
  const grid = [];
  for (let v = 60; v <= max; v += 60) grid.push(v);

  return (
    <figure className="multiple" style={{ margin: 0, position: "relative" }} ref={wrap}>
      <h4><Avatar name={s.name} hue={s.hue} /><span>{s.name}</span></h4>
      <p className="insight">Averaging <b className="num">{fmtMinutesPadded(tw)}</b> a day, <b>{delta <= 0 ? `${Math.abs(delta)}% less` : `${delta}% more`}</b> than last week</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.name}'s daily screen time this week versus last week. Average ${fmtMinutesPadded(tw)} per day this week, ${fmtMinutesPadded(lw)} last week.`}>
        {grid.map((v) => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={W - pr} y={y(v) - 3} textAnchor="end" fontSize={9}>{v / 60}h</text>
          </g>
        ))}
        <line x1={pl} x2={W - pr} y1={y(s.limit)} y2={y(s.limit)} stroke="var(--limit)" strokeWidth={1.5} strokeDasharray="4 3" />
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
                  setTip({ x: rb.left - box.left + rb.width / 2, y: rb.top - box.top + 8, lines: [`${s.name} · ${days[i].dow}, ${days[i].date}`, `This week: ${fmtMinutes(v)}${today ? " (so far)" : ""}`, `Last week: ${fmtMinutes(s.last[i] ?? 0)}`] });
                }}
                onMouseLeave={() => setTip(null)}
              />
              <text x={pl + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize={10}>{days[i].dow[0]}</text>
            </g>
          );
        })}
        <line x1={pl} x2={W - pr} y1={pt + ih} y2={pt + ih} stroke="var(--line-strong)" strokeWidth={1} />
      </svg>
      {tip ? <div className="tooltip" style={{ left: tip.x, top: tip.y }}><b>{tip.lines[0]}</b>{tip.lines[1]}<br />{tip.lines[2]}</div> : null}
    </figure>
  );
}

export type ActivityChild = {
  id: string; name: string; hue: number; deviceName: string; used: number; limit: number;
  apps: [string, number][];
  location: { available: boolean; place: string | null; updated: string | null };
  devices: { name: string; state: "healthy" | "issues" | "offline"; issues: number }[];
};

const TABS = [["screen", "Screen Time"], ["apps", "App Usage"], ["location", "Location"], ["status", "Device Status"]] as const;

export function ActivityPanel({ kids, dateLabel }: { kids: ActivityChild[]; dateLabel: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("screen");
  return (
    <section className="card card-pad" aria-labelledby="act-title">
      <div className="card-head">
        <div><h2 id="act-title">Today&apos;s Activity</h2><div className="sub">Usage so far today, against each child&apos;s daily limit</div></div>
        <span className="select-btn"><Icon name="calendar" />{dateLabel}</span>
      </div>
      <div className="tabs" role="tablist" aria-label="Activity view" style={{ marginBottom: 16 }}>
        {TABS.map(([k, l]) => <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="activity-grid" role="tabpanel">
        {kids.map((c) => {
          const head = (
            <div className="row">
              <Avatar name={c.name} hue={c.hue} size="sm" />
              <div className="grow"><div className="t-title">{c.name}</div><div className="t-meta">{c.deviceName}</div></div>
            </div>
          );
          if (tab === "screen") {
            const pct = Math.min(100, Math.round((c.used / Math.max(1, c.limit)) * 100));
            return (
              <div className="act" key={c.id}>{head}
                <div className="usage-big num">{fmtMinutesPadded(c.used)} <small>/ {fmtMinutes(c.limit)}</small></div>
                <div className={`bar ${pct >= 85 ? "warn" : ""}`} role="progressbar" aria-label={`${c.name} screen time`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
                <div className="app-rows">{c.apps.length ? c.apps.map(([a, m]) => <div key={a}><span>{a}</span><span>{fmtMinutes(m)}</span></div>) : <div><span>No usage reported yet today</span><span /></div>}</div>
              </div>
            );
          }
          if (tab === "apps") {
            const max = c.apps[0]?.[1] ?? 1;
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
            return (
              <div className="act" key={c.id}>{head}
                <div style={{ marginTop: 14 }} className="row">
                  {c.location.available ? (
                    <><span className="ico-tile ok"><Icon name="map-pin" /></span><div><div className="t-title">{c.location.place ?? "Location available"}</div><div className="t-meta">Updated {c.location.updated}</div></div></>
                  ) : (
                    <><span className="ico-tile muted"><Icon name="map-pin-off" /></span><div><div className="t-title">Location unavailable</div><div className="t-meta">Sharing is off on this device</div></div></>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div className="act" key={c.id}>{head}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {c.devices.map((d) => (
                  <div className="row" key={d.name} style={{ justifyContent: "space-between" }}>
                    <span className="t-meta" style={{ color: "var(--ink-2)" }}>{d.name}</span>
                    {d.state === "healthy" ? <span className="pill tone-ok"><Icon name="circle-check" />Healthy</span>
                      : d.state === "offline" ? <span className="pill tone-muted"><Icon name="wifi-off" />Offline</span>
                      : <span className="pill tone-warn"><Icon name="triangle-alert" />{d.issues} {d.issues === 1 ? "issue" : "issues"}</span>}
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
