import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { startCheckRun } from "@/lib/engine";
import { audit } from "@/lib/family-service";
import { notFound } from "@/lib/errors";
import { authed, body } from "@/lib/mobile-api";

/** Run a configuration check on every device, or one (`deviceId`). Poll /checks/{runId}. */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, z.object({ deviceId: z.string().optional() }));
  if (b.deviceId && !(await db.device.findFirst({ where: { id: b.deviceId, familyId: user.familyId } }))) throw notFound("Device");
  const run = await startCheckRun(user.familyId, b.deviceId ? [b.deviceId] : undefined);
  await audit(user.familyId, user.name, "check.started", b.deviceId ?? "all devices");
  return NextResponse.json({ runId: run.id }, { status: 202 });
});
