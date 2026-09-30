import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/blog";
import { HELP_ARTICLES } from "@/lib/help";
import { LEGAL } from "@/lib/legal";
import { PROTECTIONS } from "@/lib/protections";
import { AGE_GUIDES } from "@/lib/age-guides";
import { siteUrl } from "@/lib/site";

/** Public pages only. Signed-in pages are noindex and left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = siteUrl();
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly", lastModified?: string) =>
    ({ url: `${site}${path}`, priority, changeFrequency, ...(lastModified ? { lastModified } : {}) });
  const newestPost = POSTS.map((p) => p.date).sort().at(-1);

  return [
    page("", 1, "weekly"),
    page("/about", 0.6, "monthly"),
    page("/how-it-works", 0.8, "monthly"),
    page("/protections", 0.8, "monthly"),
    ...PROTECTIONS.map((p) => page(`/protections/${p.slug}`, 0.7, "monthly")),
    page("/pricing", 0.8, "monthly"),
    page("/guides", 0.7, "monthly"),
    ...AGE_GUIDES.map((g) => page(`/guides/${g.slug}`, 0.6, "monthly")),
    page("/security", 0.6, "monthly"),
    page("/for-kids", 0.6, "monthly"),
    page("/blog", 0.7, "weekly", newestPost),
    ...POSTS.map((p) => page(`/blog/${p.slug}`, 0.7, "monthly", p.date)),
    page("/help", 0.7, "monthly"),
    ...HELP_ARTICLES.map((a) => page(`/help/${a.slug}`, 0.6, "monthly")),
    page("/register", 0.5, "yearly"),
    page("/login", 0.3, "yearly"),
    page("/privacy", 0.3, "yearly", LEGAL.updated),
    page("/terms", 0.3, "yearly", LEGAL.updated),
    page("/delete-account", 0.3, "yearly", LEGAL.updated),
  ];
}
