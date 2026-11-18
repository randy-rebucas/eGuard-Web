import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamily } from "@/lib/queries";
import { searchThreads } from "@/lib/forum";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead } from "@/components/ui";
import { ThreadList } from "@/components/forum/thread-list";
import { SearchBox } from "../search-box";

export const metadata = { title: "Search Community" };

/** The signed-in parent\'s Community, read per request (a page\'s own setting is what its validation checks). */
export const instant = false;

export default async function SearchPage(props: PageProps<"/community/search">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const [family, res] = await Promise.all([getFamily(user.familyId), searchThreads(user, q, page)]);
  const href = (p: number) => `/community/search?${new URLSearchParams({ q, page: String(p) })}`;
  return (
    <>
      <PageHead title="Search" crumbs={[{ href: "/community", label: "Community" }]} />
      <SearchBox q={q} />
      {q.trim().length < 2 ? (
        <EmptyState icon="search" title="Search Community" text="Type at least two characters." />
      ) : (
        <ThreadList threads={res.threads} tz={family.timezone} showCategory empty={
          <EmptyState icon="search-x" title="No matches" text="Try other words, or start a thread and ask.">
            <Link className="btn btn-primary" href="/community/new"><Icon name="plus" />New thread</Link>
          </EmptyState>
        } />
      )}
      {page > 1 || res.more ? (
        <div className="row" style={{ gap: 16 }}>
          {page > 1 ? <Link className="link-btn" href={href(page - 1)}><Icon name="arrow-left" />Previous</Link> : null}
          {res.more ? <Link className="link-btn" href={href(page + 1)}>More results <Icon name="arrow-right" /></Link> : null}
        </div>
      ) : null}
    </>
  );
}
