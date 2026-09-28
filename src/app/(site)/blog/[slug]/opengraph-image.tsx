import { OG_SIZE, shareImage } from "@/lib/og";
import { POSTS, postBySlug } from "@/lib/blog";

export const alt = "eGuard blog post";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = postBySlug((await params).slug);
  return shareImage({ eyebrow: post?.tag ?? "Blog", title: post?.title ?? "The eGuard blog" });
}
