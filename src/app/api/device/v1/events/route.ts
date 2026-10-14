import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fmtMinutes } from "@/lib/protections";
import { createAlertUnless, resolveAlerts } from "@/lib/engine";
import { authDevice, badRequest, readJson, unauthorized } from "@/lib/device-auth";
import { LIMITS, clearLimit, hit } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/errors";
import { CATEGORY_BY_KEY, CATEGORY_KEYS } from "@/lib/app-categories";
import { APPS_UPGRADE, mayNameApp } from "@/lib/plan-access";
import { timeRequestKey } from "@/lib/family-service";

/** Trimmed, so " YouTube" and "YouTube" are one app, and a blank name is refused */
const appName = z.string().trim().min(1, "app is required").max(80);

const Body = z.discriminatedUnion("type", [
  // Same bounds as a reported age rating (ReportedConfigSchema)
  z.object({ type: z.literal("APP_INSTALLED"), app: appName, ageRating: z.number().int().min(0).max(21).optional() }),
  z.object({ type: z.literal("APP_REQUESTED"), app: appName }),
  // `category`: a category limit (sync's categoryLimits) was used up, rather than the whole day's screen time
  z.object({ type: z.literal("LIMIT_REACHED"), minutes: z.number().int().min(0).max(1440), category: z.enum(CATEGORY_KEYS).optional() }),
  z.object({ type: z.literal("APP_BLOCKED"), app: appName }),
  // "Ask for more time" on a block screen: `app` is the app the child was in, `reason` why it was paused
  z.object({ type: z.literal("TIME_REQUESTED"), app: appName.optional(), reason: z.enum(["DAILY_LIMIT", "APP_LIMIT", "CATEGORY_LIMIT", "BEDTIME"]).optional() }),
  // Android: the phone was switched to another user or a guest profile, where eGuard doesn't run, and back
  z.object({ type: z.literal("USER_LEFT") }),
  z.object({ type: z.literal("USER_RETURNED"), awayMinutes: z.number().int().min(0).max(14 * 1440) }),
]);

/**
 * Android 1.0.7 and earlier send `APP_REQUEST` and `NEW_APP`, and their "Ask for more time" button sends
 * `APP_REQUEST` for the paused app. An app the parent already allowed only shows a block screen for a limit or
 * bedtime, so a legacy request for one is a request for more time.
 */
const LEGACY_TYPES: Record<string, string> = { APP_REQUEST: "APP_REQUESTED", NEW_APP: "APP_INSTALLED" };
/** Devices block FILTERED apps (child-app-spec §7), so asking for one goes to the parent like a blocked app. */
const ALLOWED = ["ALLOWED", "ALWAYS_ALLOWED"];

/** Optional on every event: an id the device makes once per event (e.g. a UUID) and reuses when it retries. */
const EventId = z.object({ eventId: z.string().trim().min(8, "eventId must be 8–64 characters").max(64, "eventId must be 8–64 characters").optional() });

/** Repeated attempts to open the same blocked app raise one alert per this window. */
const BLOCKED_ALERT_WINDOW_MS = 60 * 60_000;
/** A child asking again for an app the parent blocked raises one alert per this window. */
const DECLINED_REQUEST_WINDOW_MS = 24 * 60 * 60_000;
/** A device repeating "limit reached" (e.g. after a restart) raises one alert per this window. */
const LIMIT_ALERT_WINDOW_MS = 12 * 60 * 60_000;
/** After a parent answers, asking for more time again raises a new request only once this has passed (as the device's own throttle). */
const TIME_REQUEST_WINDOW_MS = 10 * 60_000;

/** Notable things that happened on the device. Protection changes are detected from /report instead. */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  // A device token must not be able to fill the family's app list and alert feed without limit
  if ((await hit(`deviceevents:${device.id}`, LIMITS.deviceEvents)).limited) {
    return NextResponse.json({ error: "Too many events. eGuard will accept the next one shortly." }, { status: 429 });
  }
  const raw = await readJson(req);
  const legacy = raw && typeof raw === "object" && "type" in raw && typeof raw.type === "string" ? LEGACY_TYPES[raw.type] : undefined;
  const parsed = Body.safeParse(legacy ? { ...(raw as object), type: legacy } : raw);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const id = EventId.safeParse(raw);
  if (!id.success) return badRequest(id.error.issues[0].message);
  // A retry of an event already handled (the response was lost): same answer, nothing done twice
  const seenKey = id.data.eventId ? `deviceevent:${device.id}:${id.data.eventId}` : null;
  if ((await hit(seenKey, LIMITS.deviceEventId)).limited) return NextResponse.json({ ok: true, duplicate: true });
  try {
    return await handle(device, parsed.data, legacy === "APP_REQUESTED");
  } catch (err) {
    // Not handled after all: let the device's retry through
    if (seenKey) await clearLimit(seenKey).catch(() => {});
    throw err;
  }
}

