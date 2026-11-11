import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { PLATFORMS, isBrowserFilter, isDeviceFilter, isPlatform, listBrowsers, listDevices } from "@/lib/console-queries";
import { OFFLINE_AFTER_MS } from "@/lib/health";
import { isBelowVersion, minChildAppVersion } from "@/lib/child-app";
import { beforeParam, day, label, stamp } from "../../format";
import { Empty, FilterTabs, Pager, SeenPill } from "../../ui";

export const metadata = { title: "Devices" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/** Paired phones, tablets and computers, and connected browsers: what they are and when they last checked in. */
export default async function DevicesPage(props: PageProps<"/console/devices">) {
  await requireStaff();
  const sp = await props.searchParams;
  const view = sp.view === "browsers" ? "browsers" : "devices";
  const before = beforeParam(sp.before);
  const views = <FilterTabs label="Devices or browsers" base="/devices" param="view" value={view === "browsers" ? "browsers" : ""} options={[{ value: "", label: "Devices" }, { value: "browsers", label: "Browsers" }]} />;

  if (view === "browsers") {
    const state = isBrowserFilter(sp.state) ? sp.state : null;
    const { rows, nextBefore } = await listBrowsers(state, before);
    return (
      <>
        <h1 className="cn-h1">Devices</h1>
        {views}
        <FilterTabs label="Filter browsers" base="/devices" param="state" value={state ?? ""} query={{ view }}
          options={[{ value: "", label: "All" }, { value: "offline", label: "Offline" }, { value: "revoked", label: "Disconnected for security" }]} />
        <section className="card">
          {rows.length ? (
            <div className="table-scroll">
              <table className="data-table cn-table">
                <thead><tr><th>Browser</th><th>Label</th><th>Child</th><th>Family</th><th>Extension</th><th>State</th><th>Rules</th><th>Last seen</th></tr></thead>
                <tbody>
                  {rows.map((b) => {
                    const current = b.child.browserPolicy?.version ?? null;
                    const behind = current !== null && (b.appliedPolicyVersion ?? 0) < current;
                    return (
                      <tr key={b.id}>
                        <td>{b.browser} {b.browserVersion ?? ""} <span className="cn-muted">· {b.platform}</span></td>
                        <td>{b.deviceId ? <Link prefetch={false} className="inline-link" href={`/devices/${b.deviceId}`}>{b.deviceLabel}</Link> : b.deviceLabel}</td>
                        <td>{b.child.name}</td>
                        <td><Link prefetch={false} className="inline-link" href={`/families/${b.family.id}`}>{b.family.name}</Link></td>
                        <td className="cn-mono">{b.extensionVersion}</td>
                        <td>{b.revokedAt ? <span className="pill tone-crit">Disconnected</span> : label(b.protectionState) }</td>
                        <td className={behind ? "cn-warn-text" : undefined}>{b.appliedPolicyVersion ?? "—"}{current !== null ? ` of ${current}` : ""}</td>
                        <td>{b.revokedAt ? `Disconnected ${day(b.revokedAt)}` : <><SeenPill at={b.lastSeenAt} afterMs={OFFLINE_AFTER_MS} /> <span className="cn-muted">{stamp(b.lastSeenAt)}</span></>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty>No browsers here.</Empty>}
        </section>
        <Pager nextBefore={nextBefore} paged={!!before} query={{ view, state: state ?? "" }} />
      </>
    );
  }

  const state = isDeviceFilter(sp.state) ? sp.state : null;
  const platform = isPlatform(sp.platform) ? sp.platform : null;
  const { rows, nextBefore } = await listDevices(state, platform, before);
  return (
    <>
      <h1 className="cn-h1">Devices</h1>
      {views}
      <FilterTabs label="Filter by state" base="/devices" param="state" value={state ?? ""} query={{ platform: platform ?? "" }}
        options={[{ value: "", label: "All" }, { value: "offline", label: "Offline over 24 h" }, { value: "never", label: "Never synced" }, { value: "removing", label: "Being removed" }]} />
      <FilterTabs label="Filter by platform" base="/devices" param="platform" value={platform ?? ""} query={{ state: state ?? "" }}
        options={[{ value: "", label: "Every platform" }, ...PLATFORMS.map((p) => ({ value: p, label: label(p) }))]} />
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Device</th><th>Platform</th><th>OS</th><th>App</th><th>Child</th><th>Family</th><th>Status</th><th>Last seen</th></tr></thead>
              <tbody>
                {rows.map((d) => {
                  const old = isBelowVersion(d.appVersion, minChildAppVersion(d.platform));
                  return (
                    <tr key={d.id}>
                      <td><Link prefetch={false} className="inline-link" href={`/devices/${d.id}`}>{d.name}</Link> <span className="cn-muted">· {d.model}</span></td>
                      <td>{label(d.platform)} <span className="cn-muted">· {label(d.kind)}</span></td>
                      <td>{d.osVersion}</td>
                      <td className={old ? "cn-warn-text" : "cn-mono"} title={old ? "Older than the minimum supported version" : undefined}>{d.appVersion ?? "—"}</td>
                      <td>{d.child.name}</td>
                      <td><Link prefetch={false} className="inline-link" href={`/families/${d.family.id}`}>{d.family.name}</Link></td>
                      <td>{d.removalRequestedAt ? <span className="pill tone-warn">Being removed</span> : d.simulated ? <span className="pill tone-muted">Simulated</span> : <SeenPill at={d.lastSeenAt} afterMs={OFFLINE_AFTER_MS} />}</td>
                      <td>{stamp(d.lastSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No devices here.</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} query={{ state: state ?? "", platform: platform ?? "" }} />
    </>
  );
}
