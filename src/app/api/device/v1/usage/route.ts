import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authDevice, badRequest, readJson, unauthorized } from "@/lib/device-auth";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalMinutes: z.number().int().min(0).max(1440),
  apps: z.array(z.object({ name: z.string().min(1).max(80), minutes: z.number().int().min(0).max(1440) })).max(200).default([]),
  /** Optional minutes per local hour (index 0 = midnight), for the hourly chart */
  hourly: z.array(z.number().int().min(0).max(60)).length(24).optional(),
});

/** Daily screen-time totals. Idempotent per device and day (the latest total wins). */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const { date: day, totalMinutes, apps, hourly } = parsed.data;
  const date = new Date(`${day}T00:00:00.000Z`);
  await db.screenTimeDaily.upsert({
    where: { deviceId_date: { deviceId: device.id, date } },
    create: { deviceId: device.id, childId: device.childId, date, minutes: totalMinutes, hourly: hourly ?? [] },
    update: { minutes: totalMinutes, ...(hourly ? { hourly } : {}) },
  });
  for (const a of apps) {
    await db.appUsageDaily.upsert({
      where: { childId_date_app: { childId: device.childId, date, app: a.name } },
      create: { childId: device.childId, date, app: a.name, minutes: a.minutes },
      update: { minutes: a.minutes },
    });
  }
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
