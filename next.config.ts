import type { NextConfig } from "next";
import { META_PIXEL_ID, META_PIXEL_PATHS } from "./src/lib/meta-pixel";
import { CONSOLE_HOST } from "./src/lib/console-host";

const csp = (extraImg = "") =>
  `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; img-src 'self' data: blob:${extraImg}`;

/** Sent with every response. The app is never meant to be framed, and pages must never leak tokens in URLs via Referer. */
const securityHeaders = [
  // No other site may frame eGuard (clickjacking the dashboard or settings)
  // img-src: every image is our own, including map tiles (proxied by api/tiles), so no page can load a
  // third-party image that would reveal what a parent is looking at (the one exception is below: the Meta Pixel's
  // beacon, on public marketing pages, when it's on)
  { key: "Content-Security-Policy", value: csp() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Browsers ignore HSTS over plain http, so this is harmless in local development
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/**
 * Other addresses of the production site, sent permanently (308) to www.eguard.family so search engines see one
 * site. Vercel's domain settings should do the same; this covers them if they're missing. Preview deployments
 * (other *.vercel.app hosts) are left alone, and so is /api: webhooks and apps may still call the old host, and
 * not every client follows a redirect.
 */
const OLD_HOSTS = ["eguard.family", "e-guard-web.vercel.app"];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The staff console in development: http://console.localhost:3000 (docs/console.md)
  allowedDevOrigins: ["console.localhost"],
  // Pages prerender to a static shell; request-time parts (session, cookies) stream in behind <Suspense>
  cacheComponents: true,
  images: {
    // AVIF is ~20% smaller than WebP; browsers without it get WebP. Each format is encoded and cached separately.
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    // With the Meta Pixel on, the pages it runs on (and only those) also allow its image beacon. A later match
    // overrides the same header from an earlier one.
    const pixelCsp = { key: "Content-Security-Policy", value: csp(" https://www.facebook.com") };
    const pixelPages = META_PIXEL_ID ? ["/", ...META_PIXEL_PATHS.map((p) => `${p}/:path*`)] : [];
    return [
      { source: "/:path*", headers: securityHeaders },
      ...pixelPages.map((source) => ({ source, missing: [{ type: "host" as const, value: CONSOLE_HOST }], headers: [pixelCsp] })),
      // Nothing on the staff console belongs in search results, even if a link to it leaks
      { source: "/:path*", has: [{ type: "host" as const, value: CONSOLE_HOST }], headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async redirects() {
    return [
      ...OLD_HOSTS.map((host) => ({
        source: "/:path((?!api(?:/|$)).*)",
        has: [{ type: "host" as const, value: host }],
        destination: "https://www.eguard.family/:path",
        permanent: true,
      })),
      // Settings opens on its first section. Done here, not in a page: a page that only redirects can't render, so
      // instant-navigation validation fails on it.
      { source: "/settings", destination: "/settings/account", permanent: false },
    ];
  },
};

export default nextConfig;
