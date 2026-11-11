import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { overview, overviewOps, overviewTrends } from "@/lib/console-queries";
import { ago, plural } from "../format";
import { StatGrid } from "../ui";
import { BarList, ChartCard, ColumnChart, DataTable, PLATFORM_COLOR, PLATFORM_NAME, SegmentedBar, dayLabels } from "../charts";

export const metadata = { title: "Dashboard" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const sum = (rows: { n: number }[]) => rows.reduce((a, r) => a + r.n, 0);

export default async function ConsoleHome() {
  await requireStaff();
  const [o, ops, t] = await Promise.all([overview(), overviewOps(), overviewTrends(30)]);
  const days = (rows: { day: string; n: number }[]) => rows.map((r) => ({ ...dayLabels(r.day), value: r.n }));
  const platforms = Object.keys(PLATFORM_COLOR).map((p) => ({ label: PLATFORM_NAME[p], value: t.platforms.find((x) => x.platform === p)?.n ?? 0, color: PLATFORM_COLOR[p] }));

  return (
    <>
      <h1 className="cn-h1">Dashboard</h1>
      {ops.cronStale || ops.lastRun?.failed.length ? (
        <section className="card card-pad" role="alert" style={{ borderColor: ops.cronStale ? "var(--crit)" : "var(--warn)" }}>
          <b>{ops.cronStale ? "The maintenance job isn't running." : `The last maintenance run had ${ops.lastRun?.failed.length} failed ${ops.lastRun?.failed.length === 1 ? "step" : "steps"}.`}</b>{" "}
          {ops.lastRun ? `Last run ${ago(ops.lastRun.startedAt)}. ` : ""}<Link className="inline-link" href="/alerts">See alerts</Link>
        </section>
      ) : null}

      <StatGrid stats={[
        { label: "Families", value: o.families, hint: `${o.week.toLocaleString("en-US")} new in 7 days · ${o.month.toLocaleString("en-US")} in 30`, href: "/families" },
        { label: "Parents", value: o.parents, href: "/parents" },
        { label: "Children", value: o.children, href: "/children" },
        { label: "Active subscriptions", value: ops.activeSubs, href: "/subscriptions?filter=active" },
        { label: "Devices", value: o.devices, hint: `Plus ${plural(o.browsers, "browser")}`, href: "/devices" },
        { label: "Offline over 24 hours", value: ops.offline, tone: ops.offline ? "warn" : undefined, href: "/devices?state=offline" },
        { label: "Changes stuck over 24 hours", value: ops.stuck, tone: ops.stuck ? "warn" : undefined, href: "/config-health" },
        { label: "Maintenance job", value: ops.lastRun ? ago(ops.lastRun.startedAt) : "Never", tone: ops.cronStale ? "bad" : ops.lastRun?.failed.length ? "warn" : "ok", hint: "Last run", href: "/status" },
        { label: "Open tickets", value: o.openTickets, href: "/tickets?status=OPEN" },
        { label: "Organizations", value: o.organizations, href: "/organizations" },
        { label: "Feature flags on", value: ops.flagsOn, href: "/flags" },
        { label: "Plans", value: o.plans.length, hint: o.plans.map((p) => p.plan).join(", "), href: "/subscriptions" },
      ]} />

      <div className="cn-grid2">
        <ChartCard title="New families" sub={`Sign-ups per day, last 30 days · ${sum(t.families).toLocaleString("en-US")} in all`}
          table={<DataTable head={["Day", "Families"]} rows={t.families.map((r) => [dayLabels(r.day).full, r.n])} />}>
          <ColumnChart data={days(t.families)} unit="families" label="New families per day, last 30 days" />
        </ChartCard>
        <ChartCard title="Devices paired" sub={`Phones, tablets and computers per day, last 30 days · ${sum(t.devices).toLocaleString("en-US")} in all`}
          table={<DataTable head={["Day", "Devices"]} rows={t.devices.map((r) => [dayLabels(r.day).full, r.n])} />}>
          <ColumnChart data={days(t.devices)} unit="devices" label="Devices paired per day, last 30 days" />
        </ChartCard>
        <ChartCard title="Families by plan" sub="Where every family is today"
          table={<DataTable head={["Plan", "Families"]} rows={o.plans.map((p) => [p.plan, p.families])} />}>
          <BarList rows={o.plans.map((p) => ({ label: p.plan, value: p.families }))} unit="families" label="Families by plan" />
        </ChartCard>
        <ChartCard title="Devices by platform" sub={plural(o.devices, "paired device")}
          table={<DataTable head={["Platform", "Devices"]} rows={platforms.map((p) => [p.label, p.value])} />}>
          <SegmentedBar parts={platforms} unit="devices" label="Devices by platform" />
        </ChartCard>
        <ChartCard wide title="Support tickets" sub={`Opened per day, last 30 days · ${sum(t.tickets).toLocaleString("en-US")} in all, ${o.openTickets.toLocaleString("en-US")} open now`}
          action={<Link className="btn btn-ghost btn-sm" href="/tickets?status=OPEN">Open tickets</Link>}
          table={<DataTable head={["Day", "Tickets"]} rows={t.tickets.map((r) => [dayLabels(r.day).full, r.n])} />}>
          <ColumnChart data={days(t.tickets)} unit="tickets" height={140} label="Support tickets opened per day, last 30 days" />
        </ChartCard>
      </div>
    </>
  );
}
