import type { CSSProperties, ReactNode } from "react";

/**
 * The console's charts: plain HTML and CSS, rendered on the server, so they need no chart library and keep the page's
 * fonts, themes and layout. Hover and keyboard focus show a tooltip (chart-tooltip.tsx reads each mark's `data-tip`),
 * and every chart has a table view, so no value depends on hovering or on telling colors apart.
 *
 * Colors are roles from console.css: --viz-1… for series (identity, fixed order), --viz-good / -warning / -serious /
 * -critical for states, --viz-neutral for "not applicable". Text never takes a series color.
 */

export type Tip = { t: string; r: [label: string, value: string, color?: string][] };
const tip = (t: Tip) => JSON.stringify(t);

export const fmt = (n: number) => (Math.abs(n) >= 10_000 ? `${Math.round(n / 100) / 10}K`.replace(".0K", "K") : n.toLocaleString("en-US"));

/** Clean axis steps (1, 2, 5 × 10ⁿ) from 0 to at least `max`. Whole numbers: counts never get a 0.5 tick. */
export function niceTicks(max: number, count = 4) {
  if (!(max > 0)) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / count, mag = 10 ** Math.floor(Math.log10(raw)), norm = raw / mag;
  const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag);
  const top = Math.ceil(max / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

/** A card holding one chart: title, a short line saying what's plotted, the chart, then its table view at the bottom. */
export function ChartCard({ title, sub, children, table, action, wide }: { title: string; sub?: string; children: ReactNode; table?: ReactNode; action?: ReactNode; wide?: boolean }) {
  return (
    <section className={`card card-pad cn-chart-card${wide ? " cn-wide" : ""}`}>
      <div className="card-head cn-chart-head">
        <div>
          <h2>{title}</h2>
          {sub ? <p className="sub">{sub}</p> : null}
        </div>
        {action}
      </div>
      <div className="cn-chart-body">{children}</div>
      {table ? <details className="cn-tableview"><summary>Show as table</summary>{table}</details> : null}
    </section>
  );
}

/** The legend: a swatch shaped like the mark, then the name in text ink. */
export function Legend({ items, line }: { items: { label: string; color: string }[]; line?: boolean }) {
  return (
    <ul className="cn-legend">
      {items.map((i) => <li key={i.label}><span className={line ? "cn-key-line" : "cn-key"} style={{ background: i.color }} aria-hidden="true" />{i.label}</li>)}
    </ul>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="table-scroll">
      <table className="data-table cn-table">
        <thead><tr>{head.map((h, i) => <th key={h} className={i ? "cn-num" : undefined}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? "cn-num" : undefined}>{typeof c === "number" ? c.toLocaleString("en-US") : c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Which x labels to print: the first, the last, and evenly between, at most `max`. */
function xLabelAt(i: number, n: number, max = 6) {
  if (n <= max) return true;
  const every = Math.ceil((n - 1) / (max - 1));
  return i === n - 1 || (i % every === 0 && n - 1 - i >= every / 2);
}

type Column = { label: string; full: string; value: number; color?: string };

/**
 * Columns over time, one series (or each column colored by its own state, with `legend`). The tallest column is
 * labeled; the axis carries the rest, and the tooltip and table every value.
 */
export function ColumnChart({ data, unit, legend, height = 180, label }: { data: Column[]; unit: string; legend?: { label: string; color: string }[]; height?: number; label: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const { top, ticks } = niceTicks(max);
  const peak = max > 0 ? data.findLastIndex((d) => d.value === max) : -1;
  return (
    <figure className="cn-chart" aria-label={label}>
      {legend ? <Legend items={legend} /> : null}
      <div className="cn-plot-frame">
        <div className="cn-yaxis" style={{ height }} aria-hidden="true">
          {ticks.map((t) => <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>{fmt(t)}</span>)}
        </div>
        <div className="cn-plot" style={{ height }}>
          {ticks.map((t) => <span key={t} className={t ? "cn-grid" : "cn-baseline"} style={{ bottom: `${(t / top) * 100}%` }} aria-hidden="true" />)}
          {max === 0 ? <span className="cn-plot-empty">No {unit} in this period</span> : null}
          <div className="cn-cols">
            {data.map((d, i) => {
              const h = (d.value / top) * 100;
              return (
                <div key={`${i}:${d.full}`} className="cn-col" tabIndex={0} aria-label={`${d.full}: ${d.value.toLocaleString("en-US")} ${unit}`}
                  data-tip={tip({ t: d.full, r: [[unit, d.value.toLocaleString("en-US"), d.color ?? "var(--viz-1)"]] })}>
                  {d.value > 0 ? <span className="cn-colbar" style={{ height: `${h}%`, background: d.color ?? "var(--viz-1)" }} /> : null}
                  {i === peak ? <span className="cn-cap" style={{ bottom: `${h}%` }}>{fmt(d.value)}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
        <span />
        <div className="cn-xaxis" aria-hidden="true">
          {data.map((d, i) => <span key={`${i}:${d.full}`}>{xLabelAt(i, data.length) ? <span>{d.label}</span> : null}</span>)}
        </div>
      </div>
    </figure>
  );
}

type Series = { key: string; label: string; color: string };

/** Stacked columns over time: each column a whole, split by series bottom-up in legend order, 2px gaps between. */
export function StackedColumnChart({ data, series, unit, height = 180, label }: {
  data: { label: string; full: string; values: Record<string, number> }[]; series: Series[]; unit: string; height?: number; label: string;
}) {
  const totals = data.map((d) => series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0));
  const { top, ticks } = niceTicks(Math.max(0, ...totals));
  return (
    <figure className="cn-chart" aria-label={label}>
      <Legend items={series} />
      <div className="cn-plot-frame">
        <div className="cn-yaxis" style={{ height }} aria-hidden="true">
          {ticks.map((t) => <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>{fmt(t)}</span>)}
        </div>
        <div className="cn-plot" style={{ height }}>
          {ticks.map((t) => <span key={t} className={t ? "cn-grid" : "cn-baseline"} style={{ bottom: `${(t / top) * 100}%` }} aria-hidden="true" />)}
          {totals.every((n) => n === 0) ? <span className="cn-plot-empty">No {unit} in this period</span> : null}
          <div className="cn-cols">
            {data.map((d, i) => (
              <div key={`${i}:${d.full}`} className="cn-col" tabIndex={0}
                aria-label={`${d.full}: ${totals[i].toLocaleString("en-US")} ${unit}${series.map((s) => `, ${s.label} ${d.values[s.key] ?? 0}`).join("")}`}
                data-tip={tip({ t: `${d.full} · ${totals[i].toLocaleString("en-US")} ${unit}`, r: series.map((s) => [s.label, (d.values[s.key] ?? 0).toLocaleString("en-US"), s.color]) })}>
                {totals[i] > 0 ? (
                  <span className="cn-stack" style={{ height: `${(totals[i] / top) * 100}%` }}>
                    {series.filter((s) => (d.values[s.key] ?? 0) > 0).map((s) => <span key={s.key} style={{ flexGrow: d.values[s.key], background: s.color }} />)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <span />
        <div className="cn-xaxis" aria-hidden="true">
          {data.map((d, i) => <span key={`${i}:${d.full}`}>{xLabelAt(i, data.length) ? <span>{d.label}</span> : null}</span>)}
        </div>
      </div>
    </figure>
  );
}

/**
 * Horizontal bars, one series, ranked or in a meaningful order: name, bar from a shared left baseline, value at the
 * tip. `max` fixes the scale (e.g. out of all children); otherwise the largest bar is the full width.
 */
export function BarList({ rows, max, unit, label }: { rows: { label: string; value: number; display?: string; color?: string }[]; max?: number; unit: string; label: string }) {
  const scale = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="cn-barlist" aria-label={label}>
      {rows.map((r) => {
        const w = Math.min(100, (r.value / scale) * 100);
        const shown = r.display ?? r.value.toLocaleString("en-US");
        return (
          <li key={r.label} tabIndex={0} aria-label={`${r.label}: ${shown} ${unit}`} data-tip={tip({ t: r.label, r: [[unit, shown, r.color ?? "var(--viz-1)"]] })}>
            <span className="cn-barlist-name">{r.label}</span>
            <span className="cn-barlist-track">
              {r.value > 0 ? <span className="cn-barlist-bar" style={{ width: `max(calc((100% - var(--value-room)) * ${(w / 100).toFixed(4)}), 3px)`, background: r.color ?? "var(--viz-1)" }} /> : null}
              <span className="cn-barlist-value">{shown}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const DARK_TEXT_ON = new Set(["var(--viz-4)", "var(--viz-warning)", "var(--viz-neutral)"]);
const pctOf = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

type Part = { label: string; value: number; color: string };

/**
 * One whole split into parts (a tall segmented bar): widths by share, the share printed inside where it fits, names
 * in the legend below in the same order.
 */
export function SegmentedBar({ parts, unit, label }: { parts: Part[]; unit: string; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <figure className="cn-chart" aria-label={`${label}: ${parts.map((p) => `${p.label} ${p.value.toLocaleString("en-US")} (${pctOf(p.value, total)}%)`).join(", ")}`}>
      {total ? (
        <div className="cn-seg">
          {shown.map((p) => {
            const share = pctOf(p.value, total);
            return (
              <span key={p.label} tabIndex={0} style={{ flexGrow: p.value, background: p.color, color: DARK_TEXT_ON.has(p.color) ? "#0b0b0b" : "#fff" } as CSSProperties}
                aria-label={`${p.label}: ${p.value.toLocaleString("en-US")} ${unit}, ${share}%`}
                data-tip={tip({ t: p.label, r: [[unit, `${p.value.toLocaleString("en-US")} (${share}%)`, p.color]] })}>
                {p.value / total >= 0.09 ? `${share}%` : ""}
              </span>
            );
          })}
        </div>
      ) : <div className="cn-seg cn-seg-empty"><span>No {unit} yet</span></div>}
      <Legend items={parts} />
    </figure>
  );
}

/**
 * Rows of thin segmented bars sharing one legend: each row one whole (a protection across every device) split by
 * state. The total is printed at the row's end; each part's count is on hover and in the table.
 */
export function SegmentRows({ rows, series, unit, label }: { rows: { label: string; values: Record<string, number> }[]; series: Series[]; unit: string; label: string }) {
  return (
    <figure className="cn-chart" aria-label={label}>
      <Legend items={series} />
      <ul className="cn-segrows">
        {rows.map((r) => {
          const total = series.reduce((a, s) => a + (r.values[s.key] ?? 0), 0);
          return (
            <li key={r.label}>
              <span className="cn-barlist-name">{r.label}</span>
              <span className="cn-thin">
                {total ? series.filter((s) => (r.values[s.key] ?? 0) > 0).map((s) => {
                  const v = r.values[s.key];
                  return (
                    <span key={s.key} tabIndex={0} style={{ flexGrow: v, background: s.color }} aria-label={`${r.label}, ${s.label}: ${v} of ${total} ${unit}`}
                      data-tip={tip({ t: r.label, r: [[s.label, `${v.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} (${pctOf(v, total)}%)`, s.color]] })} />
                  );
                }) : <span className="cn-thin-empty" />}
              </span>
              <span className="cn-barlist-value">{total.toLocaleString("en-US")}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

const dayShort = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const dayLong = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

/** "2026-11-03" → { label: "Nov 3", full: "Tue, Nov 3" } (the day is already in Philippine time). */
export function dayLabels(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  return { label: dayShort.format(d), full: dayLong.format(d) };
}

/** Platforms keep one color each, on every chart, whatever else is shown. */
export const PLATFORM_COLOR: Record<string, string> = { ANDROID: "var(--viz-1)", IOS: "var(--viz-2)", WINDOWS: "var(--viz-3)", MACOS: "var(--viz-4)" };
export const PLATFORM_NAME: Record<string, string> = { ANDROID: "Android", IOS: "iPhone and iPad", WINDOWS: "Windows", MACOS: "Mac" };

/** "Windows 11 Home" stays as it is; "14" on Android becomes "Android 14". */
export const withPlatform = (platform: string, version: string | null) => {
  const name = PLATFORM_NAME[platform] ?? platform;
  if (!version) return `${name} (unknown)`;
  return version.toLowerCase().startsWith(name.toLowerCase().split(" ")[0]) ? version : `${name} ${version}`;
};
