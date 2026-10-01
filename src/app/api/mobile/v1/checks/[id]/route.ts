import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeHealth } from "@/lib/health";
import { finalizeCheckRun } from "@/lib/engine";
import { notFound } from "@/lib/errors";
import { authed } from "@/lib/mobile-api";
import { simulateTick } from "@/lib/simulator";

/** Check progress. Devices that don't answer within the timeout are marked unreachable. */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  if (!(await db.checkRun.findFirst({ where: { id: params.id, familyId: user.familyId } }))) throw notFound("Check");
  await simulateTick(user.familyId);
  const run = await finalizeCheckRun(params.id);
  const results = await db.checkRunResult.findMany({ where: { runId: params.id }, include: { device: { include: { child: true } } } });
  // Score the devices this check covered: a check of one device shouldn't report the family's score
  const devices = await db.device.findMany({ where: { familyId: user.familyId, id: { in: results.map((r) => r.deviceId) } }, include: { protections: true } });
  const health = computeHealth(devices);
  return NextResponse.json({
    status: run!.status,
    done: run!.status === "COMPLETED",
    // A full score with offline devices is their last known state, not a verification
    health: { score: health.score, total: health.total, verified: health.verified, offline: health.offline },
    results: results.map((r) => ({
      deviceId: r.deviceId, deviceName: r.device.name, childName: r.device.child.name,
      reachable: r.reachable, issues: r.issues, reported: !!r.reportedAt,
    })),
  });
});
