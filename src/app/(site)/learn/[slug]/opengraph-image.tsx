import { OG_SIZE, shareImage } from "@/lib/og";
import { ARTICLES, articleBySlug, topicById } from "@/lib/learn";

export const alt = "eGuard Knowledge Center guide";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const a = articleBySlug((await params).slug);
  return shareImage({ eyebrow: a ? topicById(a.topic)!.label : "Knowledge Center", title: a?.title ?? "Guides for parents", footer: "Free guides for Filipino parents" });
}
