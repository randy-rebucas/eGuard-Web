import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { dayTime, dayLabel } from "@/lib/format";
import { MAX_RANGE_DAYS, reportData, resolveRange, type Period } from "@/lib/reports";
import { dayRange, weeklySeries } from "@/lib/views";
import { PROTECTION_BY_KEY, fmtMinutes, fmtMinutesPadded } from "@/lib/protections";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead, Timeline, UpgradeNote } from "@/components/ui";
import { entitlementsFor } from "@/lib/plans";
import { APPS_UPGRADE, REPORTS_UPGRADE, capAppUsage } from "@/lib/plan-access";
import { WeeklyChart } from "@/components/charts";

export const metadata = { title: "Reports" };

const PERIODS: [Period, string][] = [["today", "Today"], ["7d", "7 Days"], ["30d", "30 Days"], ["custom", "Custom"]];
/** Longer and custom ranges are advanced reports */
const ADVANCED: Period[] = ["30d", "custom"];
const MAX_CHANGES = 500;

export default async function ReportsPage(props: PageProps<"/reports">) {
  const u = await requireUser();
  const sp = await props.searchParams;
  const [family, graph] = await Promise.all([getFamily(u.familyId), getFamilyGraph(u.familyId)]);
  const advanced = entitlementsFor(family.plan).advancedReports;
  const asked = (PERIODS.find(([k]) => k === sp.period)?.[0] ?? "7d") as Period;
  const locked = !advanced && ADVANCED.includes(asked);
  const period = locked ? "7d" : asked;
  const tz = family.timezone;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const range = resolveRange(period, tz, str(sp.from), str(sp.to));
  // resolveRange clamps or replaces dates it can't use; say so instead of quietly showing something else
  const adjusted = period === "custom" && (str(sp.from) || str(sp.to)) && (range.from !== str(sp.from) || range.to !== str(sp.to));
  const [data, weekly] = await Promise.all([reportData(u.familyId, tz, range.from, range.to, { maxChanges: MAX_CHANGES }), weeklySeries(u.familyId, tz, graph)]);
  const { avg, prevAvg } = data;
  const delta = prevAvg ? Math.round(((avg - prevAvg) / prevAvg) * 100) : null;
  const h = graph.familyHealth;
  const healthy = Object.values(graph.deviceStates).filter((s) => s.key === "healthy").length;
  const offline = Object.values(graph.deviceStates).filter((s) => s.key === "offline").length;
  // No more app names than the plan's Apps list shows (Free: the most used few)
  const topApps = capAppUsage(data.apps.map((a) => ({ app: a.app, minutes: a._sum.minutes ?? 0 })), entitlementsFor(family.plan).appMonitoringLimit);
  const maxApp = topApps.named[0]?.minutes || 1;
  const rangeLabel = range.from === range.to ? dayLabel(range.from).date : dayRange(range.from, range.to);
  const unpaired = !graph.devices.length;
  const exportHref = `/api/reports/export?period=${period}&from=${range.from}&to=${range.to}`;

  return (
    <>
      <PageHead title="Reports" text="Family Digital Safety Summary: how protections held up and how screen time is trending.">
        <nav className="seg" aria-label="Period">
          {PERIODS.map(([k, l]) => (
            <Link key={k} href={`/reports?period=${k}`} aria-current={period === k && !locked ? "page" : undefined}>
              {!advanced && ADVANCED.includes(k) ? <><Icon name="lock" size={13} /> </> : null}{l}
            </Link>
          ))}
        </nav>
        {advanced ? <a className="btn btn-secondary" href={exportHref} download><Icon name="download" />Export CSV</a> : null}
      </PageHead>

      {locked || !advanced ? <UpgradeNote compact title="Advanced reports" text={locked ? `${REPORTS_UPGRADE} Showing the last 7 days.` : REPORTS_UPGRADE} /> : null}

      {period === "custom" ? (
        <form className="card card-pad form-grid" style={{ maxWidth: 620, alignItems: "end" }} action="/reports">
          <input type="hidden" name="period" value="custom" />
          <div className="field"><label htmlFor="from">From</label><input className="input" id="from" name="from" type="date" defaultValue={range.from} /></div>
          <div className="field"><label htmlFor="to">To</label><input className="input" id="to" name="to" type="date" defaultValue={range.to} /></div>
          <div><button className="btn btn-primary">Apply</button></div>
        </form>
      ) : null}

      <p className="t-meta">
        Showing {rangeLabel}{period === "today" ? " (so far)" : ""}
        {adjusted ? `. Adjusted from the dates you chose: ranges can't end after today or run longer than ${MAX_RANGE_DAYS} days, and the start must come before the end.` : ""}
      </p>

      <section className="report-metrics">
        <div className="card metric" style={{ minHeight: 0 }}>
          <div className="m-top"><span className="m-label">Configuration health</span><span className="ico-tile"><Icon name="shield-check" /></span></div>
          <div className="m-value num">{unpaired ? "–" : h.score} / {h.total}</div>
          <div className="t-meta">{unpaired ? "No devices to check yet" : h.verified ? "Every check verified" : h.score === h.total ? `Every check passing as last reported, ${h.offline} offline` : `${h.total - h.score} check${h.total - h.score > 1 ? "s" : ""} need review`}</div>
        </div>
        <div className="card metric" style={{ minHeight: 0 }}>
          <div className="m-top"><span className="m-label">{period === "today" ? "Family screen time today" : "Avg. family screen time / day"}</span><span className="ico-tile"><Icon name="hourglass" /></span></div>
          <div className="m-value num">{fmtMinutesPadded(avg)}</div>
          <div className="t-meta">
            {prevAvg == null ? "Day still in progress"
              : delta == null ? "No earlier data to compare"
              : delta === 0 ? "Same as the period before"
              : `${delta < 0 ? "Down" : "Up"} ${Math.abs(delta)}% from the period before`}
            {prevAvg != null && data.complete < data.n ? ". Complete days only" : ""}
          </div>
        </div>
        <div className="card metric" style={{ minHeight: 0 }}>
          <div className="m-top"><span className="m-label">Protection changes</span><span className="ico-tile"><Icon name="history" /></span></div>
          <div className="m-value num">{data.changes.length >= MAX_CHANGES ? `${MAX_CHANGES}+` : data.changes.length}</div>
          <div className="t-meta">Verified changes and on-device changes</div>
        </div>
        <div className="card metric" style={{ minHeight: 0 }}>
          <div className="m-top"><span className="m-label">Devices healthy</span><span className="ico-tile"><Icon name="tablet-smartphone" /></span></div>
          <div className="m-value num">{healthy} of {graph.devices.length}</div>
          <div className="t-meta">{unpaired ? "No devices paired yet" : offline ? `${offline} offline` : "None offline"}{graph.devices.length - healthy - offline ? `, ${graph.devices.length - healthy - offline} with open issues` : ""}</div>
        </div>
      </section>

      <div className="detail-grid">
        <WeeklyChart series={weekly.series} days={weekly.days} subtitle={`Daily totals, ${weekly.range}. Today is still in progress.`} />
        <section className="card card-pad">
          <div className="card-head"><div><h2 style={{ fontSize: 18 }}>Top apps</h2><div className="sub">Family total, {rangeLabel}</div></div></div>
          {topApps.named.length ? topApps.named.map((a) => (
            <div className="hbar" key={a.app}><span>{a.app}</span><span className="track"><span style={{ width: `${Math.round((a.minutes / maxApp) * 100)}%` }} /></span><b>{fmtMinutes(a.minutes)}</b></div>
          )) : <EmptyState icon="app-window" title="No app usage in this period" />}
          {topApps.hidden ? <div style={{ marginTop: 12 }}><UpgradeNote compact icon="app-window" title="More apps" text={`${family.plan} names the ${topApps.named.length} most used apps. ${APPS_UPGRADE}`} /></div> : null}
        </section>
      </div>

      <section className="card card-pad">
        <div className="card-head"><div><h2>Protection changes</h2><div className="sub">Configuration history for the whole family, {rangeLabel}</div></div></div>
        {data.changes.length >= MAX_CHANGES ? <p className="t-meta" style={{ marginBottom: 12 }}>Showing the latest {MAX_CHANGES}. Export CSV for the full list.</p> : null}
        {data.changes.length ? <Timeline items={data.changes.map((h) => ({ id: h.id, icon: PROTECTION_BY_KEY[h.key]?.icon ?? "history", title: `${h.child.name}: ${h.title}`, by: h.actor, time: dayTime(h.createdAt, tz), from: h.fromValue, to: h.toValue }))} />
          : <EmptyState icon="history" title="No changes in this period" />}
      </section>
    </>
  );
}
