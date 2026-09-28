import { OG_SIZE, shareImage } from "@/lib/og";
import { HELP_ARTICLES, HELP_CATEGORIES } from "@/lib/help";

export const alt = "eGuard help article";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = HELP_ARTICLES.find((x) => x.slug === slug);
  const category = HELP_CATEGORIES.find((c) => c.id === a?.category);
  return shareImage({ eyebrow: category?.name ?? "Help Center", title: a?.title ?? "eGuard Help Center" });
}
