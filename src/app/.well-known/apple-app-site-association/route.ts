import { NextResponse } from "next/server";

/**
 * Universal links: emailed verify, reset and invitation links open the iPhone app (which has screens for each) when
 * it's installed, and this website otherwise. APPLE_APP_IDS ("TEAMID.bundle.id", comma-separated) overrides the
 * App Store app. Apple fetches this through its CDN, so it must be public JSON at exactly this path.
 */
const APP_IDS = (process.env.APPLE_APP_IDS ?? "4FQJ8S5TWT.com.devcom.eguard").split(",").map((s) => s.trim()).filter(Boolean);

const LINKS = ["/verify-email", "/reset-password", "/accept-invite"];

export function GET() {
  return NextResponse.json(
    {
      applinks: {
        details: [{ appIDs: APP_IDS, components: LINKS.map((path) => ({ "/": path, "?": { token: "?*" } })) }],
      },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
