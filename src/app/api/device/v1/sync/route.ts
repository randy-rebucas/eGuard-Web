import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deviceSync } from "@/lib/engine";
import { entitlementsFor } from "@/lib/plans";
import { minChildAppVersion } from "@/lib/child-app";
import { authDevice, readJson, unauthorized } from "@/lib/device-auth";

const Body = z.object({
  battery: z.number().int().min(0).max(100).nullable().optional(),
  osVersion: z.string().max(40).optional(),
  appVersion: z.string().max(20).optional(),
}).default({});

/**
 * Heartbeat. Returns the child's full policy, configuration requests to apply (re-sent until the device reports on
 * them), app rules, and whether the parent asked for a full report (configuration check). Also what the device needs
 * to enforce and report correctly: the family's time zone, which plan features apply, and the oldest supported app.
 */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  const body = Body.safeParse((await readJson(req)) ?? {});
  const info = body.success ? body.data : {};
  const [sync, apps, family] = await Promise.all([
    deviceSync(device.id, info),
    db.childApp.findMany({ where: { childId: device.childId }, select: { name: true, approval: true, dailyLimitMinutes: true } }),
    db.family.findUniqueOrThrow({ where: { id: device.familyId }, select: { plan: true, timezone: true } }),
  ]);
  return NextResponse.json({
    deviceId: device.id,
    // Whose device this is now: a parent can move it to another child, so don't rely on the name from pairing
    childName: device.child.name,
    policy: sync.policy,
    requests: sync.requests,
    apps,
    fullReportRequested: sync.checkRequested,
    nextSyncSeconds: 300,
    // Days ("today", weekends, school nights) as the parent sees them; the device's own zone may differ
    timezone: family.timezone,
    // Location fixes are dropped on plans without location sharing, so the device shouldn't collect or send them
    features: { locationSharing: entitlementsFor(family.plan).locationSharing },
    // Below this, the app shows an update screen; null when no minimum is set (CHILD_MIN_APP_VERSION)
    minAppVersion: minChildAppVersion(device.platform),
  });
}
