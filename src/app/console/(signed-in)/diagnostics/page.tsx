import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { diagnosticsSummary } from "@/lib/console-queries";
import { isBelowVersion, minChildAppVersion } from "@/lib/child-app";
import { ago, label, pct, plural } from "../../format";
import { Empty, StatGrid } from "../../ui";
import { BarList, ChartCard, DataTable, PLATFORM_COLOR, PLATFORM_NAME, SegmentedBar, withPlatform } from "../../charts";

export const metadata = { title: "Device diagnostics" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/** What the extension reports, as states: protected is good, anything needing attention a warning, none yet neutral. */
const BROWSER_STATE_COLOR = (state: string | null) => !state ? "var(--viz-neutral)" : state === "PROTECTED" ? "var(--viz-good)" : "var(--viz-warning)";

/** Every device and browser at once: versions in use, devices gone quiet, browsers behind on their rules. */
export default async function DiagnosticsPage() {
  await requireStaff();
  const s = await diagnosticsSummary();
  const platforms = Object.keys(PLATFORM_COLOR).map((p) => ({ label: PLATFORM_NAME[p], value: s.platforms.find((x) => x.platform === p)?.n ?? 0, color: PLATFORM_COLOR[p] }));
  const online = s.total - s.offline - s.never;
  const health = [
    { label: "Online in 24 hours", value: online, color: "var(--viz-good)" },
    { label: "Offline over 24 hours", value: s.offline, color: "var(--viz-warning)" },
    { label: "Never synced", value: s.never, color: "var(--viz-neutral)" },
  ];
  const apps = s.appVersions.map((v) => {
    const old = isBelowVersion(v.version, minChildAppVersion(v.platform));
    return { label: `${PLATFORM_NAME[v.platform] ?? label(v.platform)} ${v.version ?? "unknown"}${old ? " (below minimum)" : ""}`, value: v.n, color: old ? "var(--viz-critical)" : undefined };
  });

  return (
    <>
      <h1 className="cn-h1">Device diagnostics</h1>
      <p className="cn-muted">Open a device from <Link className="inline-link" href="/devices">Devices</Link> to see its own checks and changes.</p>
      <StatGrid stats={[
        { label: "Devices", value: s.total, href: "/devices" },
        { label: "Offline over 24 hours", value: s.offline, hint: `${pct(s.offline, s.total)} of devices`, tone: s.offline ? "warn" : undefined, href: "/devices?state=offline" },
        { label: "Never synced", value: s.never, href: "/devices?state=never" },
        { label: "Being removed", value: s.removing, href: "/devices?state=removing" },
        { label: "Phones and tablets without push", value: s.noPush, hint: "Changes wait for their next poll" },
        { label: "Browsers", value: s.browsers, href: "/devices?view=browsers" },
        { label: "Browsers behind on rules", value: s.behindOnPolicy, tone: s.behindOnPolicy ? "warn" : undefined, hint: "Not on the latest rules version" },
        { label: "Went quiet this month", value: s.quiet.length, hint: "Offline, but seen in 30 days" },
      ]} />

      <div className="cn-grid2">
        <ChartCard title="Check-ins" sub={`${plural(s.total, "device")} by when they last synced`}
          table={<DataTable head={["State", "Devices"]} rows={health.map((h) => [h.label, h.value])} />}>
          <SegmentedBar parts={health} unit="devices" label="Devices by last check-in" />
        </ChartCard>
        <ChartCard title="Platforms" sub="Paired devices by platform"
          table={<DataTable head={["Platform", "Devices"]} rows={platforms.map((p) => [p.label, p.value])} />}>
          <SegmentedBar parts={platforms} unit="devices" label="Devices by platform" />
        </ChartCard>
        <ChartCard title="eGuard app versions" sub="Versions below CHILD_MIN_APP_VERSION are marked"
          table={<DataTable head={["Version", "Devices"]} rows={apps.map((a) => [a.label, a.value])} />}>
          {apps.length ? <BarList rows={apps} unit="devices" label="Devices by app version" /> : <Empty>No devices.</Empty>}
        </ChartCard>
        <ChartCard title="Browser extension" sub={`${plural(s.browsers, "connected browser")}`}
          table={<DataTable head={["State or version", "Browsers"]} rows={[...s.browserStates.map((b) => [b.state ? label(b.state) : "No report yet", b.n]), ...s.extensionVersions.map((v) => [`Version ${v.version}`, v.n])]} />}>
          {s.browsers ? (
            <div className="cn-stack-charts">
              <SegmentedBar parts={s.browserStates.map((b) => ({ label: b.state ? label(b.state) : "No report yet", value: b.n, color: BROWSER_STATE_COLOR(b.state) }))} unit="browsers" label="Browsers by protection state" />
              <BarList rows={s.extensionVersions.map((v) => ({ label: `Version ${v.version}`, value: v.n }))} unit="browsers" label="Browsers by extension version" />
            </div>
          ) : <Empty>No browsers.</Empty>}
        </ChartCard>
        <ChartCard wide title="OS versions" sub="Paired devices by operating system version"
          table={<DataTable head={["Version", "Devices"]} rows={s.osVersions.map((v) => [withPlatform(v.platform, v.version), v.n])} />}>
          {s.osVersions.length
            ? <BarList rows={s.osVersions.slice(0, 12).map((v) => ({ label: withPlatform(v.platform, v.version), value: v.n }))} unit="devices" label="Devices by OS version" />
            : <Empty>No devices.</Empty>}
        </ChartCard>
      </div>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Went quiet in the last 30 days</h2></div>
        {s.quiet.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Device</th><th>Platform</th><th>App</th><th>Family</th><th>Last seen</th></tr></thead>
              <tbody>
                {s.quiet.map((d) => (
                  <tr key={d.id}>
                    <td><Link prefetch={false} className="inline-link" href={`/devices/${d.id}`}>{d.name}</Link> <span className="cn-muted">· {d.model}</span></td>
                    <td>{PLATFORM_NAME[d.platform] ?? label(d.platform)}</td>
                    <td className="cn-mono">{d.appVersion ?? "—"}</td>
                    <td><Link prefetch={false} className="inline-link" href={`/families/${d.family.id}`}>{d.family.name}</Link></td>
                    <td>{ago(d.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Every device seen in the last 30 days checked in within 24 hours.</Empty>}
      </section>
    </>
  );
}
