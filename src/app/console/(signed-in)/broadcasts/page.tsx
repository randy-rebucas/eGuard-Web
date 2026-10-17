import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { listBroadcasts } from "@/lib/console-queries";
import { KIND_LABEL, deliveryCounts, type BroadcastKind } from "@/lib/broadcasts";
import { LISTS, LIST_COPY, listCounts } from "@/lib/subscribers";
import { beforeParam, stamp } from "../../format";
import { BroadcastPill, Empty, Pager } from "../../ui";

export const metadata = { title: "Email" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

export default async function BroadcastsPage(props: PageProps<"/console/broadcasts">) {
  await requireStaff();
  const before = beforeParam((await props.searchParams).before);
  const { rows, nextBefore } = await listBroadcasts(before);
  const [counts, lists] = await Promise.all([deliveryCounts(rows.filter((b) => b.recipients).map((b) => b.id)), listCounts()]);
  return (
    <>
      <div className="card-head" style={{ marginBottom: 0 }}>
        <h1 className="cn-h1">Email</h1>
        <Link className="btn btn-primary btn-sm" href="/broadcasts/new">New email</Link>
      </div>
      <p className="cn-muted">Emails to many parents at once, or to a mailing list from the public site. Send one now or schedule it: the maintenance job sends about 600 an hour.</p>
      <p className="cn-muted">
        Mailing lists: {LISTS.map((l, i) => <span key={l}>{i ? " · " : ""}<b>{LIST_COPY[l].name}</b> {lists[l].confirmed.toLocaleString("en-US")} confirmed{lists[l].waiting ? `, ${lists[l].waiting.toLocaleString("en-US")} waiting to confirm` : ""}</span>)}
      </p>
      <section className="card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Subject</th><th>To</th><th>Kind</th><th>Plans</th><th>Status</th><th>Sent</th><th>When</th><th>By</th></tr></thead>
              <tbody>
                {rows.map((b) => {
                  const c = counts.get(b.id);
                  return (
                    <tr key={b.id}>
                      <td><Link prefetch={false} className="inline-link" href={`/broadcasts/${b.id}`}>{b.subject}</Link></td>
                      <td>{b.audience === "PARENTS" ? "Parents" : LIST_COPY[b.audience as keyof typeof LIST_COPY]?.name ?? b.audience}</td>
                      <td>{KIND_LABEL[b.kind as BroadcastKind] ?? b.kind}</td>
                      <td>{b.audience !== "PARENTS" ? "—" : b.plans.length ? b.plans.join(", ") : "All"}</td>
                      <td><BroadcastPill status={b.status} /></td>
                      <td>{b.recipients ? `${(c?.SENT ?? 0).toLocaleString("en-US")} of ${b.recipients.toLocaleString("en-US")}` : "—"}</td>
                      <td>{stamp(b.finishedAt ?? b.scheduledAt ?? b.createdAt)}</td>
                      <td>{b.createdBy.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No emails yet.</Empty>}
      </section>
      <Pager nextBefore={nextBefore} paged={!!before} />
    </>
  );
}
