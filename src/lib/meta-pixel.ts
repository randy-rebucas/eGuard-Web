/**
 * Meta (Facebook) Pixel, for measuring Facebook ads. Off unless NEXT_PUBLIC_META_PIXEL_ID is set at build time, and
 * the privacy policy describes it only when it's on, so the policy and the pixel always ship in the same build.
 *
 * It runs on public marketing pages only: never on sign-in or signed-in pages, where children's names and locations
 * appear, and never on /for-kids, which is written for children (Meta's terms forbid the pixel on pages directed at
 * children). /delete-account is left out too: a parent leaving shouldn't be measured.
 */
const id = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
export const META_PIXEL_ID = id && /^\d+$/.test(id) ? id : null;

/** Public pages the pixel may run on, besides the landing page. Each covers its subpages. */
export const META_PIXEL_PATHS = [
  "/about", "/blog", "/guides", "/help", "/how-it-works", "/learn", "/pricing", "/privacy", "/protections", "/security", "/terms",
];

export const metaPixelAllowed = (pathname: string) =>
  pathname === "/" || META_PIXEL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
