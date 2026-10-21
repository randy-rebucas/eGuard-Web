import { requireStaff } from "@/lib/staff-auth";
import { engagementOverview } from "@/lib/parent-care/metrics";
import { CHANNEL_LABEL } from "@/lib/parent-care/definitions";
import { CareTabs, RateText } from "../../ui";

export const metadata = { title: "Parent care" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/**
 * Engagement overview. Aggregates only. Treatment and holdout are compared side by side: the holdout group gets no
 * proactive messages, so the difference between them is what the automations add.
 */
export default async function CareOverview() {
  await requireStaff();
  const o = await engagementOverview();
  const stats = [
    { label: "Weekly active families", value: o.weeklyActiveFamilies, hint: "A qualifying action in the last 7 days" },
    { label: "Inactive 7+ days", value: (o.eligibleInactive.TREATMENT ?? 0) + (o.eligibleInactive.HOLDOUT ?? 0), hint: `${o.eligibleInactive.HOLDOUT ?? 0} in holdout` },
    { label: "Reactivated (30 days)", value: o.reactivated30, hint: "Came back with a qualifying action after 7+ days" },
    { label: "Activities done (30 days)", value: o.completed30, hint: `${o.started30} started` },
  ];
  const cohortRow = (label: string, r: { TREATMENT: { n: number; of: number; pct: number | null }; HOLDOUT: { n: number; of: number; pct: number | null } }, how: string) => (
    <tr key={label}><td><b>{label}</b><br /><span className="cn-muted">{how}</span></td><td><RateText r={r.TREATMENT} /></td><td><RateText r={r.HOLDOUT} /></td></tr>
  );
  return (
    <>
      <h1 className="cn-h1">Parent care</h1>
      <CareTabs active="/care" />
      <p className="cn-muted">Tips, weekly plans, activity reminders, check-ins and monthly summaries (docs/features/parent-care.md). A qualifying action is a real change in eGuard (a protection, an app decision, a child or device, an activity); opening the app never counts.</p>
      <div className="cn-stats">
        {stats.map((s) => (
          <div key={s.label} className="card cn-stat" title={s.hint}>
            <span className="cn-stat-value num">{s.value.toLocaleString("en-US")}</span>
            <span className="cn-stat-label">{s.label}</span>
            <span className="cn-muted" style={{ fontSize: 12 }}>{s.hint}</span>
          </div>
        ))}
      </div>

      <section className="card card-pad">
        <div className="card-head"><h2>Retention and reactivation</h2></div>
        <p className="cn-muted">Holdout: {o.holdoutPct}% of parents, chosen when their preferences were made, get no proactive messages. Compare the columns, not this month with last: a before-and-after can&apos;t tell what the automations did. Small numbers swing a lot; wait for a few hundred in each column.</p>
        <div className="table-scroll">
          <table className="data-table cn-table">
            <thead><tr><th>Measure</th><th>Treatment</th><th>Holdout</th></tr></thead>
            <tbody>
              {cohortRow("7-day retention", o.retention7, "Of parents who signed up 8–37 days ago: a qualifying action on days 1–7")}
              {cohortRow("30-day retention", o.retention30, "Of parents who signed up 31–60 days ago: a qualifying action on days 23–30")}
              {cohortRow("Reactivation within 7 days", o.reactivation, "Of parents inactive 7+ days (enrolled 7–60 days ago): back within 7 days of enrolling")}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-pad">
        <div className="card-head"><h2>Activities</h2></div>
        <dl className="cn-dl">
          <dt>Completion rate</dt><dd><RateText r={o.completion} /> <span className="cn-muted">of activities started 7–37 days ago, done within 7 days</span></dd>
          <dt>Last 30 days</dt><dd>{o.started30.toLocaleString("en-US")} started, {o.completed30.toLocaleString("en-US")} done</dd>
        </dl>
      </section>

      <section className="card card-pad">
        <div className="card-head"><h2>Messages (last 30 days)</h2></div>
        <div className="table-scroll">
          <table className="data-table cn-table">
            <thead><tr><th>Channel</th><th>Sent</th><th>Opened</th><th>Clicked</th><th>Opt-out rate</th></tr></thead>
            <tbody>
              {o.channels.map((c) => (
                <tr key={c.channel}>
                  <td>{CHANNEL_LABEL[c.channel]}</td><td>{c.sent.toLocaleString("en-US")}</td>
                  <td>{c.channel === "EMAIL" ? <span className="cn-muted">Not tracked (no pixels)</span> : <RateText r={c.opened} />}</td>
                  <td><RateText r={c.clicked} /></td><td><RateText r={c.optOut} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cn-muted" style={{ marginTop: 10 }}>Opt-out rate: parents turning a channel off (in Settings or from an email&apos;s link) per message sent on it. {o.optOutsAll.toLocaleString("en-US")} turned all tips and reminders off. Push opens depend on the app reporting them.</p>
      </section>
    </>
  );
}
