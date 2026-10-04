import { OG_SIZE, shareImage } from "@/lib/og";
import { TOPICS, topicById } from "@/lib/learn";

export const alt = "eGuard Knowledge Center topic";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return TOPICS.map((t) => ({ topic: t.id }));
}

export default async function Image({ params }: { params: Promise<{ topic: string }> }) {
  const t = topicById((await params).topic);
  return shareImage({ eyebrow: "Knowledge Center", title: t?.title ?? "Guides for parents", footer: "Free guides for Filipino parents" });
}
