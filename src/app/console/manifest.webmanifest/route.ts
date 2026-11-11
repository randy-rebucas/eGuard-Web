/**
 * console.eguard.family/manifest.webmanifest. Every page links the manifest (app/manifest.ts sets it for the whole app),
 * and on this host the site's isn't served: without this, the browser got the sign-in redirect or the console's 404
 * page and logged "Manifest: Syntax error" on every page. The console's own: its name, and it opens at its dashboard.
 */
export function GET() {
  const manifest = {
    name: "eGuard Console",
    short_name: "eGuard Console",
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: "#F6FAFF",
    theme_color: "#1560DB",
    icons: [
      { src: "/brand/logo-mark-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
