import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { db } from "@/lib/db";
import { FORUM_FLAG, REPORT_REASON_LABEL, communityStats, listRecent, listReports } from "@/lib/forum";
import { ago, one } from "../../format";
import { Empty, FilterTabs, StatGrid } from "../../ui";
import { AnnounceForm, ModButton, MuteForm, StaffReplyForm } from "../../community-forms";

export const metadata = { title: "Community" };

/** Read per request behind the staff session (a page's own setting is what its validation checks). */
export const instant = false;

const TABS = [{ value: "", label: "Reports" }, { value: "recent", label: "Recent posts" }, { value: "post", label: "Post as eGuard" }];
const STATUS_TONE: Record<string, string> = { visible: "tone-ok", hidden: "tone-warn", deleted: "tone-muted" };

const excerpt = (s: string, n = 600) => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Console › Community (lib/forum). Staff see what other parents see: the handle and the post, never the parent's
 * name, email or children. Muting is by the member's account, without showing who they are.
 */
export default async function CommunityConsolePage(props: PageProps<"/console/community">) {
  await requireStaff();
  const tab = one((await props.searchParams).tab);
  const [reports, { threads7, posts7, members, muted }, categories] = await Promise.all([
    listReports(),
    communityStats(),
    db.forumCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);
  return (
    <>
      <h1 className="cn-h1">Community</h1>
      <StatGrid stats={[
        { label: "Open reports", value: reports.length, tone: reports.length ? "warn" : undefined, href: "/community" },
        { label: "Threads, 7 days", value: threads7 },
        { label: "Replies, 7 days", value: posts7 },
        { label: "Members", value: members, hint: muted ? `${muted} muted` : undefined },
      ]} />
      <p className="cn-muted">
        Parents see Community only while the <Link className="inline-link" href="/flags">feature flag</Link> <span className="cn-mono">{FORUM_FLAG}</span> is on for their family.
        Three open reports hide a post until someone here decides.
      </p>
      <FilterTabs label="View" base="/community" param="tab" value={tab} options={TABS} />
      {tab === "post" ? (
        <section className="card card-pad"><AnnounceForm categories={categories} /></section>
      ) : tab === "recent" ? (
        <Recent />
      ) : reports.length ? (
        <div className="dash-col" style={{ gap: 12 }}>
          {reports.map((g) => {
            const kind = g.target.postId ? "post" : "thread";
            const id = g.target.postId ?? g.target.threadId!;
            return (
              <section key={g.key} className="card card-pad dash-col" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <span className={`pill ${STATUS_TONE[g.status] ?? "tone-muted"}`}>{g.status}</span>
                  <b>{kind === "post" ? "Reply in" : "Thread"} &ldquo;{g.threadTitle || "[deleted]"}&rdquo;</b>
                  <span className="cn-muted">by {g.author.name}</span>
                </div>
                <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{excerpt(g.body) || <span className="cn-muted">(empty)</span>}</div>
                <ul className="cn-muted" style={{ margin: 0, paddingLeft: 18 }}>
                  {g.reasons.map((r, i) => <li key={i}>{REPORT_REASON_LABEL[r.reason] ?? r.reason}{r.note ? `: "${r.note}"` : ""} · {ago(r.at)}</li>)}
                </ul>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {g.status === "visible" ? <ModButton kind={kind} id={id} op="hide" label="Hide" primary /> : <ModButton kind={kind} id={id} op="unhide" label="Make visible" />}
                  <ModButton kind={kind} id={id} op="dismiss" label="Dismiss reports" />
                  <ModButton kind={kind} id={id} op="delete" label="Delete" confirm="Delete this post for good? Its text is erased." />
                  {g.authorId && g.author.kind === "member" ? <MuteForm userId={g.authorId} handle={g.author.name} /> : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Empty>No open reports.</Empty>
      )}
    </>
  );
}

function Actions({ kind, id, status }: { kind: "thread" | "post"; id: string; status: string }) {
  if (status === "visible") return <ModButton kind={kind} id={id} op="hide" label="Hide" />;
  if (status === "hidden") return <ModButton kind={kind} id={id} op="unhide" label="Unhide" />;
  return null;
}

async function Recent() {
  const { threads, posts } = await listRecent();
  return (
    <>
      <section className="card">
        <div className="card-pad"><h2>Threads</h2></div>
        {threads.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Thread</th><th>By</th><th>Status</th><th>Started</th><th></th></tr></thead>
              <tbody>
                {threads.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <b>{t.title || "[deleted]"}</b> <span className="cn-muted">· {t.category.name}{t.pinned ? " · pinned" : ""}{t.locked ? " · locked" : ""}</span><br />
                      <span style={{ whiteSpace: "pre-wrap" }}>{excerpt(t.body, 240)}</span>
                    </td>
                    <td>{t.by.name}</td>
                    <td><span className={`pill ${STATUS_TONE[t.status] ?? "tone-muted"}`}>{t.status}</span></td>
                    <td>{ago(t.createdAt)}</td>
                    <td>
                      <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                        <Actions kind="thread" id={t.id} status={t.status} />
                        {t.status === "visible" ? <ModButton kind="thread" id={t.id} op={t.pinned ? "unpin" : "pin"} label={t.pinned ? "Unpin" : "Pin"} /> : null}
                        {t.status === "visible" ? <ModButton kind="thread" id={t.id} op={t.locked ? "unlock" : "lock"} label={t.locked ? "Unlock" : "Lock"} /> : null}
                      </div>
                      {t.status === "visible" && !t.locked ? <StaffReplyForm threadId={t.id} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No threads yet.</Empty>}
      </section>
      <section className="card">
        <div className="card-pad"><h2>Replies</h2></div>
        {posts.length ? (
          <div className="table-scroll">
            <table className="data-table cn-table">
              <thead><tr><th>Reply</th><th>By</th><th>Status</th><th>Posted</th><th></th></tr></thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td><span className="cn-muted">In &ldquo;{p.thread.title || "[deleted]"}&rdquo;</span><br /><span style={{ whiteSpace: "pre-wrap" }}>{excerpt(p.body, 240)}</span></td>
                    <td>{p.by.name}</td>
                    <td><span className={`pill ${STATUS_TONE[p.status] ?? "tone-muted"}`}>{p.status}</span></td>
                    <td>{ago(p.createdAt)}</td>
                    <td><Actions kind="post" id={p.id} status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No replies yet.</Empty>}
      </section>
    </>
  );
}
