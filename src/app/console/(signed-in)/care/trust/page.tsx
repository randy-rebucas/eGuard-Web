import { requireStaff } from "@/lib/staff-auth";
import { careAudit, trustOverview } from "@/lib/parent-care/metrics";
import { healthSignals } from "@/lib/parent-care/runner";
import { stamp } from "../../../format";
import { CareTabs, Empty } from "../../../ui";

export const metadata = { title: "Trust and compliance" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const SCOPE_LABEL = (s: string) => s === "ALL" ? "Everything" : s.startsWith("CHANNEL:") ? `${s.slice(8).replace("_", "-").toLowerCase()} channel` : s;

/** Consent, opt-outs and suppressions, channel readiness, contact limits, template approval and staff changes. Counts only. */
export default async function CareTrust() {
  await requireStaff();
  const [t, audit, health] = await Promise.all([trustOverview(), careAudit(), healthSignals()]);
  const p = t.prefs;
  return (
    <>
      <h1 className="cn-h1">Parent care</h1>
      <CareTabs active="/care/trust" />
      {health.optOutSpike || health.failureSpike ? (
        <section className="card card-pad" role="alert" style={{ borderColor: "var(--warn)" }}>
          <b>Needs a look:</b>{" "}
          {health.optOutSpike ? `${health.optOuts} opt-outs for ${health.sent} push and email messages in the last 24 hours. ` : ""}
          {health.failureSpike ? `${health.dead} jobs failed for good in the last 24 hours. ` : ""}
          Consider pausing the automation that sent them (Automations) while you find out why.
        </section>
      ) : null}
      <section className="card card-pad">
        <div className="card-head"><h2>Consent and preferences</h2></div>
        <dl className="cn-dl">
          <dt>Parents with preferences</dt><dd>{t.total.toLocaleString("en-US")}</dd>
          <dt>Tips and reminders on</dt><dd>{p?.enabled.toLocaleString("en-US") ?? 0} <span className="cn-muted">({p?.off.toLocaleString("en-US") ?? 0} turned everything off)</span></dd>
          <dt>In-app</dt><dd>{p?.inApp.toLocaleString("en-US") ?? 0}</dd>
          <dt>Push</dt><dd>{p?.push.toLocaleString("en-US") ?? 0} on <span className="cn-muted">· {p?.pushConsent.toLocaleString("en-US") ?? 0} with a consent time recorded</span></dd>
          <dt>Email</dt><dd>{p?.email.toLocaleString("en-US") ?? 0} on <span className="cn-muted">· {p?.emailConsent.toLocaleString("en-US") ?? 0} with a consent time recorded</span></dd>
          <dt>Holdout</dt><dd>{p?.holdout.toLocaleString("en-US") ?? 0} <span className="cn-muted">get no proactive messages</span></dd>
          <dt>Filipino chosen</dt><dd>{p?.fil.toLocaleString("en-US") ?? 0} <span className="cn-muted">get English until the Filipino templates are approved</span></dd>
        </dl>
        <p className="cn-muted" style={{ marginTop: 10 }}>Push and email are off until a parent turns them on; turning one on records when (their consent for this purpose), turning it off clears it. Nothing is sent without a consent time.</p>
      </section>
      <section className="card card-pad">
        <div className="card-head"><h2>Opt-outs and suppressions</h2></div>
        {t.suppressions.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Applies to</th><th>Reason</th><th>Parents</th></tr></thead>
              <tbody>{t.suppressions.map((s) => <tr key={`${s.scope}:${s.reason}`}><td>{SCOPE_LABEL(s.scope)}</td><td>{s.reason.toLowerCase().replace("_", " ")}</td><td>{s.n.toLocaleString("en-US")}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="cn-muted">None. Opt-outs made in Settings change the parent&apos;s preferences instead; an email&apos;s &ldquo;Stop these emails&rdquo; link also records one here.</p>}
      </section>
      <section className="card card-pad">
        <div className="card-head"><h2>Channels and limits</h2></div>
        <dl className="cn-dl">
          <dt>Push</dt><dd>{t.channels.push}</dd>
          <dt>Email</dt><dd>{t.channels.email}</dd>
          <dt>In-app</dt><dd>{t.channels.inApp}</dd>
          <dt>Contact limits</dt><dd>Push and email together: {t.limits.outboundPerDay} a day, {t.limits.outboundPer7Days} in any 7 days. In-app: {t.limits.inAppPerDay} a day, {t.limits.inAppPer7Days} in 7 days. Safety alerts aren&apos;t counted and never wait for these.</dd>
          <dt>Quiet hours</dt><dd>Each parent&apos;s own (default 9 PM to 7 AM): push and email wait until they end.</dd>
        </dl>
      </section>
      <section className="card card-pad">
        <div className="card-head"><h2>Templates</h2></div>
        <div className="table-scroll">
          <table className="data-table cn-table">
            <thead><tr><th>Template</th><th>Version</th><th>Languages</th></tr></thead>
            <tbody>{t.templates.map((x) => (
              <tr key={x.key}><td>{x.name}<br /><span className="cn-mono">{x.key}</span></td><td>v{x.version}</td>
                <td>{x.languages.map((l) => <span key={l.lang} className={`pill ${l.approval === "APPROVED" ? "tone-ok" : "tone-warn"}`} style={{ marginRight: 6 }}>{l.lang}: {l.approval === "APPROVED" ? "approved" : "needs review"}</span>)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="cn-muted" style={{ marginTop: 10 }}>Approval is a code change reviewed like any other (lib/parent-care/templates). Tips come from knowledge-center articles checked within the last 18 months; grooming and exploitation topics are never sent unasked.</p>
      </section>
      <section className="card">
        <div className="card-pad cn-head-flush card-head"><h2>Staff changes</h2></div>
        {audit.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Detail</th></tr></thead>
              <tbody>{audit.map((a) => <tr key={a.id}><td>{stamp(a.createdAt)}</td><td>{a.staff.name}</td><td className="cn-mono">{a.action}</td><td>{[a.target, a.detail].filter(Boolean).join(" · ") || "—"}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <Empty>No changes yet.</Empty>}
      </section>
    </>
  );
}
