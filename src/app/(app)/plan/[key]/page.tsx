import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { articleBySlug } from "@/lib/learn";
import { activityByKey } from "@/lib/parent-care/content";
import { careActivity } from "@/lib/parent-care/service";
import { Icon } from "@/components/icon";
import { PageHead } from "@/components/ui";
import { ActivityButtons } from "@/components/care";

export async function generateMetadata(props: PageProps<"/plan/[key]">) {
  const { key } = await props.params;
  return { title: activityByKey(key)?.title ?? "Activity" };
}

/** One safety activity: why, the steps, where in eGuard it's done, and the guide behind it. */
export default async function ActivityPage(props: PageProps<"/plan/[key]">) {
  const { key } = await props.params;
  if (!activityByKey(key)) notFound();
  const u = await requireUser();
  const a = await careActivity(u, key);
  const article = articleBySlug(a.article);
  return (
    <>
      <PageHead title={a.title} text={a.why} crumbs={[{ href: "/plan", label: "Safety plan" }]} />
      <section className="card card-pad" style={{ maxWidth: 760 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span className="pill tone-accent"><Icon name="hourglass" />About {a.minutes} min</span>
          {a.status === "STARTED" ? <span className="pill tone-warn">In progress</span> : null}
          {a.status === "COMPLETED" ? <span className="pill tone-ok"><Icon name="check" />Done</span> : null}
          {a.status === "DISMISSED" ? <span className="pill tone-muted">Set aside</span> : null}
        </div>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Steps</h2>
        <ol className="guide-steps">{a.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <ActivityButtons activityKey={a.key} status={a.status} due={a.due} />
          {a.appLink ? <Link className="btn btn-secondary" href={a.appLink.href}>{a.appLink.label}</Link> : null}
        </div>
        {article ? (
          <>
            <hr className="divider" style={{ margin: "22px 0 14px" }} />
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <span className="ico-tile"><Icon name="book-open" /></span>
              <div className="grow">
                <div className="t-meta">The guide behind it</div>
                <Link className="t-title inline-link" href={`/learn/${article.slug}`}>{article.title}</Link>
              </div>
            </div>
          </>
        ) : null}
        {a.status === "STARTED" ? <p className="t-meta" style={{ marginTop: 16 }}>Your progress is saved. If you&apos;ve turned on activity reminders, eGuard reminds you once, about a day after you started.</p> : null}
      </section>
    </>
  );
}
