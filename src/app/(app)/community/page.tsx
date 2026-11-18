import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamily } from "@/lib/queries";
import { getProfile, listCategories, listThreads, unreadNotices } from "@/lib/forum";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead } from "@/components/ui";
import { ThreadList } from "@/components/forum/thread-list";
import { SearchBox } from "./search-box";

export const metadata = { title: "Community" };

/** The signed-in parent\'s Community, read per request (a page\'s own setting is what its validation checks). */
export const instant = false;

const dateParam = (v: string | string[] | undefined) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined);

export default async function CommunityPage(props: PageProps<"/community">) {
  const user = await requireUser();
  const before = dateParam((await props.searchParams).before);
  const [family, categories, latest, profile, unread] = await Promise.all([
    getFamily(user.familyId), listCategories(user), listThreads(user, { before }), getProfile(user.id), unreadNotices(user.id),
  ]);
  return (
    <>
      <PageHead title="Community" text="Ask other parents, share what works in your home, and hear from the eGuard team. Only parents can see this.">
        <Link className="btn btn-secondary" href="/community/notifications">
          <Icon name="bell" />Notifications{unread ? <span className="pill tone-accent num" style={{ height: 20 }}>{unread}</span> : null}
        </Link>
        <Link className="btn btn-primary" href="/community/new"><Icon name="plus" />New thread</Link>
      </PageHead>
      <SearchBox />
      {!before ? (
        <section>
          <div className="section-title"><h2>Topics</h2></div>
          <div className="forum-topics">
            {categories.map((c) => (
              <Link key={c.id} href={`/community/c/${c.slug}`} className="card card-pad row forum-topic" style={{ gap: 12, alignItems: "flex-start" }}>
                <span className="ico-tile"><Icon name={c.icon} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-title">{c.name}</div>
                  <div className="t-meta">{c.description}</div>
                  <div className="t-meta num" style={{ marginTop: 4 }}>{c.threads} {c.threads === 1 ? "thread" : "threads"}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <div className="section-title"><h2>{before ? "Older threads" : "Latest"}</h2></div>
        <ThreadList threads={latest.threads} tz={family.timezone} showCategory empty={
          <EmptyState icon="messages-square" title="No threads yet" text="Be the first to ask a question or share a tip.">
            <Link className="btn btn-primary" href="/community/new"><Icon name="plus" />New thread</Link>
          </EmptyState>
        } />
        {latest.nextBefore ? (
          <div style={{ marginTop: 12 }}><Link className="link-btn" href={`/community?before=${latest.nextBefore.toISOString()}`}>Older threads <Icon name="arrow-right" /></Link></div>
        ) : null}
      </section>
      {profile ? (
        <p className="t-meta">You appear as <b>{profile.handle}</b>. Change it in <Link className="link-btn" href="/settings/notifications#community" style={{ minHeight: 0 }}>Settings › Notifications</Link>.</p>
      ) : null}
    </>
  );
}
