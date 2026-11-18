import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamily } from "@/lib/queries";
import { listNotices, noticeText, threadLink } from "@/lib/forum";
import { ago } from "@/lib/format";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead } from "@/components/ui";
import { MarkAllRead } from "@/components/forum/forum-forms";

export const metadata = { title: "Community notifications" };

/** The signed-in parent\'s Community, read per request (a page\'s own setting is what its validation checks). */
export const instant = false;

const ICON: Record<string, string> = { reply: "message-circle", mention: "at-sign", moderation: "shield-alert" };

export default async function CommunityNotificationsPage(props: PageProps<"/community/notifications">) {
  const user = await requireUser();
  const { before } = await props.searchParams;
  const b = typeof before === "string" && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;
  const [family, { notices, nextBefore }] = await Promise.all([getFamily(user.familyId), listNotices(user, b)]);
  return (
    <>
      <PageHead title="Notifications" text="Replies to threads you follow, mentions, and moderator notices." crumbs={[{ href: "/community", label: "Community" }]}>
        {notices.some((n) => !n.readAt) ? <MarkAllRead /> : null}
      </PageHead>
      {notices.length ? (
        <ul className="card card-pad dash-col" style={{ gap: 2, listStyle: "none" }}>
          {notices.map((n) => (
            <li key={n.id}>
              <Link className="list-row" href={threadLink(n.thread.id, n.postId)}>
                <span className={`ico-tile${n.readAt ? " muted" : ""}`}><Icon name={ICON[n.kind] ?? "bell"} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-title forum-title" style={{ fontWeight: n.readAt ? 500 : 600 }}>{noticeText(n.kind, n.actor, n.thread.status === "deleted" ? "" : n.thread.title)}</div>
                  <div className="t-meta">{ago(n.createdAt, family.timezone)}</div>
                </div>
                {n.readAt ? null : <span className="pill tone-accent">New</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="bell" title="Nothing yet" text="When someone replies to a thread you follow or mentions you, it shows up here." />
      )}
      {nextBefore ? <div><Link className="link-btn" href={`/community/notifications?before=${nextBefore.toISOString()}`}>Older <Icon name="arrow-right" /></Link></div> : null}
    </>
  );
}
