import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deviceSync } from "@/lib/engine";
import { entitlementsFor } from "@/lib/plans";
import { minChildAppVersion } from "@/lib/child-app";
import { categoryOf } from "@/lib/app-categories";
import { authDevice, readJson, TOO_LARGE, tooLarge, unauthorized } from "@/lib/device-auth";
import { activeExtraTime } from "@/lib/family-service";
import { idsByApp } from "@/lib/app-identity";
import { signUninstall } from "@/lib/device-removal";
import { browserLink } from "@/lib/browser-link";
import { ScreenTimeAuthorization, screenTimeAuthorizationUpdate } from "@/lib/screen-time-authorization";

const Body = z.object({
  battery: z.number().int().min(0).max(100).nullable().optional(),
  osVersion: z.string().max(40).optional(),
  appVersion: z.string().max(20).optional(),
  // FCM registration token for silent "sync now" wakes; null when the device can't receive push any more
  pushToken: z.string().min(1).max(4096).nullable().optional(),
  // iOS: how its Screen Time permission was granted ("individual": the child approved it and can revoke it).
  // An unknown value is dropped rather than failing the heartbeat
  screenTimeAuthorization: ScreenTimeAuthorization.optional().catch(undefined),
}).default({});

/**
 * Heartbeat. Returns the child's full policy, configuration requests to apply (re-sent until the device reports on
 * them), app rules (each app's category, and daily limits per category on plans that include them), and whether the parent asked for a full report (configuration check). Also what the device needs
 * to enforce and report correctly: the family's time zone, which plan features apply, and the oldest supported app.
 */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  const raw = await readJson(req);
  if (raw === TOO_LARGE) return tooLarge();
  const body = Body.safeParse(raw ?? {});
  const { screenTimeAuthorization, ...info } = body.success ? body.data : {};
  const computer = device.kind === "COMPUTER";
  // Android matches app rules by package (`packageName` below); computers by all their ids
  const withIds = computer || device.platform === "ANDROID";
  // Written only when it changes, so a heartbeat doesn't rewrite the row
  const authorization = screenTimeAuthorizationUpdate(device, screenTimeAuthorization);
  if (authorization) await db.device.update({ where: { id: device.id }, data: { accounts: authorization } });
  const [sync, apps, family, categoryLimits, ids] = await Promise.all([
    deviceSync(device.id, info),
    db.childApp.findMany({ where: { childId: device.childId }, select: { name: true, approval: true, dailyLimitMinutes: true, category: true } }),
    db.family.findUniqueOrThrow({ where: { id: device.familyId }, select: { plan: true, timezone: true } }),
    db.childCategoryLimit.findMany({ where: { childId: device.childId }, select: { category: true, dailyLimitMinutes: true } }),
    withIds ? idsByApp(device.childId, device.platform) : null,
  ]);
  const ent = entitlementsFor(family.plan);
  const extraTime = activeExtraTime(device.child);
  return NextResponse.json({
    deviceId: device.id,
    // Whose device this is now: a parent can move it to another child, so don't rely on the name from pairing
    childName: device.child.name,
    policy: sync.policy,
    requests: sync.requests,
    // The category is the parent's choice or eGuard's guess; the device counts each app toward its category's limit
    // Computers also get each app's ids on their platform, to match the processes they see against
    // Android gets `packageName`: the app's package as Android reported it in `ids` (kind PACKAGE, stored lowercase),
    // null when it never did, so the device matches by package and falls back to the name
    apps: apps.map((a) => ({
      name: a.name, approval: a.approval, dailyLimitMinutes: a.dailyLimitMinutes, category: categoryOf(a).category,
      ...(computer && ids ? { ids: ids.get(a.name) ?? [] } : {}),
      ...(!computer && ids ? { packageName: ids.get(a.name)?.find((i) => i.kind === "PACKAGE")?.value ?? null } : {}),
    })),
    // Kept, not deleted, when a plan without them ends; only not sent (nor enforced) until the family upgrades again
    categoryLimits: ent.categoryLimits ? categoryLimits : [],
    // Extra time a parent gave: until then, limits and bedtime don't pause apps (blocked apps stay blocked). null when none
    extraTimeUntil: extraTime?.toISOString() ?? null,
    fullReportRequested: sync.checkRequested,
    // While extra time runs, a parent's "End now" should reach the device within a minute, not five. Computers have
    // no push to wake them, so they always come back within a minute: a parent's "allow", more time or a removal
    // reaches them about as quickly as a phone's silent push
    nextSyncSeconds: computer || extraTime || device.removalRequestedAt ? 60 : 300,
    // Days ("today", weekends, school nights) as the parent sees them; the device's own zone may differ
    timezone: family.timezone,
    // Location fixes are dropped on plans without location sharing, so the device shouldn't collect or send them
    features: { locationSharing: ent.locationSharing, categoryLimits: ent.categoryLimits },
    // Below this, the app shows an update screen; null when no minimum is set (CHILD_MIN_APP_VERSION)
    minAppVersion: minChildAppVersion(device.platform),
    // Computers count days and bedtime by eGuard's clock, so changing the computer's clock doesn't buy time
    ...(computer ? {
      serverTime: new Date().toISOString(),
      // A parent removed this computer: eGuard's signed command to uninstall (lib/device-removal). null otherwise
      uninstall: device.removalRequestedAt ? signUninstall(device.id, device.removalRequestedAt) : null,
      // For the eGuard extension's managed policy: browsers that pair with it are part of this computer (lib/browser-link)
      browserLink: device.removalRequestedAt ? null : browserLink(device),
    } : {}),
  });
}
