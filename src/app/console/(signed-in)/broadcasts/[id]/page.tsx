import Link from "next/link";
import { notFound } from "next/navigation";
import { logStaff, requireStaff } from "@/lib/staff-auth";
import { broadcastDetail, broadcastProblems } from "@/lib/console-queries";
import { AUDIENCE_OPTIONS, AUDIENCE_LABEL, KIND_LABEL, PLAN_NAMES, audienceNoun, broadcastEmail, consoleTimeValue, countAudience, deliveryCounts, type BroadcastAudience, type BroadcastKind } from "@/lib/broadcasts";
import { AI_PROVIDER_LABEL, aiProvider } from "@/lib/broadcast-ai";
import { cancelBroadcast, deleteBroadcast, unscheduleBroadcast } from "@/app/actions/console";
import { BroadcastEditor, SendForm, TestForm } from "../../../broadcast-forms";
import { stamp } from "../../../format";
import { BroadcastPill } from "../../../ui";

export const metadata = { title: "Email" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const aiLabel = () => { const p = aiProvider(); return p ? AI_PROVIDER_LABEL[p] : null; };

const COUNT_TONES: [string, string, string][] = [
  ["SENT", "Sent", "tone-ok"], ["PENDING", "Waiting", "tone-accent"], ["SENDING", "Sending", "tone-warn"],
  ["FAILED", "Failed", "tone-crit"], ["SKIPPED", "Skipped", "tone-muted"],
];

export default async function BroadcastPage(props: PageProps<"/console/broadcasts/[id]">) {
  const staff = await requireStaff();
  const { id } = await props.params;
  const b = await broadcastDetail(id);
  if (!b) notFound();
  await logStaff(staff.id, "broadcast.view", `broadcast:${b.id}`);
  const isDraft = b.status === "DRAFT";
  const [audience, counts, problems] = await Promise.all([
    b.status === "DRAFT" || b.status === "SCHEDULED" ? countAudience(b) : null,
    deliveryCounts([b.id]).then((m) => m.get(b.id) ?? {}),
    b.recipients ? broadcastProblems(b.id) : [],
  ]);
  const preview = broadcastEmail(b, staff.name.split(/\s+/)[0], null);
  return (
    <>
      <div>
        <p className="cn-eyebrow"><Link className="inline-link" href="/broadcasts">Email</Link></p>
        <h1 className="cn-h1">{b.subject}</h1>
      </div>
      <div className="cn-split">
        <div className="cn-stack">
          <section className="card card-pad">
            <div className="card-head">
              <BroadcastPill status={b.status} />
              <div className="cn-actions">
                {b.status === "SCHEDULED" ? (
                  <form action={unscheduleBroadcast}><input type="hidden" name="id" value={b.id} /><button className="btn btn-secondary btn-sm">Back to draft</button></form>
                ) : null}
                {b.status === "SCHEDULED" || b.status === "SENDING" ? (
                  <form action={cancelBroadcast}><input type="hidden" name="id" value={b.id} /><button className="btn btn-secondary btn-sm">{b.status === "SENDING" ? "Stop sending" : "Cancel"}</button></form>
                ) : null}
                {isDraft ? (
                  <form action={deleteBroadcast}><input type="hidden" name="id" value={b.id} /><button className="btn btn-ghost btn-sm">Delete draft</button></form>
                ) : null}
              </div>
            </div>
            <dl className="cn-dl">
              <dt>To</dt><dd>{AUDIENCE_LABEL[b.audience as BroadcastAudience] ?? b.audience}</dd>
              <dt>Kind</dt><dd>{KIND_LABEL[b.kind as BroadcastKind] ?? b.kind}</dd>
              {b.audience === "PARENTS" ? <><dt>Plans</dt><dd>{b.plans.length ? b.plans.join(", ") : "Every plan"}</dd></> : null}
              {audience !== null ? (
                <><dt>Would reach</dt><dd>{audience.toLocaleString("en-US")} {audienceNoun(b.audience, audience)} now ({b.audience === "PARENTS" ? `verified email${b.kind === "SERVICE" ? "" : ", product updates on"}` : "confirmed by email"})</dd></>
              ) : null}
              {b.recipients ? <><dt>Recipients</dt><dd>{b.recipients.toLocaleString("en-US")}</dd></> : null}
              <dt>Written by</dt><dd>{b.createdBy.name}, {stamp(b.createdAt)}</dd>
              {b.scheduledAt ? <><dt>{b.status === "SCHEDULED" ? "Sends at" : "Scheduled for"}</dt><dd>{stamp(b.scheduledAt)}</dd></> : null}
              {b.startedAt ? <><dt>Started</dt><dd>{stamp(b.startedAt)}</dd></> : null}
              {b.finishedAt ? <><dt>{b.status === "CANCELLED" ? "Cancelled" : "Finished"}</dt><dd>{stamp(b.finishedAt)}</dd></> : null}
            </dl>
            {b.recipients ? (
              <div className="cn-counts">
                {COUNT_TONES.filter(([k]) => counts[k]).map(([k, label, tone]) => (
                  <span key={k} className={`pill ${tone}`}>{label}: {counts[k].toLocaleString("en-US")}</span>
                ))}
              </div>
            ) : null}
            {b.status === "SCHEDULED" ? <p className="cn-muted" style={{ marginTop: 12 }}>The recipient list is taken when sending starts. To edit it, move it back to draft.</p> : null}
          </section>

          {isDraft ? (
            <>
              <section className="card card-pad">
                <div className="card-head"><h2>Send</h2></div>
                <div className="cn-stack">
                  <TestForm id={b.id} />
                  <SendForm id={b.id} audience={audience ?? 0} noun={audienceNoun(b.audience, audience ?? 0)} minTime={consoleTimeValue(new Date())} />
                </div>
              </section>
              <section className="card card-pad">
                <div className="card-head"><h2>Edit</h2></div>
                <BroadcastEditor draft={{ id: b.id, audience: b.audience, kind: b.kind, subject: b.subject, body: b.body, plans: b.plans }} planNames={PLAN_NAMES} audiences={AUDIENCE_OPTIONS} ai={aiLabel()} />
              </section>
            </>
          ) : null}

          {problems.length ? (
            <section className="card">
              <div className="card-head card-pad cn-head-flush"><h2>Failed and skipped</h2></div>
              <div className="table-scroll">
                <table className="data-table cn-table">
                  <thead><tr><th>Email</th><th>Status</th><th>Why</th><th>When</th></tr></thead>
                  <tbody>
                    {problems.map((p) => (
                      <tr key={p.id}><td>{p.email}</td><td>{p.status === "FAILED" ? "Failed" : "Skipped"}</td><td>{p.error ?? "—"}</td><td>{stamp(p.updatedAt)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <section className="card card-pad">
          <div className="card-head"><h2>Preview</h2></div>
          <p className="cn-muted" style={{ marginBottom: 10 }}>Subject: <b>{preview.subject}</b></p>
          {/* Sandboxed: no scripts, no same-origin access. Everything staff typed is escaped anyway. */}
          <iframe className="cn-preview" title="Email preview" sandbox="" srcDoc={`<body style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#222;padding:8px 16px">${preview.html}</body>`} />
        </section>
      </div>
    </>
  );
}
