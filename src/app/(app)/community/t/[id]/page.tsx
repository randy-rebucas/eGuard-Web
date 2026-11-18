import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getFamily } from "@/lib/queries";
import { ServiceError } from "@/lib/errors";
import { getThread, participationBlock, readThreadNotices } from "@/lib/forum";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead } from "@/components/ui";
import { AuthorBadge } from "@/components/forum/thread-list";
import { FollowButton, HandleForm, PostShell, ReplyForm } from "@/components/forum/forum-forms";

export const metadata = { title: "Community" };

/** The signed-in parent\'s Community, read per request (a page\'s own setting is what its validation checks). */
export const instant = false;

export default async function ThreadPage(props: PageProps<"/community/t/[id]">) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const data = await getThread(user, id, Number(sp.page) || 1).catch((e) => {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  });
  const [family] = await Promise.all([getFamily(user.familyId), readThreadNotices(user.id, id)]);
  const { thread, posts, page, pages, following, profile } = data;
  const block = participationBlock(user, profile);
  const canAct = !block;
  const tz = family.timezone;
  const pageLink = (p: number) => `/community/t/${id}${p > 1 ? `?page=${p}` : ""}`;
  return (
    <>
      <PageHead title={thread.title} crumbs={[{ href: "/community", label: "Community" }, { href: `/community/c/${thread.category.slug}`, label: thread.category.name }]}>
        {thread.status === "visible" ? <FollowButton threadId={thread.id} following={following} /> : null}
      </PageHead>
      {thread.status === "hidden" ? (
        <div className="form-error" role="status"><Icon name="eye-off" />A moderator hid this thread, so only you can see it. You can delete it.</div>
      ) : null}
      {page === 1 ? (
        <article className="card card-pad" id="top">
          <AuthorBadge by={thread.by} tz={tz} at={thread.createdAt} edited={thread.editedAt} />
          <PostShell kind="thread" id={thread.id} title={thread.title} body={thread.body} score={thread.score} voted={thread.voted} mine={thread.by.mine}
            canAct={canAct && thread.status === "visible" && thread.by.kind !== "deleted"}>
            <div className={`forum-text${thread.status === "visible" ? "" : " forum-removed"}`} style={{ marginTop: 14 }}>{thread.body}</div>
          </PostShell>
        </article>
      ) : null}
      <section className="dash-col" style={{ gap: 12 }} aria-label="Replies">
        <div className="section-title"><h2>{thread.replyCount ? `${thread.replyCount} ${thread.replyCount === 1 ? "reply" : "replies"}` : "No replies yet"}</h2></div>
        {posts.map((p) => (
          <article key={p.id} id={`p-${p.id}`} className="card card-pad">
            <AuthorBadge by={p.by} tz={tz} at={p.createdAt} edited={p.editedAt} />
            <PostShell kind="post" id={p.id} body={p.body} score={p.score} voted={p.voted} mine={p.by.mine}
              canAct={canAct && p.status === "visible" && p.by.kind !== "deleted"}>
              <div className={`forum-text${p.status === "visible" ? "" : " forum-removed"}`} style={{ marginTop: 12 }}>{p.body}</div>
            </PostShell>
          </article>
        ))}
        {pages > 1 ? (
          <nav className="row" style={{ gap: 16 }} aria-label="Pages">
            {page > 1 ? <Link className="link-btn" href={pageLink(page - 1)}><Icon name="arrow-left" />Earlier replies</Link> : null}
            <span className="t-meta">Page {page} of {pages}</span>
            {page < pages ? <Link className="link-btn" href={pageLink(page + 1)}>Later replies <Icon name="arrow-right" /></Link> : null}
          </nav>
        ) : null}
      </section>
      {thread.status !== "visible" ? null : thread.locked ? (
        <EmptyState icon="lock" title="Closed to new replies" text="A moderator closed this thread." />
      ) : page < pages ? (
        <div><Link className="link-btn" href={`${pageLink(pages)}#reply`}>Go to the latest replies to reply <Icon name="arrow-right" /></Link></div>
      ) : block?.code === "no_profile" ? (
        <section className="card card-pad">
          <div className="card-head"><div><h2>Join the conversation</h2><div className="sub">Pick the name other parents will see and agree to the rules.</div></div></div>
          <HandleForm />
        </section>
      ) : block ? (
        <EmptyState icon="lock" title="You can't reply right now" text={block.message} />
      ) : (
        <ReplyForm threadId={thread.id} />
      )}
    </>
  );
}