type Device = NonNullable<Awaited<ReturnType<typeof authDevice>>>;

async function handle(device: Device, e: z.infer<typeof Body>, legacyRequest: boolean) {
  const who = `${device.child.name}'s ${device.name}`;
  const base = { familyId: device.familyId, childId: device.childId, deviceId: device.id };

  if (e.type === "APP_INSTALLED") {
    // Only a newly seen app is news; reinstalls and reports from a second device don't raise another alert.
    // Whoever creates the row raises it, so two devices reporting the same app at once raise one alert, not two.
    // With approval on, a new app waits for the parent: created PENDING with a request, never ALLOWED (Android
    // 1.0.9 and earlier send APP_INSTALLED before APP_REQUESTED, and an allowed app has nothing to ask for).
    const pending = await approvalRequired(device.childId);
    const created = await db.childApp.create({ data: { childId: device.childId, name: e.app, ...(pending ? { approval: "PENDING" as const } : {}) } })
      .then(() => true, (err) => {
        if (isUniqueViolation(err)) return false;
        throw err;
      });
    if (created && pending) {
      await raiseAppRequest(device, e.app, `${device.child.name} asked to install ${e.app}.`);
    } else if (created) {
      const rated = e.ageRating ? `. Rated ${e.ageRating}+` : "";
      await db.alert.create({ data: { ...base, severity: "INFO", category: "APPS", icon: "layout-grid", title: "New app installed",
        ...(await mayNameApp(device.familyId, device.childId, e.app)
          ? { body: `${e.app} was installed${rated}.`, subject: `${e.app} · ${who}` }
          : { body: `An app was installed${rated}. ${APPS_UPGRADE}`, subject: who }) } });
    }
  } else if (e.type === "APP_REQUESTED") {
    const app = await db.childApp.findUnique({ where: { childId_name: { childId: device.childId, name: e.app } } });
    // A request never overrides the parent's decision. An allowed app has nothing to ask for.
    if (app && ALLOWED.includes(app.approval)) {
      if (legacyRequest) await requestTime(device, { app: e.app });
      await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return NextResponse.json({ ok: true, approval: app.approval });
    }
    const resolveKey = `APPREQ:${device.childId}:${e.app}`;
    if (app?.approval === "BLOCKED" || app?.approval === "FILTERED") {
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
    await raiseAppRequest(device, e.app, `${device.child.name} asked to install ${e.app}.`);
  } else if (e.type === "APP_BLOCKED") {
    // An app the plan's Apps tab hides isn't named; those share one alert per window
    const named = await mayNameApp(device.familyId, device.childId, e.app);
    const subject = named ? `${e.app} · ${who}` : who;
    await createAlertUnless(`APPBLOCKED:${device.id}:${named ? e.app : "hidden"}`,
      { ...base, title: "App blocked", subject, createdAt: { gt: new Date(Date.now() - BLOCKED_ALERT_WINDOW_MS) } },
      { ...base, severity: "INFO", category: "APPS", icon: "ban", title: "App blocked",
        body: named ? `${device.child.name} tried to open ${e.app}, which is blocked.` : `${device.child.name} tried to open a blocked app. ${APPS_UPGRADE}`, subject });
  } else if (e.type === "TIME_REQUESTED") {
    await requestTime(device, e);
  } else if (e.type === "USER_LEFT") {
    // Open until the phone comes back to the child's profile
    const resolveKey = `USERSWITCH:${device.id}`;
    await createAlertUnless(resolveKey, { familyId: device.familyId, resolveKey, resolvedAt: null },
      { ...base, severity: "ATTENTION", category: "DEVICES", icon: "users", title: "Switched to another user",
        body: `${who} was switched to another user or a guest profile. eGuard doesn't run there, so limits, bedtime and app rules don't apply until it's switched back.`,
        subject: who, resolveKey });
  } else if (e.type === "USER_RETURNED") {
    await resolveAlerts(device.familyId, `USERSWITCH:${device.id}`);
    // Kept after the open alert resolves (and sent even if it was never seen): how long nothing was enforced
    if (e.awayMinutes >= 1) {
      await db.alert.create({ data: { ...base, severity: "ATTENTION", category: "DEVICES", icon: "users", title: "Used on another user",
        body: `${who} was on another user or a guest profile for ${fmtMinutes(e.awayMinutes)}. Nothing was limited or reported during that time.`, subject: who } });
    }
  } else if (e.category) {
    const name = CATEGORY_BY_KEY[e.category].limitLabel;
    await createAlertUnless(`LIMIT:${device.id}:${e.category}`,
      { ...base, title: `${name} used up`, createdAt: { gt: new Date(Date.now() - LIMIT_ALERT_WINDOW_MS) } },
      { ...base, severity: "INFO", category: "SCREEN_TIME", icon: "hourglass", title: `${name} used up`,
        body: `${device.child.name} reached the ${fmtMinutes(e.minutes)} daily limit for ${CATEGORY_BY_KEY[e.category].label.toLowerCase()}. Those apps were paused as scheduled.`, subject: who });
  } else {
    await createAlertUnless(`LIMIT:${device.id}`,
      { ...base, title: "Screen time limit reached", createdAt: { gt: new Date(Date.now() - LIMIT_ALERT_WINDOW_MS) } },
      { ...base, severity: "INFO", category: "SCREEN_TIME", icon: "hourglass", title: "Screen time limit reached",
        body: `${device.child.name} reached the ${fmtMinutes(e.minutes)} daily limit. Apps were paused as scheduled.`, subject: who });
  }
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}

/** App Approval on, or Downloads set to parent approval: new apps wait for a parent (what devices enforce). */
async function approvalRequired(childId: string) {
  const rows = await db.childPolicy.findMany({ where: { childId, key: { in: ["APP_APPROVAL", "DOWNLOADS"] } } });
  return rows.some((p) => {
    const c = (p.config ?? {}) as Record<string, unknown>;
    return p.key === "APP_APPROVAL" ? c.enabled === true : c.requireApproval === true;
  });
}

/** The parent's "App approval requested" alert. Asking several times in a row (or from two devices) raises one. */
async function raiseAppRequest(device: Device, app: string, body: string) {
  const resolveKey = `APPREQ:${device.childId}:${app}`;
  await createAlertUnless(resolveKey, { familyId: device.familyId, resolveKey, resolvedAt: null },
    { familyId: device.familyId, childId: device.childId, deviceId: device.id, severity: "ATTENTION", category: "APPS",
      icon: "app-window", title: "App approval requested", body, subject: `${app} · ${device.child.name}'s ${device.name}`, resolveKey });
}

const PAUSED_BY = { DAILY_LIMIT: "the daily limit", APP_LIMIT: "an app limit", CATEGORY_LIMIT: "a category limit", BEDTIME: "bedtime" } as const;

/**
 * The child asked for more time: one open request per child, however often or from however many devices. The parent
 * answers it by giving extra time or saying not now (family-service grantExtraTime / endExtraTime).
 */
async function requestTime(device: Device, e: { app?: string; reason?: keyof typeof PAUSED_BY }) {
  const who = `${device.child.name}'s ${device.name}`;
  const base = { familyId: device.familyId, childId: device.childId, deviceId: device.id };
  const resolveKey = timeRequestKey(device.childId);
  const named = e.app && await mayNameApp(device.familyId, device.childId, e.app) ? e.app : null;
  const paused = e.reason ? `, paused by ${PAUSED_BY[e.reason]}` : "";
  await createAlertUnless(resolveKey,
    { familyId: device.familyId, resolveKey, OR: [{ resolvedAt: null }, { createdAt: { gt: new Date(Date.now() - TIME_REQUEST_WINDOW_MS) } }] },
    { ...base, severity: "ATTENTION", category: "SCREEN_TIME", icon: "hourglass", title: "More time requested",
      body: `${device.child.name} asked for more time${named ? ` on ${named}` : ""}${paused}.`, subject: named ? `${named} · ${who}` : who, resolveKey });
}
