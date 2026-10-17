import type { Metadata } from "next";
import { FREE_CHILDREN } from "@/lib/plans";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ARTICLES, articleBySlug, readMinutes, relatedTo, reviewedDate, topicById, type TopicId } from "@/lib/learn";
import { PROTECTION_BY_SLUG } from "@/lib/protections";
import { Icon } from "@/components/icon";
import { parseMarkdown } from "@/lib/learn/markdown";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { StartLink } from "@/components/signed-in";
import { supportEmail } from "@/lib/support";
import { PageHead } from "../../page-head";
import { MdBlocks } from "../markdown";
import "../learn.css";

/**
 * The box at the end of each guide, by topic: the protections that put that topic into practice.
 * Grooming and exploitation guides get no product pitch (null); they point to how to report instead.
 */
const TOPIC_CTA: Record<TopicId, { title: string; body: string; protections: string[] } | null> = {
  "online-safety": { title: "Put the basics in place", body: "eGuard sets screen time, app approval and location sharing on your child's phone, and checks that each one is really on.", protections: ["screen-time", "app-approval", "location"] },
  "parental-controls": { title: "Parental controls you can check", body: "eGuard applies screen time, web filtering and app rules on your child's phone, then confirms each one on the device.", protections: ["screen-time", "web", "apps"] },
  "screen-time": { title: "Turn your screen-time plan into settings", body: "eGuard sets a daily limit with its own weekend allowance and a bedtime, and tells you if either is switched off.", protections: ["screen-time", "bedtime"] },
  exploitation: null,
  cyberbullying: { title: "Quieter nights, fewer surprise apps", body: "A bedtime rests apps and group chats overnight, and app approval means new apps need your OK first.", protections: ["bedtime", "app-approval"] },
  "social-media": { title: "Decide together which apps come next", body: "With app approval, your child asks before installing a new app, and screen time keeps feeds from eating the evening.", protections: ["app-approval", "screen-time"] },
  tiktok: { title: "Limits that hold outside the app too", body: "TikTok's settings only cover TikTok. eGuard's screen time and app approval cover the whole phone and are checked on the device.", protections: ["screen-time", "app-approval"] },
  gaming: { title: "Gaming time, on your terms", body: "eGuard sets a daily limit and per-app limits, plus a limit for all games together on paid plans, and new games need your OK.", protections: ["screen-time", "app-approval", "downloads"] },
  "chat-apps": { title: "Know when a new chat app arrives", body: "With app approval, a new chat app needs your OK before it's installed, and age ratings keep adult apps off the phone.", protections: ["app-approval", "apps"] },
  ai: { title: "Choose which AI apps they use", body: "App approval puts new AI and companion apps through you first, and web filtering blocks adult sites in every browser.", protections: ["app-approval", "web"] },
  "digital-parenting": { title: "Rules the whole family can see", body: "eGuard is never hidden: your child sees the same rules you set, and every carer in your family account sees the same status.", protections: ["screen-time", "bedtime", "location"] },
};

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const a = articleBySlug((await params).slug);
  if (!a) return {};
  return pageMetadata({ title: a.title, description: a.description, path: `/learn/${a.slug}`, type: "article", publishedTime: a.reviewed, ownImage: true });
}

export default async function LearnArticlePage({ params }: PageProps<"/learn/[slug]">) {
  const a = articleBySlug((await params).slug);
  if (!a) notFound();
  const topic = topicById(a.topic)!;
  const blocks = parseMarkdown(a.body);
  const toc = blocks.flatMap((b) => (b.type === "h2" ? [b] : []));
  const related = relatedTo(a);
  const cta = TOPIC_CTA[a.topic];
  const site = siteUrl();
  const url = `${site}/learn/${a.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: a.title, description: a.description, dateModified: a.reviewed, url, mainEntityOfPage: url,
        inLanguage: "en-PH", articleSection: topic.label,
        author: { "@type": "Organization", name: "eGuard", url: site },
        publisher: { "@type": "Organization", "@id": `${site}/#org`, name: "eGuard", logo: `${site}/brand/logo-mark-512.png` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Knowledge Center", item: `${site}/learn` },
        { "@type": "ListItem", position: 3, name: topic.label, item: `${site}/learn/topics/${topic.id}` },
        { "@type": "ListItem", position: 4, name: a.title, item: url },
      ] },
    ],
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
      <PageHead eyebrow={topic.label} title={a.title} lede={a.description}>
        <div className="st-meta">
          <span>By the eGuard team</span>
          <span>Last checked <time dateTime={a.reviewed}>{reviewedDate(a.reviewed)}</time></span>
          <span>{readMinutes(a)} min read</span>
        </div>
      </PageHead>

      <div className="lp-wrap kc-article">
        <nav className="kc-crumbs" aria-label="Breadcrumb">
          <Link href="/learn">Knowledge Center</Link><span aria-hidden>/</span><Link href={`/learn/topics/${topic.id}`}>{topic.label}</Link>
        </nav>

        <div className="kc-layout">
          {toc.length > 2 ? (
            <nav className="st-toc kc-toc" aria-label="On this page">
              <b>On this page</b>
              <ol>{toc.map((h) => <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>)}</ol>
            </nav>
          ) : <div />}

          <div className="st-prose kc-prose">
            <div className="kc-takeaways">
              <b>The short version</b>
              <ul>{a.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <MdBlocks blocks={blocks} />

            <aside className="kc-aside">
              <b>About this guide</b>
              <p>
                Written by the eGuard team for parents in the Philippines and last checked on {reviewedDate(a.reviewed)}.
                Apps change their settings often; if something here no longer matches what you see, tell us at
                {" "}<a href={`mailto:${supportEmail()}`}>{supportEmail()}</a>. This is general information, not
                legal or medical advice.
              </p>
            </aside>

            {cta ? (
              <div className="kc-cta">
                <div>
                  <b>{cta.title}</b>
                  <p>{cta.body} Free for {FREE_CHILDREN}.</p>
                  <ul className="kc-cta-links">
                    {cta.protections.map((slug) => {
                      const p = PROTECTION_BY_SLUG[slug];
                      return <li key={slug}><Link href={`/protections/${slug}`}><Icon name={p.icon} />{p.name}</Link></li>;
                    })}
                  </ul>
                </div>
                <StartLink className="lp-btn lp-btn-primary" start="Try eGuard free" />
              </div>
            ) : (
              <div className="kc-cta kc-cta-help">
                <div>
                  <b>If something has already happened</b>
                  <p>You don&apos;t have to handle it alone. Our guide lists who to call and how to report online abuse of a child in the Philippines. If a child is in danger right now, call 911.</p>
                </div>
                <Link href="/learn/report-online-child-abuse-philippines" className="lp-btn lp-btn-primary">How to report<ArrowRight /></Link>
              </div>
            )}
          </div>
        </div>

        {related.length ? (
          <nav className="st-more kc-more" aria-label="Related guides">
            <h2>Keep reading</h2>
            <ul>
              {related.map((r) => (
                <li key={r.slug}><Link href={`/learn/${r.slug}`}><b>{r.title}</b><span>{topicById(r.topic)!.label} · {readMinutes(r)} min read</span></Link></li>
              ))}
            </ul>
            <Link href={`/learn/topics/${topic.id}`} className="st-back kc-all"><ArrowLeft />All {topic.label.toLowerCase()} guides</Link>
          </nav>
        ) : null}
      </div>
    </article>
  );
}
