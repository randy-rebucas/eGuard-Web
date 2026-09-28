import { OG_SIZE, siteShareImage } from "@/lib/og";
import { SITE_TAGLINE } from "@/lib/site";

export const alt = `eGuard: ${SITE_TAGLINE}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return siteShareImage();
}
