import { Fragment } from "react";
import { requireStaff } from "@/lib/staff-auth";
import { securityOverview } from "@/lib/console-queries";
import { endStaffSessionById } from "@/app/actions/console";
import { ago, label, num, pct, stamp } from "../../format";
import { Empty, OkPill } from "../../ui";
import { SegmentedBar } from "../../charts";

export const metadata = { title: "Security" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/** Who can use the console and who is signed in now, failed staff sign-ins, and how parents protect their accounts. */
export default async function SecurityPage() {
  const me = await requireStaff();
  const s = await securityOverview();
  const p = s.parents;
  return (
    <>
      <h1 className="cn-h1">Security</h1>

      <section className="card">
        <div className="card-head card-pad cn-head-flush"><h2>Signed in to the console now</h2></div>
        {s.sessions.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Staff</th><th>Browser</th><th>Address</th><th>Signed in</th><th>Last request</th><th /></tr></thead>
              <tbody>
                {s.sessions.map((x) => (
                  <tr key={x.id}>
                    <td title={x.staff.email}>{x.staff.name}{x.id === me.sessionId ? <span className="cn-muted"> (this browser)</span> : null}</td>
                    <td className="cn-muted">{x.userAgent ?? "—"}</td>
                    <td className="cn-mono">{x.ip ?? "—"}</td>
                    <td>{stamp(x.createdAt)}</td>
                    <td>{ago(x.lastSeenAt)}</td>
                    <td>
                      {x.id === me.sessionId ? null : (
                        <form action={endStaffSessionById} className="cn-inline-form">
                          <input type="hidden" name="id" value={x.id} />
                          <button className="btn btn-ghost btn-sm">End session</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Nobody else is signed in.</Empty>}
        <p className="cn-muted card-pad" style={{ paddingTop: 10 }}>{num(s.logins)} staff sign-ins in the last 7 days. Sessions end after 12 hours, or 30 minutes without a request.</p>
      </section>

      <div className="cn-grid2">
        <section className="card">
          <div className="card-head card-pad cn-head-flush"><h2>Staff accounts</h2></div>
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Name</th><th>Email</th><th>Active</th><th>Last sign-in</th></tr></thead>
              <tbody>
                {s.staff.map((x) => (
                  <tr key={x.id}><td>{x.name}</td><td>{x.email}</td><td><OkPill ok={x.active} no="Deactivated" /></td><td>{stamp(x.lastLoginAt)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cn-muted card-pad" style={{ paddingTop: 10 }}>Accounts are created, reset and deactivated with <span className="cn-mono">scripts/create-staff.ts</span>.</p>
        </section>

        <section className="card">
          <div className="card-head card-pad cn-head-flush"><h2>Failed staff sign-ins (last 15 minutes)</h2></div>
          {s.staffLimits.length ? (
            <div className="table-scroll">
              <table className="data-table cn-table">
                <thead><tr><th>By</th><th className="cn-num">Failures</th><th>Counter resets</th></tr></thead>
                <tbody>
                  {s.staffLimits.map((l) => (
                    <tr key={l.key}>
                      <td className="cn-mono">{l.key.replace(/^staff:acct:/, "email ").replace(/^staff:ip:/, "address ")}</td>
                      <td className="cn-num">{num(l.count)}</td>
                      <td>{stamp(l.resetAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>None.</Empty>}
          <p className="cn-muted card-pad" style={{ paddingTop: 10 }}>5 failures lock an email and 20 an address for 15 minutes.</p>
        </section>

        <section className="card card-pad">
          <div className="card-head"><h2>Parents&apos; accounts</h2></div>
          <div style={{ marginBottom: 18 }}>
            <SegmentedBar unit="parents" label="Parents with two-step verification" parts={[
              { label: "Two-step on", value: p.twoFactor, color: "var(--viz-good)" },
              { label: "Two-step off", value: p.total - p.twoFactor, color: "var(--viz-neutral)" },
            ]} />
          </div>
          <dl className="cn-dl">
            <dt>Two-step verification</dt><dd>{num(p.twoFactor)} of {num(p.total)} parents ({pct(p.twoFactor, p.total)})</dd>
            <dt>Admins with two-step</dt><dd>{num(p.adminsTwoFactor)} of {num(p.admins)} ({pct(p.adminsTwoFactor, p.admins)})</dd>
            <dt>No password set</dt><dd>{num(p.noPassword)} <span className="cn-muted">(sign in with Google or Apple only)</span></dd>
            {p.providers.map((x) => <Fragment key={x.provider}><dt>{label(x.provider)} sign-in</dt><dd>{num(x.n)}</dd></Fragment>)}
          </dl>
        </section>

        <section className="card">
          <div className="card-head card-pad cn-head-flush"><h2>Rate limits in force</h2></div>
          {s.scopes.length ? (
            <div className="table-scroll">
              <table className="data-table cn-table">
                <thead><tr><th>Limit</th><th className="cn-num">Counters</th></tr></thead>
                <tbody>{s.scopes.map((x) => <tr key={x.scope}><td className="cn-mono">{x.scope}</td><td className="cn-num">{num(x.n)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <Empty>No limits counting right now.</Empty>}
          <p className="cn-muted card-pad" style={{ paddingTop: 10 }}>Sign-in, sign-up and other limits with counters open now, across the site. A sudden jump may mean someone is guessing passwords.</p>
        </section>
      </div>
    </>
  );
}
