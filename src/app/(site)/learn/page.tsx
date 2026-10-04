import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ARTICLES, TOPICS, articleBySlug, articlesIn, topicById } from "@/lib/learn";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { PageHead } from "../page-head";
import { LearnSearch } from "./search";
import "./learn.css";

export const metadata: Metadata = pageMetadata({
  title: "Knowledge Center: child online safety guides for Filipino parents",
  path: "/learn",
  description: "100 free, practical guides on parental controls, screen time, cyberbullying, TikTok, Roblox, Discord, AI and digital parenting in the Philippines.",
});

/** Where a parent new to all this should begin. */
const START = ["how-to-protect-kids-online", "first-phone-checklist", "how-much-screen-time-by-age", "online-grooming-warning-signs", "talking-to-kids-about-online-life", "report-online-child-abuse-philippines"];

export default function LearnPage() {
  const site = siteUrl();
  const start = START.map(articleBySlug).filter((a) => a !== null);
  const items = ARTICLES.map((a) => ({ slug: a.slug, title: a.title, description: a.description, topic: topicById(a.topic)!.label }));
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "eGuard Knowledge Center",
    url: `${site}/learn`,
    inLanguage: "en-PH",
    hasPart: TOPICS.map((t) => ({ "@type": "CollectionPage", name: t.title, url: `${site}/learn/topics/${t.id}` })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
      <PageHead
        eyebrow="Knowledge Center"
        title="Keeping kids safe online, explained for Filipino parents"
        lede="Free, practical guides on screen time, parental controls, cyberbullying, the apps and games your kids use, and what to do when something goes wrong. Written in plain language, checked regularly."
      >
        <LearnSearch items={items} />
      </PageHead>

      <div className="kc">
        <section aria-labelledby="kc-start">
          <h2 id="kc-start" className="kc-h">Start here</h2>
          <ol className="kc-start">
            {start.map((a, i) => (
              <li key={a.slug}>
                <Link href={`/learn/${a.slug}`}><span className="kc-n">{i + 1}</span><b>{a.title}</b><ArrowRight /></Link>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="kc-topics" className="kc-sec">
          <h2 id="kc-topics" className="kc-h">Browse by topic</h2>
          <ul className="kc-topics">
            {TOPICS.map((t) => {
              const list = articlesIn(t.id);
              return (
                <li key={t.id} className="kc-topic">
                  <Link href={`/learn/topics/${t.id}`} className="kc-topic-head">
                    <h3>{t.label}</h3>
                    <span>{list.length} guides<ArrowRight /></span>
                  </Link>
                  <p>{t.description}</p>
                  <ul>
                    {list.slice(0, 4).map((a) => <li key={a.slug}><Link href={`/learn/${a.slug}`}>{a.title}</Link></li>)}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="st-note kc-disclaimer">
          These guides are general information, not legal, medical or psychological advice. App settings change often, so
          each guide shows when it was last checked. If a child is in danger right now, call <b>911</b>. To report online
          abuse of a child, see <Link href="/learn/report-online-child-abuse-philippines">how to report in the Philippines</Link>.
        </p>
      </div>
    </>
  );
}
