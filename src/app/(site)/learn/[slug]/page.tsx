import type { Metadata } from "next";
import { FREE_CHILDREN } from "@/lib/plans";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ARTICLES, articleBySlug, readMinutes, relatedTo, reviewedDate, topicById } from "@/lib/learn";
import { parseMarkdown } from "@/lib/learn/markdown";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { PageHead } from "../../page-head";
import { MdBlocks } from "../markdown";
import "../learn.css";

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

            <div className="kc-cta">
              <div>
                <b>Want help putting this into practice?</b>
                <p>eGuard sets up screen time, bedtime and app rules on your child&apos;s phone and checks that each one is really on. Free for {FREE_CHILDREN}.</p>
              </div>
              <Link href="/register" className="lp-btn lp-btn-primary">Try eGuard free<ArrowRight /></Link>
            </div>
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
