import type { NextConfig } from "next";

/** Sent with every response. The app is never meant to be framed, and pages must never leak tokens in URLs via Referer. */
const securityHeaders = [
  // No other site may frame eGuard (clickjacking the dashboard or settings)
  // img-src: every image is our own, including map tiles (proxied by api/tiles), so no page can load a
  // third-party image that would reveal what a parent is looking at
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; img-src 'self' data: blob:" },
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
  // Pages prerender to a static shell; request-time parts (session, cookies) stream in behind <Suspense>
  cacheComponents: true,
  images: {
    // AVIF is ~20% smaller than WebP; browsers without it get WebP. Each format is encoded and cached separately.
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
