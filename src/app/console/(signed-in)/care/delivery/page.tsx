import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { deliveryOps, failedJobs } from "@/lib/parent-care/metrics";
import { AUTOMATIONS, CHANNEL_LABEL, RETRY, automationByKey, type Channel } from "@/lib/parent-care/definitions";
import { beforeParam, one, stamp } from "../../../format";
import { RetryAll, RetryJob } from "../../../care-forms";
import { CareTabs, Empty, Pager, RateText } from "../../../ui";

export const metadata = { title: "Delivery" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const STATUS_LABEL: Record<string, string> = { PENDING: "Pending", RUNNING: "Running", DONE: "Sent", SKIPPED: "Skipped", CANCELLED: "Cancelled", DEAD: "Failed for good" };

/**
 * Delivery operations: the queue, reliability, provider errors, and failed jobs to retry. Jobs show codes and
 * counts; "Family" opens the family's page in the console, which is logged like any family view.
 */
export default async function CareDelivery(props: PageProps<"/console/care/delivery">) {
  await requireStaff();
  const sp = await props.searchParams;
  const view = one(sp.view) === "retrying" ? "RETRYING" : "DEAD";
  const before = beforeParam(sp.before);
  const [ops, jobs] = await Promise.all([deliveryOps(), failedJobs({ status: view, before })]);
  return (
    <>
      <h1 className="cn-h1">Parent care</h1>
      <CareTabs active="/care/delivery" />
      <div className="cn-stats">
        {["PENDING", "RUNNING", "DONE", "SKIPPED", "CANCELLED", "DEAD"].map((s) => (
          <div key={s} className="card cn-stat"><span className="cn-stat-value num">{(ops.byStatus[s] ?? 0).toLocaleString("en-US")}</span><span className="cn-stat-label">{STATUS_LABEL[s]}</span></div>
        ))}
      </div>
      <section className="card card-pad">
        <div className="card-head"><h2>Reliability (last 30 days)</h2></div>
        <dl className="cn-dl">
          <dt>Delivery reliability</dt><dd><RateText r={ops.reliability} /> <span className="cn-muted">messages a provider accepted (or shown in-app), of those attempted</span></dd>
          <dt>Automation failure rate</dt><dd><RateText r={ops.failureRate} /> <span className="cn-muted">jobs failed for good, of jobs processed</span></dd>
          <dt>Duplicate-send rate</dt><dd><RateText r={ops.duplicateRate} /> <span className="cn-muted">retries that found the message already sent and stopped, of jobs processed</span></dd>
          <dt>Interrupted sends</dt><dd>{ops.uncertain.toLocaleString("en-US")} <span className="cn-muted">a worker stopped mid-send; never re-sent, so at most one copy arrived</span></dd>
          <dt>Retrying now</dt><dd>{ops.retrying.toLocaleString("en-US")} <span className="cn-muted">up to {RETRY.maxAttempts} attempts, backing off from 5 minutes to 6 hours</span></dd>
          <dt>Overdue</dt><dd>{ops.overdue.toLocaleString("en-US")} <span className="cn-muted">pending more than 30 minutes past their time; if this grows, check the maintenance cron</span></dd>
        </dl>
      </section>
      <section className="card card-pad">
        <div className="card-head"><h2>Provider errors (last 30 days)</h2></div>
        {ops.providerErrors.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Channel</th><th>Error</th><th>Messages</th></tr></thead>
              <tbody>{ops.providerErrors.map((e) => <tr key={`${e.channel}:${e.code}`}><td>{CHANNEL_LABEL[e.channel as Channel] ?? e.channel}</td><td className="cn-mono">{e.code}</td><td>{e.n.toLocaleString("en-US")}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="cn-muted">No provider errors.</p>}
      </section>
      <section className="card">
        <div className="card-pad cn-head-flush card-head">
          <h2>{view === "DEAD" ? "Failed jobs" : "Retrying"}</h2>
          <nav className="cn-tabs" aria-label="Jobs">
            <Link className="cn-tab" href="/care/delivery" aria-current={view === "DEAD" ? "page" : undefined}>Failed for good</Link>
            <Link className="cn-tab" href="/care/delivery?view=retrying" aria-current={view === "RETRYING" ? "page" : undefined}>Retrying</Link>
          </nav>
        </div>
        {jobs.rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Job</th><th>Automation</th><th>Attempts</th><th>Last error</th><th>Channel</th><th>{view === "DEAD" ? "Gave up" : "Next try"}</th><th>Family</th><th /></tr></thead>
              <tbody>
                {jobs.rows.map((j) => (
                  <tr key={j.id}>
                    <td className="cn-mono">{j.id}</td>
                    <td>{automationByKey(j.automationKey)?.name ?? j.automationKey}</td>
                    <td>{j.attempts}</td>
                    <td className="cn-mono">{j.lastError ?? "—"}</td>
                    <td>{j.messages.map((m) => `${CHANNEL_LABEL[m.channel as Channel] ?? m.channel} (${m.status.toLowerCase()}${m.error ? `: ${m.error}` : ""})`).join(", ") || "—"}</td>
                    <td>{stamp(view === "DEAD" ? j.processedAt : j.runAt)}</td>
                    <td><Link prefetch={false} className="inline-link" href={`/families/${j.user.familyId}`}>Open</Link></td>
                    <td>{view === "DEAD" ? <RetryJob id={j.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{view === "DEAD" ? "No failed jobs." : "Nothing retrying."}</Empty>}
      </section>
      {view === "DEAD" ? <Pager nextBefore={jobs.nextBefore} paged={!!before} /> : null}
      <section className="card card-pad">
        <div className="card-head"><h2>Retry failed jobs</h2></div>
        <RetryAll automations={AUTOMATIONS.map((a) => ({ key: a.key, name: a.name }))} dead={ops.byStatus.DEAD ?? 0} />
      </section>
    </>
  );
}
