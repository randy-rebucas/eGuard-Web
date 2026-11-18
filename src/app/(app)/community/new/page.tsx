import { requireUser } from "@/lib/auth";
import { getProfile, listCategories, participationBlock } from "@/lib/forum";
import { EmptyState, PageHead } from "@/components/ui";
import { HandleForm, ThreadForm } from "@/components/forum/forum-forms";

export const metadata = { title: "New thread" };

/** The signed-in parent\'s Community, read per request (a page\'s own setting is what its validation checks). */
export const instant = false;

export default async function NewThreadPage(props: PageProps<"/community/new">) {
  const user = await requireUser();
  const { category } = await props.searchParams;
  const [categories, profile] = await Promise.all([listCategories(user), getProfile(user.id)]);
  const open = categories.filter((c) => !c.staffOnly).map((c) => ({ slug: c.slug, name: c.name }));
  const initial = typeof category === "string" && open.some((c) => c.slug === category) ? category : undefined;
  const block = participationBlock(user, profile);
  return (
    <>
      <PageHead title="New thread" text="Ask a question or share what's worked for your family." crumbs={[{ href: "/community", label: "Community" }]} />
      {block?.code === "no_profile" ? (
        <section className="card card-pad">
          <div className="card-head"><div><h2>Before your first post</h2><div className="sub">Pick the name other parents will see and agree to the rules.</div></div></div>
          <HandleForm />
        </section>
      ) : block ? (
        <EmptyState icon="lock" title="You can't post right now" text={block.message} />
      ) : (
        <ThreadForm categories={open} initialCategory={initial} />
      )}
    </>
  );
}
