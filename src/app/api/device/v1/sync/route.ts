import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deviceSync } from "@/lib/engine";
import { authDevice, readJson, unauthorized } from "@/lib/device-auth";

const Body = z.object({
  battery: z.number().int().min(0).max(100).nullable().optional(),
  osVersion: z.string().max(40).optional(),
  appVersion: z.string().max(20).optional(),
}).default({});

/**
 * Heartbeat. Returns the child's full policy, configuration requests to apply,
 * app rules, and whether the parent asked for a full report (configuration check).
 */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  const body = Body.safeParse((await readJson(req)) ?? {});
  const info = body.success ? body.data : {};
  const sync = await deviceSync(device.id, info);
  const apps = await db.childApp.findMany({ where: { childId: device.childId }, select: { name: true, approval: true, dailyLimitMinutes: true } });
  return NextResponse.json({
    deviceId: device.id,
    policy: sync.policy,
    requests: sync.requests,
    apps,
    fullReportRequested: sync.checkRequested,
    nextSyncSeconds: 300,
  });
}
