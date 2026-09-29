import { NextResponse } from "next/server";
import { listBrowsers } from "@/lib/browser-service";
import { authed } from "@/lib/mobile-api";

/** The family's connected browsers (the eGuard browser extension). */
export const GET = authed(async ({ user }) => {
  const browsers = await listBrowsers(user.familyId);
  return NextResponse.json({
    browsers: browsers.map((b) => ({
      id: b.id, childId: b.childId, childName: b.child.name, deviceLabel: b.deviceLabel, browser: b.browser,
      browserVersion: b.browserVersion, extensionVersion: b.extensionVersion, platform: b.platform,
      lastSeenAt: b.lastSeenAt, connected: !b.revokedAt, createdAt: b.createdAt,
    })),
  });
});