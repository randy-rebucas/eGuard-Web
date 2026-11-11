import Link from "next/link";
import type { AlertCategory, AlertSeverity } from "@prisma/client";
import { requireStaff } from "@/lib/staff-auth";
import { alertsPerDay, familyAlertVolume, opsAlerts } from "@/lib/console-queries";
import { ago, label, num, stamp } from "../../format";
import { Empty, StatGrid } from "../../ui";
import { ChartCard, DataTable, SegmentRows, StackedColumnChart, dayLabels } from "../../charts";

export const metadata = { title: "Alerts" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

type Issue = { level: "crit" | "warn"; title: string; detail: string; href?: string };

const CATEGORIES: AlertCategory[] = ["PROTECTION", "DEVICES", "APPS", "SCREEN_TIME", "LOCATION", "SYSTEM"];
const SEVERITIES: AlertSeverity[] = ["CRITICAL", "ACTION_REQUIRED", "ATTENTION", "INFO"];
/** Severity is a state: the state colors, worst first (the bottom of each stack). Info is neutral. */
const SEVERITY_SERIES = [
  { key: "CRITICAL", label: "Critical", color: "var(--viz-critical)" },
  { key: "ACTION_REQUIRED", label: "Action required", color: "var(--viz-serious)" },
  { key: "ATTENTION", label: "Attention", color: "var(--viz-warning)" },
  { key: "INFO", label: "Info", color: "var(--viz-neutral)" },
];

/**
 * What needs the eGuard team's attention now, then families' alert volume as counts. Families' alerts are theirs:
 * no title, text or family is shown here.
 */
export default async function AlertsPage() {
  await requireStaff();
  const [o, v, perDay] = await Promise.all([opsAlerts(), familyAlertVolume(), alertsPerDay(14)]);
  const issues: Issue[] = [];
  if (o.cronStale) {
    issues.push({ level: "crit", title: "The maintenance job isn't running", detail: o.lastRun ? `Last run ${ago(o.lastRun.startedAt)}.` : "No run recorded yet.", href: "/status" });
  }
  if (o.failedRuns.length) {
    const steps = [...new Set(o.failedRuns.flatMap((r) => r.failed))];
    issues.push({ level: "crit", title: `${o.failedRuns.length} maintenance ${o.failedRuns.length === 1 ? "run" : "runs"} had failed steps in 24 hours`, detail: steps.join(", "), href: "/status" });
  }
  if (o.deadJobs) issues.push({ level: "warn", title: `${num(o.deadJobs)} parent care ${o.deadJobs === 1 ? "job" : "jobs"} failed for good this week`, detail: "Retry them from Parent care › Delivery.", href: "/care/delivery" });
  if (o.retrying) issues.push({ level: "warn", title: `${num(o.retrying)} parent care ${o.retrying === 1 ? "job is" : "jobs are"} being retried`, detail: "They failed once and are queued again.", href: "/care/delivery" });
  for (const e of o.failedEmails) issues.push({ level: "warn", title: `${num(e.n)} ${e.n === 1 ? "email" : "emails"} failed: ${e.subject}`, detail: "In the last 7 days.", href: `/broadcasts/${e.broadcastId}` });
  if (o.uncheckedPurchases) issues.push({ level: "warn", title: `${num(o.uncheckedPurchases)} ${o.uncheckedPurchases === 1 ? "purchase hasn't" : "purchases haven't"} been re-checked in 2 days`, detail: "The maintenance job's purchase refresh may be failing for them. See below.", href: "/subscriptions" });
  if (o.stuck) issues.push({ level: "warn", title: `${num(o.stuck)} ${o.stuck === 1 ? "change is" : "changes are"} stuck waiting for a device`, detail: "Over 24 hours without being delivered or confirmed.", href: "/config-health" });
  if (o.revokedBrowsers) issues.push({ level: "warn", title: `${num(o.revokedBrowsers)} ${o.revokedBrowsers === 1 ? "browser was" : "browsers were"} disconnected for security this week`, detail: "A copied sign-in token was used. A spike may mean an attack.", href: "/devices?view=browsers&state=revoked" });
  if (o.oldTickets) issues.push({ level: "warn", title: `${num(o.oldTickets)} support ${o.oldTickets === 1 ? "ticket has" : "tickets have"} been open over 2 days`, detail: "", href: "/tickets?status=OPEN" });

  const week = new Map(v.week.map((r) => [`${r.category}:${r.severity}`, r.n]));
  const dayTotal = v.day.reduce((a, r) => a + r.n, 0), weekTotal = v.week.reduce((a, r) => a + r.n, 0);
  const unresolved = new Map(v.unresolved.map((r) => [r.severity, r.n]));

  return (
    <>
      <h1 className="cn-h1">Alerts</h1>
      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Needs attention</h2></div>
        {issues.length ? (
          <div>
            {issues.map((i) => (
              <div key={i.title} className="cn-issue">
                <div>
                  <span className={`pill ${i.level === "crit" ? "tone-crit" : "tone-warn"}`}>{i.level === "crit" ? "Critical" : "Warning"}</span>{" "}
                  <b>{i.title}</b>
                  {i.detail ? <div className="cn-muted">{i.detail}</div> : null}
                </div>
                {i.href ? <Link className="btn btn-ghost btn-sm" href={i.href}>Open</Link> : null}
              </div>
            ))}
          </div>
        ) : <Empty>All clear.{o.lastRun ? ` The maintenance job last ran ${ago(o.lastRun.startedAt)}.` : ""}</Empty>}
      </section>

      {o.uncheckedList.length ? (
        <section className="card">
          <div className="card-head card-pad cn-head-flush"><h2>Purchases not re-checked in 2 days</h2></div>
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Family</th><th>Product</th><th>Store</th><th>State</th><th>Last checked</th></tr></thead>
              <tbody>
                {o.uncheckedList.map((p) => (
                  <tr key={p.id}>
                    <td><Link prefetch={false} className="inline-link" href={`/families/${p.family.id}`}>{p.family.name}</Link></td>
                    <td className="cn-mono">{p.productId}</td><td>{label(p.store)}</td><td className="cn-mono">{p.state}</td><td>{stamp(p.checkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {o.deadJobReasons.length ? (
        <section className="card">
          <div className="card-head card-pad cn-head-flush"><h2>Why parent care jobs failed this week</h2></div>
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Automation</th><th>Error</th><th className="cn-num">Jobs</th></tr></thead>
              <tbody>{o.deadJobReasons.map((r) => <tr key={`${r.automation}:${r.error}`}><td className="cn-mono">{r.automation}</td><td className="cn-mono">{r.error ?? "—"}</td><td className="cn-num">{num(r.n)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      <h2 className="cn-section-title">Families&apos; alerts · counts only, what each says stays with the family</h2>
      <StatGrid stats={[
        { label: "Last 24 hours", value: dayTotal },
        { label: "Last 7 days", value: weekTotal },
        { label: "Critical, unresolved", value: unresolved.get("CRITICAL") ?? 0, tone: unresolved.get("CRITICAL") ? "bad" : undefined },
        { label: "Needing action, unresolved", value: unresolved.get("ACTION_REQUIRED") ?? 0, tone: unresolved.get("ACTION_REQUIRED") ? "warn" : undefined },
      ]} />
      <div className="cn-grid2">
        <ChartCard wide title="Alerts per day" sub="Every family, last 14 days, by severity"
          table={<DataTable head={["Day", ...SEVERITY_SERIES.map((x) => x.label)]} rows={perDay.map((d) => [dayLabels(d.day).full, ...SEVERITY_SERIES.map((x) => d.values[x.key] ?? 0)])} />}>
          <StackedColumnChart series={SEVERITY_SERIES} unit="alerts" label="Families' alerts per day by severity, last 14 days"
            data={perDay.map((d) => ({ ...dayLabels(d.day), values: d.values }))} />
        </ChartCard>
        <ChartCard wide title="By category, last 7 days" sub="What the alerts were about, split by severity"
          table={<DataTable head={["Category", ...SEVERITIES.map(label)]} rows={CATEGORIES.map((c) => [label(c), ...SEVERITIES.map((sv) => week.get(`${c}:${sv}`) ?? 0)])} />}>
          <SegmentRows series={SEVERITY_SERIES} unit="alerts" label="Families' alerts by category and severity, last 7 days"
            rows={CATEGORIES.map((c) => ({ label: label(c), values: Object.fromEntries(SEVERITIES.map((sv) => [sv, week.get(`${c}:${sv}`) ?? 0])) }))} />
        </ChartCard>
      </div>
    </>
  );
}
