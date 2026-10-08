import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authDevice, badRequest, readJson, unauthorized } from "@/lib/device-auth";
import { LIMITS, hit } from "@/lib/rate-limit";

/** Furthest a device's local day can be from the server's UTC day (time zones run from UTC-12 to UTC+14). */
const MAX_SKEW_MS = 2 * 864e5;
/** How far back a device may send totals it couldn't upload (offline for a while). */
const MAX_BACKFILL_DAYS = 30;

/** A real calendar day near today: "2026-02-30" or a year-old date would otherwise become an Invalid Date or stray data. */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").refine((s) => {
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return false;
  const now = Date.now();
  return t <= now + MAX_SKEW_MS && t >= now - MAX_BACKFILL_DAYS * 864e5 - MAX_SKEW_MS;
}, `date must be a real day within the last ${MAX_BACKFILL_DAYS} days`);

const Body = z.object({
  date: day,
  totalMinutes: z.number().int().min(0).max(1440),
  // Trimmed so the same app isn't stored twice under " YouTube" and "YouTube" (same as /events)
  apps: z.array(z.object({ name: z.string().trim().min(1).max(80), minutes: z.number().int().min(0).max(1440) })).max(200).default([]),
  /** Optional minutes per local hour (index 0 = midnight), for the hourly chart */
  hourly: z.array(z.number().int().min(0).max(60)).length(24).optional(),
});

/** Different apps one device can report for one day; a phone uses far fewer. Past it, new names are ignored. */
const MAX_APPS_PER_DAY = 300;

/** Daily screen-time totals. Idempotent per device and day (the latest total wins). */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  // A looping or tampered device must not be able to write app rows without limit
  if ((await hit(`deviceusage:${device.id}`, LIMITS.deviceUsage)).limited) {
    return NextResponse.json({ error: "Too many usage reports. Send the next one in a few minutes." }, { status: 429 });
  }
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const { date: day, totalMinutes, hourly } = parsed.data;
  const date = new Date(`${day}T00:00:00.000Z`);
  // Each call may name 200 apps: without a cap per day, new names on every call would grow the table without end
  const known = new Set((await db.appUsageDaily.findMany({ where: { deviceId: device.id, date }, select: { app: true } })).map((r) => r.app));
  let room = MAX_APPS_PER_DAY - known.size;
  const apps = parsed.data.apps.filter((a) => known.has(a.name) || room-- > 0);
  await db.screenTimeDaily.upsert({
    where: { deviceId_date: { deviceId: device.id, date } },
    create: { deviceId: device.id, childId: device.childId, date, minutes: totalMinutes, hourly: hourly ?? [] },
    update: { minutes: totalMinutes, ...(hourly ? { hourly } : {}) },
  });
  // Per device: a child's phone and tablet each report their own minutes, summed when shown
  for (const a of apps) {
    await db.appUsageDaily.upsert({
      where: { deviceId_date_app: { deviceId: device.id, date, app: a.name } },
      create: { childId: device.childId, deviceId: device.id, date, app: a.name, minutes: a.minutes },
      update: { minutes: a.minutes },
    });
  }
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
