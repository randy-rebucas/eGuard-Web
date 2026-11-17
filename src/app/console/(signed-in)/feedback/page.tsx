import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { BUCKETS, feedbackFilter, feedbackStats, listFeedback } from "@/lib/feedback-queries";
import { FEEDBACK_KINDS, FEEDBACK_KIND_LABEL, NPS_FLAG } from "@/lib/feedback";
import { setFeedbackFollowUp } from "@/app/actions/console-reviews";
import { beforeParam, label, stamp } from "../../format";
import { Empty, FilterTabs, Pager, StatGrid } from "../../ui";

export const metadata = { title: "Feedback" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const FOLLOW_UP_LABEL: Record<string, string> = { NONE: "—", NEEDED: "Needs a look", TICKET: "Ticket opened", CONTACTED: "Contacted", RESOLVED: "Resolved" };
const nps = (v: number | null) => (v == null ? "—" : v > 0 ? `+${v}` : String(v));

export default async function FeedbackPage(props: PageProps<"/console/feedback">) {
  await requireStaff();
  const sp = await props.searchParams;
  const f = feedbackFilter(sp);
  const before = beforeParam(sp.before);
  const [{ rows, nextBefore }, s] = await Promise.all([listFeedback(f, before), feedbackStats()]);
  const query = { kind: f.kind ?? "", bucket: f.bucket ?? "", followUp: f.followUp ?? "" };
  return (
    <>
      <h1 className="cn-h1">Feedback</h1>
      <StatGrid stats={[
        { label: "NPS, 30 days", value: nps(s.nps30), hint: `${s.n30} answers` },
        { label: "NPS, 90 days", value: nps(s.nps90), hint: `${s.buckets.PROMOTER} promoters · ${s.buckets.PASSIVE} passive · ${s.buckets.DETRACTOR} detractors` },
        { label: "Needs a look", value: s.needed, href: "/feedback?followUp=NEEDED", tone: s.needed ? "warn" : undefined, hint: "Unhappy, no ticket opened" },
        { label: "Messages, 90 days", value: (s.byKind.FEEDBACK ?? 0) + (s.byKind.BUG ?? 0) + (s.byKind.IDEA ?? 0), hint: `${s.byKind.BUG ?? 0} problems · ${s.byKind.IDEA ?? 0} ideas` },
      ]} />
      <p className="cn-muted">
        The survey shows only while the <Link className="inline-link" href="/flags">feature flag</Link> <span className="cn-mono">{NPS_FLAG}</span> is on for a family.
        Answers never decide who is asked for a store rating.
      </p>
      <FilterTabs label="Kind" base="/feedback" param="kind" value={query.kind} query={query}
        options={[{ value: "", label: "All" }, ...FEEDBACK_KINDS.map((k) => ({ value: k, label: FEEDBACK_KIND_LABEL[k] }))]} />
      <FilterTabs label="Group" base="/feedback" param="bucket" value={query.bucket} query={query}
        options={[{ value: "", label: "Any score" }, ...BUCKETS.map((b) => ({ value: b, label: label(b) }))]} />
      <FilterTabs label="Follow-up" base="/feedback" param="followUp" value={query.followUp} query={query}
        options={[{ value: "", label: "Any follow-up" }, ...["NEEDED", "TICKET", "CONTACTED", "RESOLVED"].map((v) => ({ value: v, label: FOLLOW_UP_LABEL[v] }))]} />
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>What they said</th><th>Score</th><th>From</th><th>Where</th><th>Follow-up</th><th>Sent</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{FEEDBACK_KIND_LABEL[r.kind as keyof typeof FEEDBACK_KIND_LABEL] ?? r.kind}</b>
                      {r.comment ? <><br /><span style={{ whiteSpace: "pre-wrap" }}>{r.comment}</span></> : <span className="cn-muted"> (no comment)</span>}
                      {/* Kind words can become a quote on the site, only with the parent's consent (console › Social proof) */}
                      {r.comment && (r.bucket === "PROMOTER" || r.kind === "FEEDBACK") ? <><br /><Link prefetch={false} className="inline-link" href={`/proof?feedback=${r.id}`}>Quote this</Link></> : null}
                    </td>
                    <td>{r.score != null ? <span className={`pill ${r.bucket === "DETRACTOR" ? "tone-crit" : r.bucket === "PROMOTER" ? "tone-ok" : "tone-muted"}`}>{r.score}</span> : "—"}</td>
                    <td>
                      {r.user.email}{r.contactOk ? "" : <span className="cn-muted"> (no contact)</span>}<br />
                      <Link prefetch={false} className="inline-link" href={`/families/${r.family.id}`}>{r.family.name}</Link> · {r.family.plan}
                    </td>
                    <td>{label(r.platform)}{r.appVersion ? ` ${r.appVersion}` : ""}</td>
                    <td>
                      {r.ticketId ? <Link prefetch={false} className="inline-link" href={`/tickets/${r.ticketId}`}>{FOLLOW_UP_LABEL[r.followUp]}</Link> : FOLLOW_UP_LABEL[r.followUp] ?? r.followUp}
                      {r.followUp === "NEEDED" || r.followUp === "CONTACTED" ? (
                        <form action={setFeedbackFollowUp} className="row" style={{ gap: 4, marginTop: 4 }}>
                          <input type="hidden" name="id" value={r.id} />
                          {r.followUp === "NEEDED" ? <button className="btn btn-ghost btn-sm" name="followUp" value="CONTACTED">Contacted</button> : null}
                          <button className="btn btn-ghost btn-sm" name="followUp" value="RESOLVED">Resolved</button>
                        </form>
                      ) : null}
                    </td>
                    <td>{stamp(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No feedback here yet.</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} query={query} />
    </>
  );
}
