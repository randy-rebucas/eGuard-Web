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
    await db.childApp.upsert({
      where: { childId_name: { childId: device.childId, name: e.app } },
      create: { childId: device.childId, name: e.app },
      update: {},
    });
    await db.alert.create({ data: { ...base, severity: "INFO", category: "APPS", icon: "layout-grid", title: "New app installed",
      body: `${e.app} was installed${e.ageRating ? `. Rated ${e.ageRating}+` : ""}.`, subject: `${e.app} · ${who}` } });
  } else if (e.type === "APP_REQUESTED") {
    await db.childApp.upsert({
      where: { childId_name: { childId: device.childId, name: e.app } },
      create: { childId: device.childId, name: e.app, approval: "PENDING" },
      update: { approval: "PENDING" },
    });
    await db.alert.create({ data: { ...base, severity: "ATTENTION", category: "APPS", icon: "app-window", title: "App approval requested",
      body: `${device.child.name} asked to install ${e.app}.`, subject: `${e.app} · ${who}`, resolveKey: `APPREQ:${device.childId}:${e.app}` } });
  } else if (e.type === "APP_BLOCKED") {
    const recent = await db.alert.findFirst({
      where: { ...base, title: "App blocked", subject: `${e.app} · ${who}`, createdAt: { gt: new Date(Date.now() - BLOCKED_ALERT_WINDOW_MS) } },
    });
    if (!recent) {
      await db.alert.create({ data: { ...base, severity: "INFO", category: "APPS", icon: "ban", title: "App blocked",
        body: `${device.child.name} tried to open ${e.app}, which is blocked.`, subject: `${e.app} · ${who}` } });
    }
  } else {
    await db.alert.create({ data: { ...base, severity: "INFO", category: "SCREEN_TIME", icon: "hourglass", title: "Screen time limit reached",
      body: `${device.child.name} reached the ${fmtMinutes(e.minutes)} daily limit. Apps were paused as scheduled.`, subject: who } });
  }
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
