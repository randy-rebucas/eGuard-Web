import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { dayTime, dayLabel } from "@/lib/format";
import { reportData, resolveRange, type Period } from "@/lib/reports";
import { weeklySeries } from "@/lib/views";
import { PROTECTION_BY_KEY, fmtMinutes, fmtMinutesPadded } from "@/lib/protections";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead, Timeline } from "@/components/ui";
import { WeeklyChart } from "@/components/charts";

export const metadata = { title: "Reports" };

const PERIODS: [Period, string][] = [["today", "Today"], ["7d", "7 Days"], ["30d", "30 Days"], ["custom", "Custom"]];

export default async function ReportsPage(props: PageProps<"/reports">) {
  const u = await requireUser();
  const sp = await props.searchParams;
  const period = (PERIODS.find(([k]) => k === sp.period)?.[0] ?? "7d") as Period;
  const family = await getFamily(u.familyId);
  const tz = family.timezone;
  const range = resolveRange(period, tz, sp.from as string | undefined, sp.to as string | undefined);
  const graph = await getFamilyGraph(u.familyId);
  const [data, weekly] = await Promise.all([reportData(u.familyId, range.from, range.to), weeklySeries(u.familyId, tz, graph)]);
  const avg = Math.round(data.total / data.n);
  const prevAvg = Math.round(data.prevTotal / data.n);
  const delta = prevAvg ? Math.round(((avg - prevAvg) / prevAvg) * 100) : null;
  const healthy = Object.values(graph.deviceStates).filter((s) => s.key === "healthy").length;
  const offline = Object.values(graph.deviceStates).filter((s) => s.key === "offline").length;
  const maxApp = data.apps[0]?._sum.minutes ?? 1;
  const rangeLabel = range.from === range.to ? dayLabel(range.from).date : `${dayLabel(range.from).date} – ${dayLabel(range.to).date}`;
  const exportHref = `/api/reports/export?period=${period}&from=${range.from}&to=${range.to}`;

  return (
    <>
      <PageHead title="Reports" text="Family Digital Safety Summary: how protections held up and how screen time is trending.">
        <nav className="seg" aria-label="Period">
          {PERIODS.map(([k, l]) => <Link key={k} href={`/reports?period=${k}`} aria-current={period === k ? "page" : undefined}>{l}</Link>)}
        </nav>
        <a className="btn btn-secondary" href={exportHref} download><Icon name="download" />Export CSV</a>
      </PageHead>

      {period === "custom" ? (
        <form className="card card-pad form-grid" style={{ maxWidth: 620, alignItems: "end" }} action="/reports">
          <input type="hidden" name="period" value="custom" />
          <div className="field"><label htmlFor="from">From</label><input className="input" id="from" name="from" type="date" defaultValue={range.from} /></div>
          <div className="field"><label htmlFor="to">To</label><input className="input" id="to" name="to" type="date" defaultValue={range.to} /></div>
          <div><button className="btn btn-primary">Apply</button></div>
        </form>
      ) : null}

      <p className="t-meta">Showing {rangeLabel}{period === "today" ? " (so far)" : ""}</p>

      <section className="report-metrics">
        <div className="card metric" style={{ minHeight: 0 }}>
          <div className="m-top"><span className="m-label">Configuration health</span><span className="ico-tile"><Icon name="shield-check" /></span></div>
          <div className="m-value num">{graph.familyHealth.score} / 10</div>
          <div className="t-meta">{graph.familyHealth.score === 10 ? "Every check passing" : `${10 - graph.familyHealth.score} check${10 - graph.familyHealth.score > 1 ? "s" : ""} need review`}</div>
        </div>
        <div className="card metric" style={{ minHeight: 0 }}>
          <div className="m-top"><span className="m-label">{period === "today" ? "Family screen time today" : "Avg. family screen time / day"}</span><span className="ico-tile"><Icon name="hourglass" /></span></div>
          <div className="m-value num">{fmtMinutesPadded(avg)}</div>
          <div className="t-meta">{delta == null ? "No earlier data to compare" : `${delta <= 0 ? "Down" : "Up"} ${Math.abs(delta)}% from the period before`}</div>
        </div>
        <div className="card metric" style={{ minHeight: 0 }}>
          <div className="m-top"><span className="m-label">Protection changes</span><span className="ico-tile"><Icon name="history" /></span></div>
          <div className="m-value num">{data.changes.length}</div>
          <div className="t-meta">Verified changes and on-device changes</div>
        </div>
        <div className="card metric" style={{ minHeight: 0 }}>
          <div className="m-top"><span className="m-label">Devices healthy</span><span className="ico-tile"><Icon name="tablet-smartphone" /></span></div>
          <div className="m-value num">{healthy} of {graph.devices.length}</div>
          <div className="t-meta">{offline ? `${offline} offline` : "None offline"}{graph.devices.length - healthy - offline ? `, ${graph.devices.length - healthy - offline} with open issues` : ""}</div>
        </div>
      </section>

      <div className="detail-grid">
        <WeeklyChart series={weekly.series} days={weekly.days} subtitle={`Daily totals, ${weekly.range}. Today is still in progress.`} />
        <section className="card card-pad">
          <div className="card-head"><div><h2 style={{ fontSize: 18 }}>Top apps</h2><div className="sub">Family total, {rangeLabel}</div></div></div>
          {data.apps.length ? data.apps.map((a) => (
            <div className="hbar" key={a.app}><span>{a.app}</span><span className="track"><span style={{ width: `${Math.round(((a._sum.minutes ?? 0) / maxApp) * 100)}%` }} /></span><b>{fmtMinutes(a._sum.minutes ?? 0)}</b></div>
          )) : <EmptyState icon="app-window" title="No app usage in this period" />}
        </section>
      </div>

      <section className="card card-pad">
        <div className="card-head"><div><h2>Protection changes</h2><div className="sub">Configuration history for the whole family, {rangeLabel}</div></div></div>
        {data.changes.length ? <Timeline items={data.changes.map((h) => ({ id: h.id, icon: PROTECTION_BY_KEY[h.key]?.icon ?? "history", title: `${h.child.name}: ${h.title}`, by: h.actor, time: dayTime(h.createdAt, tz), from: h.fromValue, to: h.toValue }))} />
          : <EmptyState icon="history" title="No changes in this period" />}
      </section>
    </>
  );
}
