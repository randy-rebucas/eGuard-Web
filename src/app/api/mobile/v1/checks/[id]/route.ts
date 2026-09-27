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
  const [results, devices] = await Promise.all([
    db.checkRunResult.findMany({ where: { runId: params.id }, include: { device: { include: { child: true } } } }),
    db.device.findMany({ where: { familyId: user.familyId }, include: { protections: true } }),
  ]);
  const health = computeHealth(devices);
  return NextResponse.json({
    status: run!.status,
    done: run!.status === "COMPLETED",
    health: { score: health.score, total: health.total },
    results: results.map((r) => ({
      deviceId: r.deviceId, deviceName: r.device.name, childName: r.device.child.name,
      reachable: r.reachable, issues: r.issues, reported: !!r.reportedAt,
    })),
  });
});
