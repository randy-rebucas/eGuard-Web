import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { automationStats, outcomeReasons } from "@/lib/parent-care/metrics";
import { ARTICLES } from "@/lib/learn";
import { ACTIVITIES, tipKey } from "@/lib/parent-care/content";
import { CHANNEL_LABEL, CONTACT_LIMITS, automationByKey } from "@/lib/parent-care/definitions";
import { TEMPLATES, render } from "@/lib/parent-care/templates";
import { stamp } from "../../../../format";
import { AutomationSwitch } from "../../../../care-forms";
import { CareTabs, RateText } from "../../../../ui";

export async function generateMetadata(props: PageProps<"/console/care/automations/[key]">) {
  const { key } = await props.params;
  return { title: automationByKey(key)?.name ?? "Automation" };
}

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

/** Sample inputs, so staff can read each template as parents see it */
function sample(key: string) {
  const [a, b] = ACTIVITIES;
  switch (key) {
    case "briefing": return [{ params: { tipKey: tipKey(ARTICLES[0].slug, 0), activityKey: a.key } }];
    case "follow_up": return [{ params: { activityKey: a.key } }];
    case "weekly_plan": return [{ params: { activityKeys: [a.key, b.key] } }];
    case "check_in": return [0, 1, 2].map((step) => ({ params: { step, activityKey: a.key } }));
    case "monthly_report": return [{ params: { month: "2026-09" }, report: { month: "2026-09", completed: 2, started: 3, protectionChanges: 4, planWeeks: 4 } }];
    default: return [];
  }
}

export default async function CareAutomation(props: PageProps<"/console/care/automations/[key]">) {
  await requireStaff();
  const { key } = await props.params;
  const def = automationByKey(key);
  if (!def) notFound();
  const [stats, reasons] = await Promise.all([automationStats(), outcomeReasons(key)]);
  const s = stats.find((x) => x.def.key === key)!;
  const template = TEMPLATES.find((t) => t.key === def.templateKey)!;
  return (
    <>
      <h1 className="cn-h1">{def.name}</h1>
      <CareTabs active="/care/automations" />
      <div className="cn-split">
        <div className="cn-stack">
          <section className="card card-pad">
            <div className="card-head"><h2>Definition</h2>{s.enabled ? <span className="pill tone-ok">Running</span> : <span className="pill tone-warn">Paused</span>}</div>
            <p className="cn-muted">{def.description}</p>
            <dl className="cn-dl">
              <dt>Trigger</dt><dd>{def.trigger === "EVENT" ? "Event" : "Schedule"}: {def.schedule}</dd>
              <dt>Version</dt><dd>v{def.version}{s.liveVersion !== null && s.liveVersion !== def.version ? ` (database has v${s.liveVersion} until the next sync)` : ""}</dd>
              <dt>Channels</dt><dd>{def.channels.map((c) => CHANNEL_LABEL[c]).join(" → ")}: the first the parent allows, can receive and is under its limit. One channel per message.</dd>
              <dt>Parent&apos;s switch</dt><dd className="cn-mono">{def.toggle}</dd>
              <dt>Cooldown</dt><dd>{def.cooldownDays ? `${def.cooldownDays} days between two of these to one parent` : "None"}</dd>
              {def.steps ? <><dt>Steps</dt><dd>Day {def.steps.join(", day ")} of inactivity, each rechecked first</dd></> : null}
              {def.delayHours ? <><dt>Delay</dt><dd>{def.delayHours} hours after the activity was started, then outside quiet hours</dd></> : null}
              <dt>Global limits</dt><dd>Push and email: {CONTACT_LIMITS.outboundPerDay} a day, {CONTACT_LIMITS.outboundPer7Days} in 7 days. In-app: {CONTACT_LIMITS.inAppPerDay} a day, {CONTACT_LIMITS.inAppPer7Days} in 7 days. All automations together.</dd>
              <dt>Last change</dt><dd>{s.updatedBy ? `${s.updatedBy}, ${stamp(s.updatedAt)}` : "—"}</dd>
            </dl>
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2>{s.enabled ? "Pause" : "Resume"}</h2></div>
            <AutomationSwitch automationKey={key} enabled={s.enabled} pending={s.jobs.PENDING} />
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2>Last 30 days</h2></div>
            <dl className="cn-dl">
              <dt>Sent</dt><dd>{s.sent30.toLocaleString("en-US")}</dd>
              <dt>Clicked</dt><dd><RateText r={s.clicked} /></dd>
              <dt>Converted</dt><dd><RateText r={s.converted} /></dd>
              <dt>Jobs now</dt><dd>{Object.entries(s.jobs).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(" · ")}</dd>
              {key === "check_in" ? <><dt>Enrollments</dt><dd>{Object.entries(s.enrollments).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(" · ")}</dd></> : null}
            </dl>
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2>Why jobs didn&apos;t send</h2></div>
            {reasons.length ? (
              <div className="table-scroll">
                <table className="data-table cn-table">
                  <thead><tr><th>Outcome</th><th>Reason</th><th>Jobs</th></tr></thead>
                  <tbody>{reasons.map((r) => <tr key={`${r.status}:${r.reason}`}><td>{r.status.toLowerCase()}</td><td className="cn-mono">{r.reason}</td><td>{r.n.toLocaleString("en-US")}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="cn-muted">Nothing skipped or failed yet.</p>}
          </section>
        </div>
        <section className="card card-pad">
          <div className="card-head"><h2>Template</h2><span className="cn-muted">{template.key} v{template.version}</span></div>
          <p className="cn-muted">{Object.entries(template.copy).map(([lang, c]) => `${lang}: ${c!.approval === "APPROVED" ? "approved" : "waiting for review (sent in English until approved)"}`).join(" · ")}</p>
          {sample(key).map((input, i) => {
            const r = render(def.templateKey, "en", input);
            return r ? (
              <div key={i} className="cn-message" style={{ whiteSpace: "normal" }}>
                <b>{r.title}</b><br />{r.body}<br /><span className="cn-muted">Button: {r.cta} → {r.link}</span>
              </div>
            ) : null;
          })}
          <p className="cn-muted">Sample content. Real messages use the parent&apos;s next fresh tip or fitting activity, and never name a child.</p>
        </section>
      </div>
    </>
  );
}
