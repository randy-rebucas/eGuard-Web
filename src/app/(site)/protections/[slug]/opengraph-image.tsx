import { OG_SIZE, shareImage } from "@/lib/og";
import { PROTECTIONS, PROTECTION_BY_SLUG } from "@/lib/protections";
import { PROTECTION_PAGES } from "@/lib/protection-pages";

export const alt = "An eGuard protection";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return PROTECTIONS.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const def = PROTECTION_BY_SLUG[(await params).slug];
  return shareImage({ eyebrow: "eGuard protection", title: def ? PROTECTION_PAGES[def.key].title : "Protections" });
}
