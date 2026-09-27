import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fmtMinutes } from "@/lib/protections";
import { authDevice, badRequest, readJson, unauthorized } from "@/lib/device-auth";

const Body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("APP_INSTALLED"), app: z.string().min(1).max(80), ageRating: z.number().int().optional() }),
  z.object({ type: z.literal("APP_REQUESTED"), app: z.string().min(1).max(80) }),
  z.object({ type: z.literal("LIMIT_REACHED"), minutes: z.number().int().min(0) }),
  z.object({ type: z.literal("APP_BLOCKED"), app: z.string().min(1).max(80) }),
]);

/** Repeated attempts to open the same blocked app raise one alert per this window. */
const BLOCKED_ALERT_WINDOW_MS = 60 * 60_000;
/** A device repeating "limit reached" (e.g. after a restart) raises one alert per this window. */
const LIMIT_ALERT_WINDOW_MS = 12 * 60 * 60_000;

/** Notable things that happened on the device. Protection changes are detected from /report instead. */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const e = parsed.data;
  const who = `${device.child.name}'s ${device.name}`;
  const base = { familyId: device.familyId, childId: device.childId, deviceId: device.id };

  if (e.type === "APP_INSTALLED") {
    const known = await db.childApp.findUnique({ where: { childId_name: { childId: device.childId, name: e.app } } });
    // Only a newly seen app is news; reinstalls and reports from a second device don't raise another alert
    if (!known) {
      await db.childApp.create({ data: { childId: device.childId, name: e.app } }).catch(() => {});
      await db.alert.create({ data: { ...base, severity: "INFO", category: "APPS", icon: "layout-grid", title: "New app installed",
        body: `${e.app} was installed${e.ageRating ? `. Rated ${e.ageRating}+` : ""}.`, subject: `${e.app} · ${who}` } });
    }
  } else if (e.type === "APP_REQUESTED") {
    const app = await db.childApp.findUnique({ where: { childId_name: { childId: device.childId, name: e.app } } });
    // A request never overrides the parent's decision to allow an app. Asking again for a blocked app is
    // allowed (it stays blocked until the parent approves); an open request isn't repeated.
    if (app?.approval === "ALLOWED" || app?.approval === "ALWAYS_ALLOWED" || app?.approval === "FILTERED") {
      return NextResponse.json({ ok: true, approval: app.approval });
    }
    const resolveKey = `APPREQ:${device.childId}:${e.app}`;
    await db.childApp.upsert({
      where: { childId_name: { childId: device.childId, name: e.app } },
      create: { childId: device.childId, name: e.app, approval: "PENDING" },
      update: { approval: "PENDING" },
    });
    const open = await db.alert.findFirst({ where: { familyId: device.familyId, resolveKey, resolvedAt: null } });
    if (!open) {
      await db.alert.create({ data: { ...base, severity: "ATTENTION", category: "APPS", icon: "app-window", title: "App approval requested",
        body: `${device.child.name} asked to install ${e.app}.`, subject: `${e.app} · ${who}`, resolveKey } });
    }
  } else if (e.type === "APP_BLOCKED") {
    const recent = await db.alert.findFirst({
      where: { ...base, title: "App blocked", subject: `${e.app} · ${who}`, createdAt: { gt: new Date(Date.now() - BLOCKED_ALERT_WINDOW_MS) } },
    });
    if (!recent) {
      await db.alert.create({ data: { ...base, severity: "INFO", category: "APPS", icon: "ban", title: "App blocked",
        body: `${device.child.name} tried to open ${e.app}, which is blocked.`, subject: `${e.app} · ${who}` } });
    }
  } else {
    const recent = await db.alert.findFirst({
      where: { ...base, title: "Screen time limit reached", createdAt: { gt: new Date(Date.now() - LIMIT_ALERT_WINDOW_MS) } },
    });
    if (!recent) {
      await db.alert.create({ data: { ...base, severity: "INFO", category: "SCREEN_TIME", icon: "hourglass", title: "Screen time limit reached",
        body: `${device.child.name} reached the ${fmtMinutes(e.minutes)} daily limit. Apps were paused as scheduled.`, subject: who } });
    }
  }
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
