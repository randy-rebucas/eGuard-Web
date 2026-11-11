import Link from "next/link";
import { notFound } from "next/navigation";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { deviceDiagnostics } from "@/lib/console-queries";
import { OFFLINE_AFTER_MS } from "@/lib/health";
import { PROTECTION_BY_KEY } from "@/lib/protections";
import { isBelowVersion, minChildAppVersion } from "@/lib/child-app";
import { ago, day, label, num, stamp } from "../../../format";
import { CheckPill, Empty, OkPill, SeenPill } from "../../../ui";

export const metadata = { title: "Device diagnostics" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/**
 * One device's technical state, for support: versions, last check-in, each protection's check result, and whether
 * parents' changes are reaching it. Not what the rules are, and nothing the child did.
 */
export default async function DevicePage(props: PageProps<"/console/devices/[id]">) {
  const staff = await requireStaff();
  const { id } = await props.params;
  const d = await deviceDiagnostics(id);
  if (!d) notFound();
  await logStaff(staff.id, "device.view", `device:${d.id}`);
  const min = minChildAppVersion(d.platform);
  const old = isBelowVersion(d.appVersion, min);
  return (
    <>
      <div>
        <p className="cn-eyebrow"><Link className="inline-link" href="/devices">Devices</Link> · <Link prefetch={false} className="inline-link" href={`/families/${d.family.id}`}>{d.family.name}</Link></p>
        <h1 className="cn-h1">{d.name}</h1>
        <p className="cn-muted cn-mono">{d.id}</p>
      </div>

      <section className="card card-pad">
        <div className="card-head"><h2>Device</h2></div>
        <dl className="cn-dl">
          <dt>Status</dt>
          <dd>{d.removalRequestedAt ? <span className="pill tone-warn">Being removed since {day(d.removalRequestedAt)}</span> : <SeenPill at={d.lastSeenAt} afterMs={OFFLINE_AFTER_MS} />}{d.simulated ? <> <span className="pill tone-muted">Simulated</span></> : null}</dd>
          <dt>Last seen</dt><dd>{stamp(d.lastSeenAt)} <span className="cn-muted">({ago(d.lastSeenAt)})</span></dd>
          <dt>Model</dt><dd>{d.model} · {label(d.kind)}{d.isPrimary ? " · primary" : ""}</dd>
          <dt>Platform</dt><dd>{label(d.platform)} {d.osVersion}</dd>
          <dt>eGuard app</dt><dd className={old ? "cn-warn-text" : undefined}>{d.appVersion ?? "—"}{min ? <span className="cn-muted"> (minimum {min}{old ? ": needs an update" : ""})</span> : null}</dd>
          <dt>Battery</dt><dd>{d.battery === null ? "—" : `${d.battery}%`}</dd>
          <dt>Push wake-up</dt><dd>{d.kind === "COMPUTER" ? <span className="cn-muted">Not used: the agent polls</span> : <OkPill ok={d.hasPushToken} yes="Registered" no="No token: changes wait for its next poll" />}</dd>
          {d.accounts ? <><dt>Windows accounts</dt><dd>{d.accounts.enforced} of {d.accounts.total} with the child&apos;s rules</dd></> : null}
          <dt>Check requested</dt><dd>{stamp(d.checkRequestedAt)}</dd>
          <dt>Child</dt><dd>{d.child.name}</dd>
          <dt>Family</dt><dd><Link prefetch={false} className="inline-link" href={`/families/${d.family.id}`}>{d.family.name}</Link> · {d.family.plan}</dd>
          <dt>Paired</dt><dd>{stamp(d.createdAt)}</dd>
        </dl>
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Configuration health</h2></div>
        {d.protections.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Protection</th><th>Result</th><th>Message</th><th>Verified</th></tr></thead>
              <tbody>
                {d.protections.map((p) => (
                  <tr key={p.key}>
                    <td>{PROTECTION_BY_KEY[p.key]?.checkName ?? label(p.key)}</td>
                    <td><CheckPill status={p.status} /></td>
                    <td>{p.message ?? ""}</td>
                    <td>{stamp(p.lastVerifiedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>The device hasn&apos;t reported any checks yet.</Empty>}
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Changes sent to it</h2></div>
        <div className="card-pad" style={{ paddingTop: 0 }}>
          <div className="cn-counts">
            {d.requestCounts.length ? d.requestCounts.map((r) => <span key={r.status}><CheckPill status={r.status} /> {num(r.n)}</span>) : <span className="cn-muted">None yet.</span>}
          </div>
        </div>
        {d.requests.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Protection</th><th>How</th><th>State</th><th>Why it failed</th><th>Sent</th><th>Delivered</th></tr></thead>
              <tbody>
                {d.requests.map((r) => (
                  <tr key={r.id}>
                    <td>{PROTECTION_BY_KEY[r.key]?.checkName ?? label(r.key)}</td>
                    <td>{r.mode === "GUIDED" ? "Parent steps" : "Applied by eGuard"}</td>
                    <td><CheckPill status={r.status} /></td>
                    <td>{r.failureReason ?? ""}</td>
                    <td>{stamp(r.createdAt)} <span className="cn-muted">({ago(r.createdAt)})</span></td>
                    <td>{stamp(r.deliveredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Nothing waiting or failed.</Empty>}
      </section>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Recent health checks</h2></div>
        {d.checks.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Started</th><th>Reached the device</th><th>Issues found</th><th>Reported</th></tr></thead>
              <tbody>
                {d.checks.map((c, i) => (
                  <tr key={i}>
                    <td>{stamp(c.run.createdAt)}</td>
                    <td>{c.reachable === null ? (c.run.status === "RUNNING" ? "Waiting" : "No answer") : <OkPill ok={c.reachable} bad />}</td>
                    <td>{c.issues ?? "—"}</td>
                    <td>{stamp(c.reportedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No checks run on it yet.</Empty>}
      </section>

      {d.browsers.length ? (
        <section className="card">
          <div className="card-head card-pad cn-head-flush"><h2>Browsers on it</h2></div>
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Browser</th><th>Extension</th><th>State</th><th>Rules version</th><th>Last health report</th><th>Last seen</th></tr></thead>
              <tbody>
                {d.browsers.map((b) => {
                  const current = b.child.browserPolicy?.version ?? null;
                  const behind = current !== null && (b.appliedPolicyVersion ?? 0) < current;
                  return (
                    <tr key={b.id}>
                      <td>{b.browser} {b.browserVersion ?? ""}</td>
                      <td className="cn-mono">{b.extensionVersion}</td>
                      <td>{b.revokedAt ? <span className="pill tone-crit">Disconnected</span> : label(b.protectionState)}</td>
                      <td className={behind ? "cn-warn-text" : undefined}>{b.appliedPolicyVersion ?? "—"}{current !== null ? ` of ${current}` : ""}</td>
                      <td>{stamp(b.lastHealthAt)}</td>
                      <td>{stamp(b.lastSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
