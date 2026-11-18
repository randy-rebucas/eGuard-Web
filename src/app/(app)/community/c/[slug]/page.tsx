import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getFamily } from "@/lib/queries";
import { ServiceError } from "@/lib/errors";
import { getCategory, listThreads } from "@/lib/forum";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead } from "@/components/ui";
import { ThreadList } from "@/components/forum/thread-list";

export const metadata = { title: "Community" };

/** The signed-in parent\'s Community, read per request (a page\'s own setting is what its validation checks). */
export const instant = false;

export default async function TopicPage(props: PageProps<"/community/c/[slug]">) {
  const user = await requireUser();
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams]);
  const before = typeof sp.before === "string" && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined;
  const category = await getCategory(user, slug).catch((e) => {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  });
  const [family, list] = await Promise.all([getFamily(user.familyId), listThreads(user, { categoryId: category.id, before })]);
  const threads = [...list.pinned, ...list.threads];
  return (
    <>
      <PageHead title={category.name} text={category.description} crumbs={[{ href: "/community", label: "Community" }]}>
        {category.staffOnly ? null : <Link className="btn btn-primary" href={`/community/new?category=${category.slug}`}><Icon name="plus" />New thread</Link>}
      </PageHead>
      <ThreadList threads={threads} tz={family.timezone} empty={
        <EmptyState icon={category.icon} title="Nothing here yet" text={category.staffOnly ? "News from the eGuard team will appear here." : "Start the first thread in this topic."}>
          {category.staffOnly ? null : <Link className="btn btn-primary" href={`/community/new?category=${category.slug}`}><Icon name="plus" />New thread</Link>}
        </EmptyState>
      } />
      {list.nextBefore ? (
        <div><Link className="link-btn" href={`/community/c/${category.slug}?before=${list.nextBefore.toISOString()}`}>Older threads <Icon name="arrow-right" /></Link></div>
      ) : null}
    </>
  );
}
