import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { POSTS, postBySlug, postDate, readMinutes, type Block } from "@/lib/blog";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/site";
import { PageHead } from "../../page-head";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  if (!post) return {};
  return pageMetadata({ title: post.title, description: post.description, path: `/blog/${post.slug}`, type: "article", publishedTime: post.date, ownImage: true });
}

function Content({ block }: { block: Block }) {
  if ("h2" in block) return <h2>{block.h2}</h2>;
  if ("ul" in block) return <ul>{block.ul.map((li) => <li key={li}>{li}</li>)}</ul>;
  if ("ol" in block) return <ol>{block.ol.map((li) => <li key={li}>{li}</li>)}</ol>;
  if ("note" in block) return <p className="st-note">{block.note}</p>;
  return <p>{block.p}</p>;
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);
  const site = siteUrl();
  const url = `${site}/blog/${post.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BlogPosting", headline: post.title, description: post.description, datePublished: post.date, dateModified: post.date,
        url, mainEntityOfPage: url, inLanguage: "en-PH",
        author: { "@type": "Organization", name: "eGuard", url: site },
        publisher: { "@type": "Organization", "@id": `${site}/#org`, name: "eGuard", logo: `${site}/brand/logo-mark-512.png` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${site}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ] },
    ],
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(data)} />
      <PageHead eyebrow={post.tag} title={post.title} lede={post.description}>
        <div className="st-meta">
          <span>By the eGuard team</span>
          <time dateTime={post.date}>{postDate(post.date)}</time>
          <span>{readMinutes(post)} min read</span>
        </div>
      </PageHead>

      <div className="lp-wrap st-article">
        <Link href="/blog" className="st-back"><ArrowLeft />All posts</Link>
        <div className="st-prose" style={{ marginTop: 28 }}>
          {post.body.map((b, i) => <Content key={i} block={b} />)}
        </div>

        <div className="st-cta">
          <div>
            <h2>Try eGuard free</h2>
            <p>One child, every setting verified on the device. No card needed.</p>
          </div>
          <Link href="/register" className="lp-btn lp-btn-white">Get Started Free<ArrowRight /></Link>
        </div>

        {more.length ? (
          <nav className="st-more" aria-label="More posts">
            <h2>Keep reading</h2>
            <ul>
              {more.map((p) => (
                <li key={p.slug}><Link href={`/blog/${p.slug}`}><b>{p.title}</b><span>{readMinutes(p)} min read</span></Link></li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </article>
  );
}
