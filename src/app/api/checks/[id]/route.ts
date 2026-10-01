import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { simulateTick } from "@/lib/simulator";
import { finalizeCheckRun } from "@/lib/engine";
import { computeHealth } from "@/lib/health";

export async function GET(_req: Request, ctx: RouteContext<"/api/checks/[id]">) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const exists = await db.checkRun.findFirst({ where: { id, familyId: u.familyId } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await simulateTick(u.familyId);
  const run = await finalizeCheckRun(id);
  const results = await db.checkRunResult.findMany({ where: { runId: id }, include: { device: { include: { child: true } } } });
  // Score the devices this check covered: a check of one device shouldn't report the family's score
  const devices = await db.device.findMany({ where: { familyId: u.familyId, id: { in: results.map((r) => r.deviceId) } }, include: { protections: true } });
  const health = computeHealth(devices);
  return NextResponse.json({
    status: run?.status,
    score: health.score,
    verified: health.verified,
    offline: health.offline,
    results: results.map((r) => ({
      deviceId: r.deviceId, deviceName: r.device.name, childName: r.device.child.name,
      reachable: r.reachable, issues: r.issues, reported: !!r.reportedAt,
    })),
  });
}
