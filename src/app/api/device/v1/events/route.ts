import { NextResponse } from "next/server";
import type { AppApproval } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { fmtMinutes } from "@/lib/protections";
import { createAlertUnless, resolveAlerts } from "@/lib/engine";
import { authDevice, badRequest, readJson, TOO_LARGE, tooLarge, tooMany, unauthorized } from "@/lib/device-auth";
import { LIMITS, clearLimit, hit } from "@/lib/rate-limit";
import { ServiceError, isUniqueViolation } from "@/lib/errors";
import { CATEGORY_BY_KEY, CATEGORY_KEYS } from "@/lib/app-categories";
import { APPS_UPGRADE, mayNameApp } from "@/lib/plan-access";
import { deleteDevice, timeRequestKey } from "@/lib/family-service";
import { AppIds, canonicalNames, rememberIds } from "@/lib/app-identity";
import { removalCode, REMOVAL_CODE_WINDOW_MS } from "@/lib/device-removal";
import { forgetRemovedComputer, removedComputerFor } from "@/lib/removed-computers";

/** Trimmed, so " YouTube" and "YouTube" are one app, and a blank name is refused */
const appName = z.string().trim().min(1, "app is required").max(80);

/** Desktop agent: how it found the app (docs/desktop-agent-spec.md, "Scanning installed apps") */
const AppSourceSchema = z.enum(["CATALOG", "LAUNCHER", "UNKNOWN_PUBLISHER"]);
const FoundApp = z.object({ app: appName, ids: AppIds, source: AppSourceSchema.optional(), category: z.enum(CATEGORY_KEYS).optional() });

/** What the desktop agent saw someone try (docs/desktop-agent-spec.md, "Can't be uninstalled") */
const TAMPER_KINDS = {
  UNINSTALL_BLOCKED: "Someone tried to uninstall eGuard",
  SERVICE_STOP_DENIED: "Someone tried to stop eGuard",
  AGENT_RESTARTED: "eGuard was closed and started again",
  FILES_CHANGED: "eGuard's files were changed",
  ADMIN_ACCOUNT: "Your child's account is an administrator",
  CLOCK_CHANGED: "The computer's clock was changed",
  SAFE_MODE: "The computer was started in Safe Mode",
  REMOVAL_CODE_GUESSED: "Someone is guessing eGuard's removal code",
  NEW_ACCOUNT: "A new account was added to the computer",
  SERVICE_RESTARTED: "eGuard was stopped and started again",
  // Android (child-app-spec, "Tamper events")
  LAUNCHER_CHANGED: "The home screen app was changed",
  DIALER_CHANGED: "The phone's calling app was changed",
  PROFILE_ADDED: "A separate profile is on the phone",
} as const;
/** Kinds that need a look rather than action: the rest are someone working against eGuard. */
const TAMPER_ATTENTION = new Set<keyof typeof TAMPER_KINDS>(["AGENT_RESTARTED", "CLOCK_CHANGED", "NEW_ACCOUNT", "SERVICE_RESTARTED", "LAUNCHER_CHANGED", "DIALER_CHANGED"]);
const TAMPER_BODY: Record<keyof typeof TAMPER_KINDS, string> = {
  UNINSTALL_BLOCKED: "Someone tried to uninstall eGuard from {d}. eGuard refused and is still running. Only you can remove it, from the device page.",
  SERVICE_STOP_DENIED: "Someone tried to stop eGuard on {d}. eGuard refused and is still running.",
  AGENT_RESTARTED: "eGuard's window on {d} was closed, and eGuard started it again. Limits and app rules kept applying.",
  FILES_CHANGED: "eGuard's files on {d} were changed or deleted. eGuard put them back. If it happens again, check who has an administrator account on the computer.",
  ADMIN_ACCOUNT: "Your child signs in to {d} with an administrator account, so they could switch eGuard off. Change it to a standard account (see Uninstall Protection).",
  CLOCK_CHANGED: "The clock on {d} was changed. eGuard keeps counting time by its own clock, so no time was gained.",
  SAFE_MODE: "{d} was started in Safe Mode. eGuard runs there too and kept applying your settings.",
  REMOVAL_CODE_GUESSED: "Wrong removal codes were typed on {d} several times. eGuard stopped taking codes for a while and is still running. Only you can remove it, from the device page.",
  NEW_ACCOUNT: "A new Windows account was added on {d}. eGuard applies your rules only in the accounts you chose when pairing, so this one isn't limited. If it's your child's, choose it in eGuard on the computer.",
  SERVICE_RESTARTED: "eGuard on {d} was stopped without being asked to, and started again within seconds. Limits and app rules kept applying. Stopping it takes an administrator account: if it happens again, check who has one on the computer.",
  LAUNCHER_CHANGED: "A different home screen app was made the default on {d}. eGuard applies your app rules and limits to it like any other app. If you didn't expect this, check which apps are installed.",
  DIALER_CHANGED: "A different phone app was made the default for calls on {d}. eGuard applies your app rules and limits to it like any other app. If you didn't expect this, check which apps are installed.",
  PROFILE_ADDED: "{d} has a work profile, Private Space or cloned apps. Apps there run apart from your child's own apps: eGuard counts their time on screen and holds them for your approval when App approval is on, but can't list them. If you didn't set it up, remove it in the phone's Settings.",
};

