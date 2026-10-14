import { NextResponse } from "next/server";
import { listBrowsers } from "@/lib/browser-service";
import { browserStatus } from "@/lib/browser-status";
import { dayTime } from "@/lib/format";
import { authed } from "@/lib/mobile-api";
import { isOffline } from "@/lib/health";
import { getFamily } from "@/lib/queries";

/** The family's connected browsers (the eGuard browser extension). */
export const GET = authed(async ({ user }) => {
  const [browsers, family] = await Promise.all([listBrowsers(user.familyId), getFamily(user.familyId)]);
  return NextResponse.json({
    browsers: browsers.map((b) => {
      const [tone, label, note] = browserStatus(b);
      return {
        id: b.id, childId: b.childId, childName: b.child.name, deviceLabel: b.deviceLabel, browser: b.browser,
        browserVersion: b.browserVersion, extensionVersion: b.extensionVersion, platform: b.platform,
        lastSeenAt: b.lastSeenAt, lastSeenLabel: dayTime(b.lastSeenAt, family.timezone), connected: !b.revokedAt, createdAt: b.createdAt,
        // The extension's own answer from its latest health report, as the web's browser card shows it
        protectionState: b.protectionState, offline: isOffline(b),
        // What the web card says: disconnected and silent override what it last reported. Show these, don't re-derive.
        status: { tone: tone.replace(/^tone-/, ""), label, note: note || null },
      };
    }),
  });
});
