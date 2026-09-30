import { OG_SIZE, shareImage } from "@/lib/og";
import { AGE_GUIDES, ageGuide } from "@/lib/age-guides";

export const alt = "An eGuard guide for parents";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return AGE_GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const g = ageGuide((await params).slug);
  return shareImage({ eyebrow: g ? `Parent guide · ${g.label}` : "Parent guides", title: g?.title ?? "Guides by age" });
}