const Body = z.discriminatedUnion("type", [
  // Same bounds as a reported age rating (ReportedConfigSchema). `ids` and `source`: the desktop agent
  z.object({ type: z.literal("APP_INSTALLED"), app: appName, ageRating: z.number().int().min(0).max(21).optional(), ids: AppIds, source: AppSourceSchema.optional(), category: z.enum(CATEGORY_KEYS).optional() }),
  // Desktop agent: what its first scan (and later full scans) found that was installed before it was there
  z.object({ type: z.literal("APPS_FOUND"), apps: z.array(FoundApp).min(1).max(200) }),
  z.object({ type: z.literal("TAMPER"), kind: z.enum(Object.keys(TAMPER_KINDS) as [keyof typeof TAMPER_KINDS, ...(keyof typeof TAMPER_KINDS)[]]) }),
  // Desktop agent: it uninstalled itself, after the signed uninstall command (sync) or an offline removal code
  z.object({ type: z.literal("UNINSTALL_ACK"), code: z.string().trim().toUpperCase().length(8).optional() }),
  // `ids`, `source`, `category`: the desktop agent, for an app its scan hadn't reported (a browser, a game in a folder it
  // doesn't walk), so the parent sees what it is
  z.object({ type: z.literal("APP_REQUESTED"), app: appName, ids: AppIds, source: AppSourceSchema.optional(), category: z.enum(CATEGORY_KEYS).optional() }),
  // `category`: a category limit (sync's categoryLimits) was used up, rather than the whole day's screen time;
  // `app`: one app's own daily limit (an app rule's `dailyLimitMinutes`). Neither: the whole day's screen time
  z.object({ type: z.literal("LIMIT_REACHED"), minutes: z.number().int().min(0).max(1440), category: z.enum(CATEGORY_KEYS).optional(), app: appName.optional() }),
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

/** The same kind of tampering on one computer raises one alert per this window. */
const TAMPER_ALERT_WINDOW_MS = 60 * 60_000;
/** Repeated attempts to open the same blocked app raise one alert per this window. */
const BLOCKED_ALERT_WINDOW_MS = 60 * 60_000;
/** A child asking again for an app the parent blocked raises one alert per this window. */
const DECLINED_REQUEST_WINDOW_MS = 24 * 60 * 60_000;
/** A device repeating "limit reached" (e.g. after a restart) raises one alert per this window. */
const LIMIT_ALERT_WINDOW_MS = 12 * 60 * 60_000;
/** After a parent answers, asking for more time again raises a new request only once this has passed (as the device's own throttle). */
const TIME_REQUEST_WINDOW_MS = 10 * 60_000;

/** Apps on one child's list (as /usage): past it, found apps aren't added. */
const MAX_CHILD_APPS = 1000;

/** Notable things that happened on the device. Protection changes are detected from /report instead. */
export async function POST(req: Request) {
  const device = await authDevice(req);
  if (!device) return removedComputerAck(req);
  const raw = await readJson(req);
  // Before the allowance below: a body too large was never handled, and its smaller halves are what counts
  if (raw === TOO_LARGE) return tooLarge();
  // A retry of an event already handled (the response was lost): same answer, nothing done twice, and it doesn't use
  // up the allowance either. An id that isn't valid is refused below, with the rest of the body
  const eventId = EventId.safeParse(raw);
  const seenKey = eventId.success && eventId.data.eventId ? `deviceevent:${device.id}:${eventId.data.eventId}` : null;
  if ((await hit(seenKey, LIMITS.deviceEventId)).limited) return NextResponse.json({ ok: true, duplicate: true });
  // A device token must not be able to fill the family's app list and alert feed without limit
  const rate = await hit(`deviceevents:${device.id}`, LIMITS.deviceEvents);
  if (rate.limited) {
    // Not handled: its retry must be, not answered `duplicate`
    if (seenKey) await clearLimit(seenKey).catch(() => {});
    return tooMany("Too many events. eGuard will accept the next one shortly.", rate.retryAfter);
  }
  const legacy = raw && typeof raw === "object" && "type" in raw && typeof raw.type === "string" ? LEGACY_TYPES[raw.type] : undefined;
  const parsed = Body.safeParse(legacy ? { ...(raw as object), type: legacy } : raw);
  if (!parsed.success || !eventId.success) {
    if (seenKey) await clearLimit(seenKey).catch(() => {});
    return badRequest(!parsed.success ? parsed.error.issues[0].message : eventId.error!.issues[0].message);
  }
  try {
    const res = await handle(device, parsed.data, legacy === "APP_REQUESTED");
    // Refused (e.g. 409 from an UNINSTALL_ACK the server can't accept yet): a retry with the same id must be judged
    // again, not answered `duplicate`
    if (seenKey && res.status >= 400) await clearLimit(seenKey).catch(() => {});
    return res;
  } catch (err) {
    // Not handled after all: let the device's retry through
    if (seenKey) await clearLimit(seenKey).catch(() => {});
    throw err;
  }
}

/**
 * A token with no device: a computer removed without confirming it (lib/removed-computers) may be confirming now that
 * it uninstalled eGuard, after the signed command it got with /sync's 401. Its UNINSTALL_ACK is taken (once), and
 * nothing more is kept for it. Anything else from it, or from any other token, is a 401.
 */
async function removedComputerAck(req: Request) {
  const removed = await removedComputerFor(req);
  if (!removed) return unauthorized();
  const raw = await readJson(req);
  const ack = raw && typeof raw === "object" && "type" in raw && raw.type === "UNINSTALL_ACK";
  if (!ack) return unauthorized();
  await forgetRemovedComputer(removed.id);
  console.info(`[device] removed computer ${removed.deviceId} confirmed it uninstalled eGuard`);
  return NextResponse.json({ ok: true });
}

type Device = NonNullable<Awaited<ReturnType<typeof authDevice>>>;

async function handle(device: Device, e: z.infer<typeof Body>, legacyRequest: boolean) {
  const who = `${device.child.name}'s ${device.name}`;
  const base = { familyId: device.familyId, childId: device.childId, deviceId: device.id };

  if (e.type === "APP_INSTALLED") {
    // Known by one of its ids under another name: not a new app (a computer reporting a game it already listed)
    if ((await canonicalNames(device.childId, device.platform, [{ name: e.app, ids: e.ids }])).has(e.app)) {
      await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    // Only a newly seen app is news; reinstalls and reports from a second device don't raise another alert.
    // Whoever creates the row raises it, so two devices reporting the same app at once raise one alert, not two.
    // With approval on, a new app waits for the parent: created PENDING with a request, never ALLOWED (Android
    // 1.0.9 and earlier send APP_INSTALLED before APP_REQUESTED, and an allowed app has nothing to ask for).
    const pending = await approvalRequired(device.childId) || (e.category === "BROWSERS" && await webFilterOn(device.childId));
    // A full list takes no new names, as APPS_FOUND and /usage: a tampered device can't grow it (and the alerts) without end
    const full = await db.childApp.count({ where: { childId: device.childId } }) >= MAX_CHILD_APPS;
    const created = !full && await db.childApp.create({ data: { childId: device.childId, name: e.app, source: e.source, category: e.category, ...(pending ? { approval: "PENDING" as const } : {}) } })
      .then(() => true, (err) => {
        if (isUniqueViolation(err)) return false;
        throw err;
      });
    await rememberIds(device.childId, device.platform, [{ name: e.app, ids: e.ids }]);
    const unverified = e.source === "UNKNOWN_PUBLISHER" ? " Its publisher isn't verified." : "";
    if (created && pending) {
      // A computer's scan found it; the child didn't ask (a phone asks when the child installs something)
      const found = device.kind === "COMPUTER"
        ? `${e.app} was found on ${who} and waits for you.`
        : `${device.child.name} asked to install ${e.app}.`;
      await raiseAppRequest(device, e.app, `${found}${unverified}`);
    } else if (created) {
      const rated = e.ageRating ? `. Rated ${e.ageRating}+` : "";
      await db.alert.create({ data: { ...base, severity: "INFO", category: "APPS", icon: "layout-grid", title: "New app installed",
        ...(await mayNameApp(device.familyId, device.childId, e.app)
          ? { body: `${e.app} was installed${rated}.${unverified}`, subject: `${e.app} · ${who}` }
          : { body: `An app was installed${rated}. ${APPS_UPGRADE}`, subject: who }) } });
    }
  } else if (e.type === "APPS_FOUND") {
    await appsFound(device, e.apps);
  } else if (e.type === "TAMPER") {
    const title = TAMPER_KINDS[e.kind];
    await createAlertUnless(`TAMPER:${device.id}:${e.kind}`,
      { ...base, title, createdAt: { gt: new Date(Date.now() - TAMPER_ALERT_WINDOW_MS) } },
      { ...base, severity: TAMPER_ATTENTION.has(e.kind) ? "ATTENTION" : "ACTION_REQUIRED", category: "DEVICES",
        icon: "shield-alert", title, body: TAMPER_BODY[e.kind].replace("{d}", who), subject: who });
  } else if (e.type === "UNINSTALL_ACK") {
    return uninstalled(device, e.code);
  } else if (e.type === "APP_REQUESTED") {
    // Known by one of its ids under another name: the request is for that app (a computer's "Ask a parent" names the
    // process; the parent's rule is on the game). Otherwise a blocked app came back as a new request to approve.
    const name = (await canonicalNames(device.childId, device.platform, [{ name: e.app, ids: e.ids }])).get(e.app) ?? e.app;
    const app = await db.childApp.findUnique({ where: { childId_name: { childId: device.childId, name } } });
    // A request never overrides the parent's decision. An allowed app has nothing to ask for.
    if (app && ALLOWED.includes(app.approval)) {
      if (legacyRequest) await requestTime(device, { app: name });
      await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return NextResponse.json({ ok: true, approval: app.approval });
    }
    const resolveKey = `APPREQ:${device.childId}:${name}`;
    if (app?.approval === "BLOCKED" || app?.approval === "FILTERED") {
      // A blocked app stays blocked. Asking again is passed on, but at most once per window, so a
      // declined request can't be turned into a stream of alerts.
      await createAlertUnless(resolveKey,
        { familyId: device.familyId, resolveKey, OR: [{ resolvedAt: null }, { createdAt: { gt: new Date(Date.now() - DECLINED_REQUEST_WINDOW_MS) } }] },
        { ...base, severity: "ATTENTION", category: "APPS", icon: "app-window", title: "App approval requested",
          body: `${device.child.name} asked again for ${name}, which you blocked.`, subject: `${name} · ${who}`, resolveKey });
      await closeIfAnswered(device, name, (a) => a === "BLOCKED" || a === "FILTERED");
      await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return NextResponse.json({ ok: true, approval: app.approval });
    }
    if (!app && await db.childApp.count({ where: { childId: device.childId } }) >= MAX_CHILD_APPS) {
      await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return NextResponse.json({ ok: true, approval: "PENDING" });
    }
    // Created PENDING, or left as it is: a parent's answer landing since the read above must not be turned back into
    // a request (the update branch only ever meets a PENDING row, or one the parent just decided)
    const row = await db.childApp.upsert({
      where: { childId_name: { childId: device.childId, name } },
      create: { childId: device.childId, name, approval: "PENDING", source: e.source, category: e.category },
      update: {},
    });
    if (e.ids) await rememberIds(device.childId, device.platform, [{ name, ids: e.ids }]);
    if (row.approval !== "PENDING") {
      await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      return NextResponse.json({ ok: true, approval: row.approval });
    }
    await raiseAppRequest(device, name, `${device.child.name} asked to install ${name}.`);
    await closeIfAnswered(device, name, (a) => a === "PENDING");
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
  } else if (e.app) {
    // One app's own limit: its own alert, so it never reads as (nor dedupes away) the whole day's limit
    await createAlertUnless(`LIMIT:${device.id}:APP:${e.app}`,
      { ...base, title: `${e.app} time used up`, createdAt: { gt: new Date(Date.now() - LIMIT_ALERT_WINDOW_MS) } },
      { ...base, severity: "INFO", category: "SCREEN_TIME", icon: "hourglass", title: `${e.app} time used up`,
        body: `${device.child.name} reached the ${fmtMinutes(e.minutes)} daily limit for ${e.app}. It was paused as scheduled.`, subject: who });
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

/**
 * Apps the desktop agent found installed before it was there. They go on the child's list (with their ids) and the
 * parent hears once, not once per app. With App Approval on they wait for the parent like a new app, since the parent
 * hasn't seen any of them yet; otherwise they stay allowed until the parent blocks or limits them.
 */
async function appsFound(device: Device, found: z.infer<typeof FoundApp>[]) {
  const renamed = await canonicalNames(device.childId, device.platform, found.map((a) => ({ name: a.app, ids: a.ids })));
  const apps = found.filter((a) => !renamed.has(a.app));
  const listed = new Set((await db.childApp.findMany({ where: { childId: device.childId, name: { in: apps.map((a) => a.app) } }, select: { name: true } })).map((l) => l.name));
  const room = Math.max(0, MAX_CHILD_APPS - await db.childApp.count({ where: { childId: device.childId } }));
  const fresh = [...new Map(apps.filter((a) => !listed.has(a.app)).map((a) => [a.app, a])).values()].slice(0, room);
  const pending = fresh.length > 0 && await approvalRequired(device.childId);
  // A browser eGuard can't filter waits for the parent while web filtering is on, whatever App Approval says
  const browsersWait = !pending && fresh.some((a) => a.category === "BROWSERS") && await webFilterOn(device.childId);
  const waits = (a: z.infer<typeof FoundApp>) => pending || (browsersWait && a.category === "BROWSERS");
  if (fresh.length) {
    await db.childApp.createMany({ skipDuplicates: true, data: fresh.map((a) => ({
      childId: device.childId, name: a.app, source: a.source, category: a.category, ...(waits(a) ? { approval: "PENDING" as const } : {}),
    })) });
  }
  await rememberIds(device.childId, device.platform, apps.map((a) => ({ name: a.app, ids: a.ids })));
  if (!fresh.length) return;
  const games = fresh.filter((a) => a.category === "GAMES").length;
  const waitingBrowsers = browsersWait ? fresh.filter((a) => a.category === "BROWSERS").length : 0;
  const unverified = fresh.filter((a) => a.source === "UNKNOWN_PUBLISHER").length;
  const what = games ? `${games} game${games === 1 ? "" : "s"}${fresh.length > games ? ` and ${fresh.length - games} other app${fresh.length - games === 1 ? "" : "s"}` : ""}` : `${fresh.length} app${fresh.length === 1 ? "" : "s"}`;
  const who = `${device.child.name}'s ${device.name}`;
  await db.alert.create({ data: {
    familyId: device.familyId, childId: device.childId, deviceId: device.id, severity: pending || unverified || waitingBrowsers ? "ATTENTION" : "INFO", category: "APPS",
    icon: "gamepad", title: "Apps found on a computer", subject: who,
    body: `eGuard found ${what} on ${who}${unverified ? `, ${unverified} from a publisher eGuard can't verify` : ""}. ${pending
      ? "They're blocked until you allow them in the Apps tab."
      : waitingBrowsers
        ? `They're allowed for now, except ${waitingBrowsers === 1 ? "a web browser, which waits" : `${waitingBrowsers} web browsers, which wait`} for you: eGuard can't filter websites in ${waitingBrowsers === 1 ? "it" : "them"}. Allow, block or limit them in the Apps tab.`
        : "They're allowed for now. Block or limit them in the Apps tab."}`,
  } });
}

/**
 * The computer uninstalled eGuard. Only as a parent asked: the signed command (a removal waiting), or an offline removal
 * code the parent typed into it, which eGuard checks here too. Anything else is refused and the device stays.
 */
async function uninstalled(device: Device, code?: string) {
  if (!device.removalRequestedAt) {
    // A real code with no removal waiting: the parent kept the computer after asking for one, and someone typed
    // the code they'd seen anyway. The computer checks codes offline, so it may have removed eGuard already: the
    // parent hears about it rather than the device quietly disappearing
    const valid = !!code && !!device.removalSecret && [0, 1].some((back) => removalCode(device.removalSecret!, device.id, Date.now() - back * REMOVAL_CODE_WINDOW_MS).code === code);
    if (valid) {
      const who = `${device.child.name}'s ${device.name}`;
      const base = { familyId: device.familyId, childId: device.childId, deviceId: device.id };
      const title = "A removal code was used after you kept the computer";
      await createAlertUnless(`REMOVALCODE:${device.id}`, { ...base, title, createdAt: { gt: new Date(Date.now() - TAMPER_ALERT_WINDOW_MS) } },
        { ...base, severity: "ACTION_REQUIRED", category: "DEVICES", icon: "shield-alert", title, subject: who,
          body: `Someone typed a removal code on ${who} after you chose to keep it. If eGuard stops checking in from it, pair it again.` });
    }
    return NextResponse.json({ error: "No removal was asked for this computer" }, { status: 409 });
  }
  const by = device.removalRequestedBy ?? "A parent";
  await deleteDevice(device, by, device.removalDeletesHistory, "uninstalled").catch((err) => {
    // Already removed (a parent finished it a moment ago): the same answer
    if (!(err instanceof ServiceError && err.status === 404)) throw err;
  });
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

/**
 * Web filtering on (any mode but off). A browser eGuard can't filter (any but Chrome, Edge and Firefox, which the
 * computer agent sets up) then waits for the parent like an app under App Approval (docs/desktop-agent-spec.md, section 9).
 */
async function webFilterOn(childId: string) {
  const row = await db.childPolicy.findFirst({ where: { childId, key: "WEB" } });
  const mode = ((row?.config ?? {}) as Record<string, unknown>).mode;
  return typeof mode === "string" && mode !== "OFF";
}

/**
 * The parent answered while a request alert was being raised (it resolves the alert, then ours lands): close ours too,
 * or it asks about an app that's already decided. `stillOpen`: the approvals the alert is still right for.
 */
async function closeIfAnswered(device: Device, app: string, stillOpen: (a: AppApproval) => boolean) {
  const now = await db.childApp.findUnique({ where: { childId_name: { childId: device.childId, name: app } }, select: { approval: true } });
  if (now && !stillOpen(now.approval)) await resolveAlerts(device.familyId, `APPREQ:${device.childId}:${app}`);
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
