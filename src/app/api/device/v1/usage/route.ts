import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authDevice, badRequest, readJson, unauthorized } from "@/lib/device-auth";
import { LIMITS, hit } from "@/lib/rate-limit";
import { AppIds, canonicalNames, rememberIds } from "@/lib/app-identity";

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
  // `ids`: the desktop agent's stable ids for the app (lib/app-identity), so one game under two names counts once
  apps: z.array(z.object({ name: z.string().trim().min(1).max(80), minutes: z.number().int().min(0).max(1440), ids: AppIds })).max(200).default([]),
  /** Optional minutes per local hour (index 0 = midnight), for the hourly chart */
  hourly: z.array(z.number().int().min(0).max(60)).length(24).optional(),
});

/** Different apps one device can report for one day; a phone uses far fewer. Past it, new names are ignored. */
const MAX_APPS_PER_DAY = 300;
/** Apps on one child's list. Past it, apps seen in usage aren't added (events still add them). */
const MAX_CHILD_APPS = 1000;

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
  // An app the child's list knows under another name (by id) is stored under that name; two entries that turn out to
  // be one app are added up
  const renamed = await canonicalNames(device.childId, device.platform, parsed.data.apps);
  const merged = new Map<string, { name: string; minutes: number; ids?: z.infer<typeof AppIds> }>();
  for (const a of parsed.data.apps) {
    const name = renamed.get(a.name) ?? a.name;
    const had = merged.get(name);
    merged.set(name, { name, minutes: Math.min(1440, (had?.minutes ?? 0) + a.minutes), ids: [...(had?.ids ?? []), ...(a.ids ?? [])] });
  }
  // Each call may name 200 apps: without a cap per day, new names on every call would grow the table without end
  const known = new Set((await db.appUsageDaily.findMany({ where: { deviceId: device.id, date }, select: { app: true } })).map((r) => r.app));
  let room = MAX_APPS_PER_DAY - known.size;
  const apps = [...merged.values()].filter((a) => known.has(a.name) || room-- > 0);
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
  // The device reports only apps installed after pairing (APP_INSTALLED): an app that was already on the phone
  // first shows up here. Put it on the child's list, allowed as it is today, so the parent can block or limit it.
  // No alert: it isn't new. "Others" is the device's bucket for unnamed apps, not an app.
  const named = apps.filter((a) => a.name !== "Others").map((a) => a.name);
  if (named.length) {
    const listed = await db.childApp.findMany({ where: { childId: device.childId, name: { in: named } }, select: { name: true } });
    const have = new Set(listed.map((l) => l.name));
    const fresh = named.filter((n) => !have.has(n));
    const room = fresh.length ? MAX_CHILD_APPS - await db.childApp.count({ where: { childId: device.childId } }) : 0;
    if (room > 0) {
      await db.childApp.createMany({ data: fresh.slice(0, room).map((name) => ({ childId: device.childId, name })), skipDuplicates: true });
    }
    await rememberIds(device.childId, device.platform, apps);
  }
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
