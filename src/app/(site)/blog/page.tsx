import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { POSTS, postDate, readMinutes } from "@/lib/blog";
import { FREE_CHILDREN } from "@/lib/plans";
import { pageMetadata } from "@/lib/site";
import { StartLink } from "@/components/signed-in";
import { PageHead } from "../page-head";

/**
 * The blog is for eGuard itself: product news, plans and how it works. Parenting advice lives in the
 * Knowledge Center (/learn), so the two don't compete for the same searches.
 */
export const metadata: Metadata = pageMetadata({
  title: "eGuard blog: product news and how eGuard works",
  path: "/blog",
  description: "News from eGuard: new protections and apps, what each plan covers, and how eGuard checks that every setting is really on.",
});

export default function BlogPage() {
  return (
    <>
      <PageHead
        eyebrow="Blog"
        title="News and notes from eGuard"
        lede={<>What&apos;s new in eGuard, what each plan covers, and the thinking behind how it works. Looking for parenting advice? See the <Link href="/learn">Knowledge Center</Link>.</>}
      />
      <ul className="st-posts">
        {POSTS.map((p) => (
          <li key={p.slug} className="st-post-card">
            <Link href={`/blog/${p.slug}`}>
              <span className="st-tag">{p.tag}</span>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
              <span className="st-post-meta">
                <time dateTime={p.date}>{postDate(p.date)}</time>·<span>{readMinutes(p)} min read</span><ArrowRight />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="lp-wrap">
        <div className="st-cta">
          <div>
            <h2>See it on your own family&apos;s devices</h2>
            <p>Free for {FREE_CHILDREN}. No card needed.</p>
          </div>
          <StartLink className="lp-btn lp-btn-white" />
        </div>
      </div>
    </>
  );
}
