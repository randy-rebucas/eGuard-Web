import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { POSTS, postDate, readMinutes } from "@/lib/blog";
import { pageMetadata } from "@/lib/site";
import { PageHead } from "../page-head";

export const metadata: Metadata = pageMetadata({
  title: "Parental control guides for Filipino parents",
  path: "/blog",
  description: "Guides for parents on screen time, bedtime and app rules for kids' phones, and how eGuard checks that each setting is really on.",
});

export default function BlogPage() {
  return (
    <>
      <PageHead
        eyebrow="Blog"
        title="Guides for safer, calmer screen time"
        lede="Practical setup guides for parents, and how eGuard makes sure every setting is really on."
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
    </>
  );
}
