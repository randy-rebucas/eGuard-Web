import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dayLabel, dayTime } from "@/lib/format";
import { careActivities, careMessages, carePreferences, noteMessagesShown, notePlanOpened, type ActivityView } from "@/lib/parent-care/service";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead } from "@/components/ui";
import { ActivityButtons, CareMessages } from "@/components/care";

export const metadata = { title: "Safety plan" };

function PlanCard({ a }: { a: ActivityView }) {
  return (
    <article className="care-activity">
      <div className="row" style={{ gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <span className="pill tone-accent"><Icon name="hourglass" />About {a.minutes} min</span>
        {a.status === "STARTED" ? <span className="pill tone-warn">In progress</span> : a.status === "COMPLETED" ? <span className="pill tone-ok"><Icon name="check" />Done</span> : null}
      </div>
      <h3 style={{ fontSize: 17, margin: 0 }}><Link className="inline-link" href={`/plan/${a.key}`}>{a.title}</Link></h3>
      <p className="t-meta" style={{ margin: 0 }}>{a.why}</p>
      <ol className="guide-steps">{a.steps.slice(0, 3).map((s) => <li key={s}>{s}</li>)}</ol>
      {a.steps.length > 3 ? <Link className="link-btn" href={`/plan/${a.key}`}>All {a.steps.length} steps <Icon name="arrow-right" /></Link> : null}
      <ActivityButtons activityKey={a.key} status={a.status} due={a.due} compact />
    </article>
  );
}

/**
 * The Safety plan: this week's one or two activities, what's in progress, messages from eGuard (tips, plans,
 * reminders; never safety alerts, which stay in Notifications), more ideas and what's done.
 */
export default async function PlanPage() {
  const u = await requireUser();
  const [data, inbox, prefs] = await Promise.all([careActivities(u), careMessages(u, { limit: 10 }), carePreferences(u)]);
  const tz = prefs.effectiveTimezone;
  await Promise.all([notePlanOpened(u), noteMessagesShown(u, inbox.messages.filter((m) => m.channel === "IN_APP").map((m) => m.id))]);
  const week = dayLabel(data.week);
  const inProgress = data.inProgress.filter((a) => !data.plan.some((p) => p.key === a.key));

  return (
    <>
      <PageHead title="Safety plan" text="A few practical things to do with your family, at your own pace. Each one takes minutes, and links to the guide behind it.">
        <Link className="btn btn-ghost" href="/plan/report"><Icon name="chart-column" />Monthly summary</Link>
        <Link className="btn btn-ghost" href="/settings/notifications#tips"><Icon name="settings" />Tips and reminders</Link>
      </PageHead>

      <section className="card card-pad" aria-labelledby="plan-week">
        <div className="card-head">
          <div><h2 id="plan-week">This week</h2><p className="t-meta">Week of {week.date}{data.completedTotal ? ` · ${data.completedTotal} ${data.completedTotal === 1 ? "activity" : "activities"} done so far` : ""}</p></div>
        </div>
        {data.plan.length ? <div className="care-plan">{data.plan.map((a) => <PlanCard key={a.key} a={a} />)}</div>
          : <EmptyState icon="circle-check" title="Nothing new to suggest this week" text="You've done or set aside every activity that fits your family right now. Repeatable ones come back after a while." />}
      </section>

      {inProgress.length ? (
        <section className="card card-pad" aria-labelledby="plan-progress">
          <div className="card-head"><h2 id="plan-progress">In progress</h2></div>
          <ul className="care-list">
            {inProgress.map((a) => (
              <li key={a.key}>
                <div className="grow"><Link className="t-title inline-link" href={`/plan/${a.key}`}>{a.title}</Link><div className="t-meta">Started {dayTime(a.startedAt ? new Date(a.startedAt) : null, tz)}</div></div>
                <ActivityButtons activityKey={a.key} status={a.status} due={a.due} compact />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card card-pad" aria-labelledby="plan-inbox">
        <div className="card-head">
          <div><h2 id="plan-inbox">From eGuard</h2><p className="t-meta">Tips, plans and reminders. Safety alerts are in <Link className="inline-link" href="/notifications">Notifications</Link>.</p></div>
        </div>
        {prefs.enabled ? null : <p className="t-meta" role="status">Tips and reminders are off. <Link className="inline-link" href="/settings/notifications#tips">Turn them on</Link> to get a weekly plan and practical tips.</p>}
        <CareMessages messages={inbox.messages.map((m) => ({ ...m, when: dayTime(new Date(m.sentAt), tz), unread: m.channel === "IN_APP" && !m.openedAt }))} />
      </section>

      {data.suggested.length ? (
        <section className="card card-pad" aria-labelledby="plan-more">
          <div className="card-head"><h2 id="plan-more">More ideas</h2></div>
          <ul className="care-list">
            {data.suggested.map((a) => (
              <li key={a.key}>
                <div className="grow"><Link className="t-title inline-link" href={`/plan/${a.key}`}>{a.title}</Link><div className="t-meta">About {a.minutes} min · {a.why}</div></div>
                <ActivityButtons activityKey={a.key} status={a.status} due={a.due} compact />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.completed.length || data.dismissed.length ? (
        <section className="card card-pad" aria-labelledby="plan-done">
          <div className="card-head"><h2 id="plan-done">Done</h2></div>
          <ul className="care-list">
            {data.completed.map((a) => (
              <li key={a.key}>
                <span className="ico-tile ok"><Icon name="check" /></span>
                <div className="grow"><Link className="t-title inline-link" href={`/plan/${a.key}`}>{a.title}</Link><div className="t-meta">Done {dayTime(a.completedAt ? new Date(a.completedAt) : null, tz)}{a.repeatDays ? ` · worth repeating every ${a.repeatDays} days` : ""}</div></div>
                {a.due ? <ActivityButtons activityKey={a.key} status={a.status} due={a.due} compact /> : null}
              </li>
            ))}
            {data.dismissed.map((a) => (
              <li key={a.key}>
                <span className="ico-tile muted"><Icon name="eye-off" /></span>
                <div className="grow"><div className="t-title">{a.title}</div><div className="t-meta">Set aside: not shown in your plans</div></div>
                <ActivityButtons activityKey={a.key} status={a.status} due={a.due} compact />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
