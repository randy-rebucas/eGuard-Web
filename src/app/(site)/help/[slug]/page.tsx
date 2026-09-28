import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { HELP_ARTICLES, HELP_CATEGORIES } from "@/lib/help";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { supportEmail } from "@/lib/support";
import { PageHead } from "../../page-head";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

const articleBySlug = (slug: string) => HELP_ARTICLES.find((a) => a.slug === slug) ?? null;

export async function generateMetadata({ params }: PageProps<"/help/[slug]">): Promise<Metadata> {
  const a = articleBySlug((await params).slug);
  if (!a) return {};
  return pageMetadata({ title: a.title, description: a.summary, path: `/help/${a.slug}`, type: "article", ownImage: true });
}

export default async function HelpArticlePage({ params }: PageProps<"/help/[slug]">) {
  const a = articleBySlug((await params).slug);
  if (!a) notFound();
  const category = HELP_CATEGORIES.find((c) => c.id === a.category)!;
  const related = HELP_ARTICLES.filter((x) => x.category === a.category && x.slug !== a.slug).slice(0, 2);
  const site = siteUrl();
  const url = `${site}/help/${a.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "TechArticle", headline: a.title, description: a.summary, url, mainEntityOfPage: url, inLanguage: "en-PH",
        author: { "@type": "Organization", name: "eGuard", url: site },
        publisher: { "@type": "Organization", "@id": `${site}/#org`, name: "eGuard", logo: `${site}/brand/logo-mark-512.png` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Help Center", item: `${site}/help` },
        { "@type": "ListItem", position: 3, name: a.title, item: url },
      ] },
    ],
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
      <PageHead eyebrow={category.name} title={a.title} lede={a.summary} />
      <div className="lp-wrap st-article">
        <Link href="/help" className="st-back"><ArrowLeft />Help Center</Link>
        <div className="st-prose" style={{ marginTop: 28 }}>
          {a.body.map((p) => <p key={p}>{p}</p>)}
          {a.category === "SETUP" ? (
            <p className="st-note">The eGuard apps for Android and iOS are coming soon. Steps that install eGuard on a device apply once they&apos;re out; everything else works on the web today.</p>
          ) : null}
          <p className="st-note">Still stuck? Write to <a href={`mailto:${supportEmail()}`}>{supportEmail()}</a>.</p>
        </div>

        <div className="st-cta">
          <div>
            <h2>Try eGuard free</h2>
            <p>One child, every setting verified on the device. No card needed.</p>
          </div>
          <Link href="/register" className="lp-btn lp-btn-white">Get Started Free<ArrowRight /></Link>
        </div>

        {related.length ? (
          <nav className="st-more" aria-label="Related articles">
            <h2>Related articles</h2>
            <ul>
              {related.map((r) => <li key={r.slug}><Link href={`/help/${r.slug}`}><b>{r.title}</b><span>{r.summary}</span></Link></li>)}
            </ul>
          </nav>
        ) : null}
      </div>
    </article>
  );
}
