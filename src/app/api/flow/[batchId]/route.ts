import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { simulateTick } from "@/lib/simulator";
import { computeHealth, isOffline } from "@/lib/health";
import { describeConfig } from "@/lib/protections";

export async function GET(_req: Request, ctx: RouteContext<"/api/flow/[batchId]">) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { batchId } = await ctx.params;
  await simulateTick(u.familyId);
  const reqs = await db.configRequest.findMany({
    where: { batchId, child: { familyId: u.familyId } },
    include: { device: true },
    orderBy: { createdAt: "asc" },
  });
  if (!reqs.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const devices = await db.device.findMany({ where: { childId: reqs[0].childId }, include: { protections: true } });
  const health = computeHealth(devices);
  return NextResponse.json({
    requests: reqs.map((r) => ({
      id: r.id, deviceId: r.deviceId, deviceName: r.device.name, mode: r.mode, status: r.status,
      failureReason: r.failureReason, offline: isOffline(r.device),
      from: describeConfig(r.previous), to: describeConfig(r.desired),
    })),
    score: health.score,
  });
}
