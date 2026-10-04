import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TOPICS, articlesIn, readMinutes, topicById } from "@/lib/learn";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { PageHead } from "../../../page-head";
import "../../learn.css";

export function generateStaticParams() {
  return TOPICS.map((t) => ({ topic: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/learn/topics/[topic]">): Promise<Metadata> {
  const t = topicById((await params).topic);
  if (!t) return {};
  return pageMetadata({ title: `${t.title}: guides for parents`, description: t.description, path: `/learn/topics/${t.id}`, ownImage: true });
}

export default async function TopicPage({ params }: PageProps<"/learn/topics/[topic]">) {
  const t = topicById((await params).topic);
  if (!t) notFound();
  const list = articlesIn(t.id);
  const [pillar, ...rest] = list;
  const site = siteUrl();
  const url = `${site}/learn/topics/${t.id}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", name: t.title, description: t.description, url, inLanguage: "en-PH",
        mainEntity: { "@type": "ItemList", itemListElement: list.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${site}/learn/${a.slug}`, name: a.title })) } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Knowledge Center", item: `${site}/learn` },
        { "@type": "ListItem", position: 3, name: t.label, item: url },
      ] },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
      <PageHead eyebrow={`Knowledge Center · ${list.length} guides`} title={t.title} lede={t.intro} />

      <div className="kc">
        <Link href="/learn" className="st-back"><ArrowLeft />Knowledge Center</Link>

        {pillar ? (
          <Link href={`/learn/${pillar.slug}`} className="kc-pillar">
            <span className="st-tag">Start here</span>
            <h2>{pillar.title}</h2>
            <p>{pillar.description}</p>
            <span className="st-post-meta">{readMinutes(pillar)} min read<ArrowRight /></span>
          </Link>
        ) : null}

        <ul className="kc-list">
          {rest.map((a) => (
            <li key={a.slug}>
              <Link href={`/learn/${a.slug}`}>
                <h2>{a.title}</h2>
                <p>{a.description}</p>
                <span className="st-post-meta">{readMinutes(a)} min read<ArrowRight /></span>
              </Link>
            </li>
          ))}
        </ul>

        <nav className="kc-other" aria-label="Other topics">
          <h2 className="kc-h">Other topics</h2>
          <ul>{TOPICS.filter((o) => o.id !== t.id).map((o) => <li key={o.id}><Link href={`/learn/topics/${o.id}`}>{o.label}</Link></li>)}</ul>
        </nav>
      </div>
    </>
  );
}
