import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fmtMinutes } from "@/lib/protections";
import { createAlertUnless } from "@/lib/engine";
import { authDevice, badRequest, readJson, unauthorized } from "@/lib/device-auth";
import { LIMITS, hit } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/errors";

/** Trimmed, so " YouTube" and "YouTube" are one app, and a blank name is refused */
const appName = z.string().trim().min(1, "app is required").max(80);

const Body = z.discriminatedUnion("type", [
  // Same bounds as a reported age rating (ReportedConfigSchema)
  z.object({ type: z.literal("APP_INSTALLED"), app: appName, ageRating: z.number().int().min(0).max(21).optional() }),
  z.object({ type: z.literal("APP_REQUESTED"), app: appName }),
  z.object({ type: z.literal("LIMIT_REACHED"), minutes: z.number().int().min(0).max(1440) }),
  z.object({ type: z.literal("APP_BLOCKED"), app: appName }),
]);

/** Repeated attempts to open the same blocked app raise one alert per this window. */
const BLOCKED_ALERT_WINDOW_MS = 60 * 60_000;
/** A child asking again for an app the parent blocked raises one alert per this window. */
const DECLINED_REQUEST_WINDOW_MS = 24 * 60 * 60_000;
/** A device repeating "limit reached" (e.g. after a restart) raises one alert per this window. */
const LIMIT_ALERT_WINDOW_MS = 12 * 60 * 60_000;

/** Notable things that happened on the device. Protection changes are detected from /report instead. */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  // A device token must not be able to fill the family's app list and alert feed without limit
  if ((await hit(`deviceevents:${device.id}`, LIMITS.deviceEvents)).limited) {
    return NextResponse.json({ error: "Too many events. eGuard will accept the next one shortly." }, { status: 429 });
  }
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const e = parsed.data;
  const who = `${device.child.name}'s ${device.name}`;
  const base = { familyId: device.familyId, childId: device.childId, deviceId: device.id };

  if (e.type === "APP_INSTALLED") {
    // Only a newly seen app is news; reinstalls and reports from a second device don't raise another alert.
    // Whoever creates the row raises it, so two devices reporting the same app at once raise one alert, not two.
    const created = await db.childApp.create({ data: { childId: device.childId, name: e.app } }).then(() => true, (err) => {
      if (isUniqueViolation(err)) return false;
      throw err;
    });
    if (created) {
      await db.alert.create({ data: { ...base, severity: "INFO", category: "APPS", icon: "layout-grid", title: "New app installed",
        body: `${e.app} was installed${e.ageRating ? `. Rated ${e.ageRating}+` : ""}.`, subject: `${e.app} · ${who}` } });
    }
  } else if (e.type === "APP_REQUESTED") {
    const app = await db.childApp.findUnique({ where: { childId_name: { childId: device.childId, name: e.app } } });
    // A request never overrides the parent's decision. An allowed app has nothing to ask for.
    if (app?.approval === "ALLOWED" || app?.approval === "ALWAYS_ALLOWED" || app?.approval === "FILTERED") {
      return NextResponse.json({ ok: true, approval: app.approval });
    }
    const resolveKey = `APPREQ:${device.childId}:${e.app}`;
    if (app?.approval === "BLOCKED") {
      // A blocked app stays blocked. Asking again is passed on, but at most once per window, so a
      // declined request can't be turned into a stream of alerts.
      await createAlertUnless(resolveKey,
        { familyId: device.familyId, resolveKey, OR: [{ resolvedAt: null }, { createdAt: { gt: new Date(Date.now() - DECLINED_REQUEST_WINDOW_MS) } }] },
        { ...base, severity: "ATTENTION", category: "APPS", icon: "app-window", title: "App approval requested",
          body: `${device.child.name} asked again for ${e.app}, which you blocked.`, subject: `${e.app} · ${who}`, resolveKey });
      await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return NextResponse.json({ ok: true, approval: app.approval });
    }
    await db.childApp.upsert({
      where: { childId_name: { childId: device.childId, name: e.app } },
      create: { childId: device.childId, name: e.app, approval: "PENDING" },
      update: { approval: "PENDING" },
    });
    // Asking several times in a row (or from two devices) raises one request
    await createAlertUnless(resolveKey, { familyId: device.familyId, resolveKey, resolvedAt: null },
      { ...base, severity: "ATTENTION", category: "APPS", icon: "app-window", title: "App approval requested",
        body: `${device.child.name} asked to install ${e.app}.`, subject: `${e.app} · ${who}`, resolveKey });
  } else if (e.type === "APP_BLOCKED") {
    await createAlertUnless(`APPBLOCKED:${device.id}:${e.app}`,
      { ...base, title: "App blocked", subject: `${e.app} · ${who}`, createdAt: { gt: new Date(Date.now() - BLOCKED_ALERT_WINDOW_MS) } },
      { ...base, severity: "INFO", category: "APPS", icon: "ban", title: "App blocked",
        body: `${device.child.name} tried to open ${e.app}, which is blocked.`, subject: `${e.app} · ${who}` });
  } else {
    await createAlertUnless(`LIMIT:${device.id}`,
      { ...base, title: "Screen time limit reached", createdAt: { gt: new Date(Date.now() - LIMIT_ALERT_WINDOW_MS) } },
      { ...base, severity: "INFO", category: "SCREEN_TIME", icon: "hourglass", title: "Screen time limit reached",
        body: `${device.child.name} reached the ${fmtMinutes(e.minutes)} daily limit. Apps were paused as scheduled.`, subject: who });
  }
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
