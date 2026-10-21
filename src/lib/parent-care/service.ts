import "server-only";
import { z } from "zod";
import { db } from "../db";
import { canonicalTimeZone } from "../format";
import { ServiceError, notFound } from "../errors";
import { ACTIVITIES, activityByKey, fitsAges, pickPlan, suggestible, type Activity } from "./content";
import { AUTOMATIONS, type AutomationKey, type Channel, type PreferenceToggle } from "./definitions";
import { recordEvent, recordEvents, noteActivity, type EventType } from "./events";
import { cancelJobs } from "./queue";
import { cancelPendingFor, ensurePlan, loadContext, monthlyNumbers, scheduleFollowUp, type CareContext } from "./runner";
import { addDays, clock, parseClock, previousMonth, slot, weekOf, localDay } from "./schedule";
import { SUPPORTED_LANGUAGES, render, safeLink } from "./templates";

/**
 * What a parent does with parent care, for the web app's server actions and the mobile API alike. Every function
 * takes the signed-in parent (`Actor`) and only ever reads or changes their own rows.
 */

export type Actor = { id: string; familyId: string };

async function context(actor: Actor) {
  const ctx = await loadContext(actor.id);
  if (!ctx) throw notFound("Account");
  return ctx;
}

/* ---------- Preferences ---------- */

const Clock = z.string().trim().refine((s) => parseClock(s) !== null, "Use a 24-hour time like 19:30.").transform((s) => parseClock(s)!);

export const CarePrefsSchema = z.object({
  enabled: z.boolean(),
  inApp: z.boolean(), push: z.boolean(), email: z.boolean(),
  briefings: z.boolean(), followUps: z.boolean(), weeklyPlan: z.boolean(), checkIns: z.boolean(), monthlyReport: z.boolean(),
  briefingDays: z.array(z.number().int().min(0).max(6)).max(7).transform((d) => [...new Set(d)].sort()),
  deliveryTime: Clock,
  quietStart: Clock, quietEnd: Clock,
  language: z.enum(Object.keys(SUPPORTED_LANGUAGES) as [keyof typeof SUPPORTED_LANGUAGES]),
  /** Null: the family's time zone */
  timezone: z.string().max(64).nullable().transform((tz, c) => (tz === null ? null : canonicalTimeZone(tz) ?? (c.addIssue({ code: "custom", message: "Choose a valid time zone." }), z.NEVER))),
}).partial().strict();
export type CarePrefsInput = z.input<typeof CarePrefsSchema>;

const TOGGLE_AUTOMATION: Record<PreferenceToggle, AutomationKey> = Object.fromEntries(AUTOMATIONS.map((a) => [a.toggle, a.key])) as Record<PreferenceToggle, AutomationKey>;
const TIME_BASED: AutomationKey[] = ["briefing", "weekly_plan", "monthly_report", "check_in"];

/** The preferences as the app and the settings page show them, with what each channel can actually do. */
export async function carePreferences(actor: Actor) {
  const ctx = await context(actor);
  return prefsJson(ctx);
}

function prefsJson(ctx: CareContext) {
  const p = ctx.prefs;
  return {
    enabled: p.enabled, inApp: p.inApp, push: p.push, email: p.email,
    briefings: p.briefings, followUps: p.followUps, weeklyPlan: p.weeklyPlan, checkIns: p.checkIns, monthlyReport: p.monthlyReport,
    briefingDays: p.briefingDays, deliveryTime: clock(p.deliveryMinute), quietStart: clock(p.quietStart), quietEnd: clock(p.quietEnd),
    language: p.language, timezone: p.timezone, effectiveTimezone: ctx.tz,
    consent: { push: p.pushConsentAt?.toISOString() ?? null, email: p.emailConsentAt?.toISOString() ?? null },
    /** Whether each channel can reach this parent at all, whatever they chose */
    channels: {
      push: ctx.available.PUSH,
      email: ctx.emailVerified,
      inApp: true,
    },
    languages: Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({ code, name })),
  };
}

/**
 * Saves the parent's choices. Turning push or email on records consent (when, and for this purpose); turning one
 * off withdraws it at once: pending messages are re-checked before sending anyway, and those for something turned
 * off are cancelled now. A schedule change replans the parent's upcoming messages.
 */
export async function updateCarePreferences(actor: Actor, input: unknown) {
  const b = CarePrefsSchema.parse(input);
  const ctx = await context(actor);
  const p = ctx.prefs;
  const now = new Date();
  const data: Record<string, unknown> = {};
  const events: { type: EventType; meta: Record<string, string> }[] = [];

  for (const k of ["enabled", "inApp", "push", "email", "briefings", "followUps", "weeklyPlan", "checkIns", "monthlyReport"] as const) {
    if (b[k] === undefined || b[k] === p[k]) continue;
    data[k] = b[k];
    if (!b[k]) events.push({ type: "NOTIFICATION_OPTED_OUT", meta: k === "enabled" ? { scope: "ALL" } : k === "inApp" || k === "push" || k === "email" ? { channel: k === "inApp" ? "IN_APP" : k.toUpperCase() } : { automation: TOGGLE_AUTOMATION[k as PreferenceToggle] } });
  }
  // Consent follows the switch: given now, or withdrawn now
  if (b.push !== undefined && b.push !== p.push) data.pushConsentAt = b.push ? now : null;
  if (b.email !== undefined && b.email !== p.email) data.emailConsentAt = b.email ? now : null;
  if (b.briefingDays) data.briefingDays = b.briefingDays;
  if (b.deliveryTime !== undefined) data.deliveryMinute = b.deliveryTime;
  if (b.quietStart !== undefined) data.quietStart = b.quietStart;
  if (b.quietEnd !== undefined) data.quietEnd = b.quietEnd;
  if (b.language) data.language = b.language;
  if (b.timezone !== undefined) data.timezone = b.timezone;
  if (!Object.keys(data).length) return prefsJson(ctx);

  const scheduleChanged = ["briefingDays", "deliveryMinute", "quietStart", "quietEnd", "timezone"].some((k) => k in data && JSON.stringify(data[k]) !== JSON.stringify((p as Record<string, unknown>)[k]));
  await db.parentCarePreference.update({ where: { userId: actor.id }, data: { ...data, ...(scheduleChanged ? { plannedAt: null } : {}) } });

  // Choosing a channel again lifts an opt-out made from an email's link
  const relifted = (["push", "email", "inApp"] as const).filter((k) => b[k] === true && !p[k]).map((k) => `CHANNEL:${k === "inApp" ? "IN_APP" : k.toUpperCase()}`);
  if (relifted.length) await db.parentCareSuppression.deleteMany({ where: { userId: actor.id, scope: { in: relifted }, reason: "OPT_OUT" } });

  if (data.enabled === false) {
    await cancelPendingFor(actor.id, actor.familyId, "ALL", "care_off");
    await db.parentCareEnrollment.updateMany({ where: { userId: actor.id, status: "ACTIVE" }, data: { status: "EXITED", exitReason: "care_off", completedAt: now } });
  } else {
    const off = (Object.keys(TOGGLE_AUTOMATION) as PreferenceToggle[]).filter((k) => data[k] === false).map((k) => TOGGLE_AUTOMATION[k]);
    if (off.length) await cancelPendingFor(actor.id, actor.familyId, off, "automation_off");
    if (off.includes("check_in")) await db.parentCareEnrollment.updateMany({ where: { userId: actor.id, automationKey: "check_in", status: "ACTIVE" }, data: { status: "EXITED", exitReason: "automation_off", completedAt: now } });
  }
  // Rescheduled: pending time-based jobs (never run) are removed so planning makes them again at the new times
  if (scheduleChanged) await db.parentCareJob.deleteMany({ where: { userId: actor.id, status: "PENDING", automationKey: { in: TIME_BASED } } });

  await recordEvents(events.map((e) => ({ userId: actor.id, familyId: actor.familyId, type: e.type, at: now, meta: { ...e.meta, via: "settings" } })));
  return prefsJson((await loadContext(actor.id))!);
}

/* ---------- Activities ---------- */

export type ActivityView = Activity & { status: "NEW" | "STARTED" | "COMPLETED" | "DISMISSED"; startedAt: string | null; completedAt: string | null; due: boolean };

function view(a: Activity, s: { status: string; startedAt: Date; completedAt: Date | null } | undefined, now: Date): ActivityView {
  return {
    ...a, status: (s?.status ?? "NEW") as ActivityView["status"], startedAt: s?.startedAt.toISOString() ?? null, completedAt: s?.completedAt?.toISOString() ?? null,
    due: suggestible(a, s ? { activityKey: a.key, status: s.status, completedAt: s.completedAt } : undefined, now),
  };
}

/** The Safety plan: this week's plan, what's in progress, more suggestions, and what's done. */
export async function careActivities(actor: Actor, now = new Date()) {
  const ctx = await context(actor);
  const [plan, rows, completedTotal] = await Promise.all([
    ensurePlan(ctx, now),
    db.parentCareActivity.findMany({ where: { userId: actor.id } }),
    db.parentCareEvent.count({ where: { userId: actor.id, type: "ACTIVITY_COMPLETED" } }),
  ]);
  const state = new Map(rows.map((r) => [r.activityKey, r]));
  const all = ACTIVITIES.map((a) => view(a, state.get(a.key), now));
  const fits = (a: Activity) => !a.ages || fitsAges(a.ages, ctx.ages);
  return {
    week: plan.week,
    plan: plan.activityKeys.map((k) => all.find((a) => a.key === k)).filter((a) => !!a),
    inProgress: all.filter((a) => a.status === "STARTED"),
    suggested: all.filter((a) => a.due && a.status !== "STARTED" && !plan.activityKeys.includes(a.key) && fits(a)).sort((x, y) => x.priority - y.priority).slice(0, 6),
    completed: all.filter((a) => a.status === "COMPLETED").sort((x, y) => (y.completedAt ?? "").localeCompare(x.completedAt ?? "")),
    dismissed: all.filter((a) => a.status === "DISMISSED"),
    completedTotal,
  };
}

export async function careActivity(actor: Actor, key: string, now = new Date()) {
  const a = activityByKey(key);
  if (!a) throw notFound("Activity");
  const row = await db.parentCareActivity.findUnique({ where: { userId_activityKey: { userId: actor.id, activityKey: key } } });
  return view(a, row ?? undefined, now);
}

const automationEnabled = async (key: AutomationKey) => (await db.parentCareAutomation.findUnique({ where: { key }, select: { enabled: true } }))?.enabled ?? false;

/** Starts (or restarts, if it's repeatable and was done long enough ago) an activity, and schedules its one follow-up. */
export async function startActivity(actor: Actor, key: string, now = new Date()) {
  const a = activityByKey(key);
  if (!a) throw notFound("Activity");
  const row = await db.parentCareActivity.findUnique({ where: { userId_activityKey: { userId: actor.id, activityKey: key } } });
  if (row?.status === "STARTED") return careActivity(actor, key, now);
  if (row?.status === "COMPLETED" && !suggestible(a, row, now)) throw new ServiceError(409, "You've already done this one.", "already_completed");
  await db.parentCareActivity.upsert({
    where: { userId_activityKey: { userId: actor.id, activityKey: key } },
    create: { userId: actor.id, activityKey: key, status: "STARTED", startedAt: now },
    update: { status: "STARTED", startedAt: now, completedAt: null },
  });
  const ctx = await context(actor);
  const week = weekOf(now, ctx.tz);
  const plan = await db.parentCarePlan.findUnique({ where: { userId_week: { userId: actor.id, week } } });
  await recordEvents([
    { userId: actor.id, familyId: actor.familyId, type: "ACTIVITY_STARTED", eventId: `start:${actor.id}:${key}:${now.getTime()}`, at: now, meta: { activity: key, inPlan: !!plan?.activityKeys.includes(key) } },
    // The first activity started from a week's plan starts that plan
    ...(plan?.activityKeys.includes(key) ? [{ userId: actor.id, familyId: actor.familyId, type: "WEEKLY_PLAN_STARTED" as const, eventId: `planstart:${plan.id}`, at: now, meta: { week } }] : []),
  ]);
  await noteActivity(actor, "activity_started", now);
  await scheduleFollowUp(ctx, { activityKey: key, startedAt: now }, await automationEnabled("follow_up"));
  return careActivity(actor, key, now);
}

/** Marks an activity done (started or not), and cancels its follow-up. */
export async function completeActivity(actor: Actor, key: string, now = new Date()) {
  const a = activityByKey(key);
  if (!a) throw notFound("Activity");
  const row = await db.parentCareActivity.findUnique({ where: { userId_activityKey: { userId: actor.id, activityKey: key } } });
  if (row?.status === "COMPLETED") return careActivity(actor, key, now);
  await db.parentCareActivity.upsert({
    where: { userId_activityKey: { userId: actor.id, activityKey: key } },
    create: { userId: actor.id, activityKey: key, status: "COMPLETED", startedAt: now, completedAt: now },
    update: { status: "COMPLETED", completedAt: now },
  });
  await cancelJobs({ userId: actor.id, automationKey: "follow_up", payload: { path: ["activityKey"], equals: key } }, "activity_completed", actor.familyId);
  await recordEvent({ userId: actor.id, familyId: actor.familyId, type: "ACTIVITY_COMPLETED", eventId: `done:${actor.id}:${key}:${localDay(now, "UTC")}`, at: now, meta: { activity: key } });
  await noteActivity(actor, "activity_completed", now);
  return careActivity(actor, key, now);
}

/** "Not for us": hidden from suggestions and plans, follow-up cancelled. Starting it again brings it back. */
export async function dismissActivity(actor: Actor, key: string, now = new Date()) {
  if (!activityByKey(key)) throw notFound("Activity");
  await db.parentCareActivity.upsert({
    where: { userId_activityKey: { userId: actor.id, activityKey: key } },
    create: { userId: actor.id, activityKey: key, status: "DISMISSED", startedAt: now },
    update: { status: "DISMISSED", completedAt: null },
  });
  await cancelJobs({ userId: actor.id, automationKey: "follow_up", payload: { path: ["activityKey"], equals: key } }, "activity_dismissed", actor.familyId);
  await recordEvent({ userId: actor.id, familyId: actor.familyId, type: "ACTIVITY_DISMISSED", at: now, meta: { activity: key } });
  return careActivity(actor, key, now);
}

/** Back from "not for us" to a fresh suggestion */
export async function restoreActivity(actor: Actor, key: string, now = new Date()) {
  if (!activityByKey(key)) throw notFound("Activity");
  await db.parentCareActivity.deleteMany({ where: { userId: actor.id, activityKey: key, status: "DISMISSED" } });
  return careActivity(actor, key, now);
}

/* ---------- Messages ---------- */

/** The parent's messages from eGuard, newest first, rendered now from their template and ids. */
export async function careMessages(actor: Actor, o: { limit?: number; before?: Date; channel?: Channel } = {}) {
  const limit = Math.min(Math.max(o.limit ?? 20, 1), 50);
  const rows = await db.parentCareMessage.findMany({
    where: { userId: actor.id, status: { in: ["ACCEPTED", "DELIVERED", "UNCERTAIN"] }, dismissedAt: null, ...(o.channel ? { channel: o.channel } : {}), ...(o.before ? { createdAt: { lt: o.before } } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const lang = (await db.parentCarePreference.findUnique({ where: { userId: actor.id }, select: { language: true } }))?.language ?? "en";
  return {
    messages: page.map((m) => {
      const r = render(m.templateKey, lang, { params: (m.params ?? {}) as Record<string, unknown> });
      return r ? {
        id: m.id, automation: m.automationKey, channel: m.channel, title: r.title, body: r.body, cta: r.cta, link: safeLink(m.link),
        sentAt: (m.sentAt ?? m.createdAt).toISOString(), openedAt: m.openedAt?.toISOString() ?? null, clickedAt: m.clickedAt?.toISOString() ?? null,
      } : null;
    }).filter((m) => !!m),
    unread: await db.parentCareMessage.count({ where: { userId: actor.id, channel: "IN_APP", status: "DELIVERED", openedAt: null, dismissedAt: null } }),
    nextBefore: rows.length > limit ? page.at(-1)!.createdAt.toISOString() : null,
  };
}

export const MESSAGE_ACTIONS = ["open", "click", "dismiss"] as const;
export type MessageAction = (typeof MESSAGE_ACTIONS)[number];

/** Records an open, click or dismissal, once each. Only on the parent's own message. */
export async function markMessage(actor: Actor, id: string, action: MessageAction, now = new Date()) {
  const m = await db.parentCareMessage.findFirst({ where: { id, userId: actor.id } });
  if (!m) throw notFound("Message");
  const field = action === "open" ? "openedAt" : action === "click" ? "clickedAt" : "dismissedAt";
  const { count } = await db.parentCareMessage.updateMany({ where: { id, [field]: null }, data: { [field]: now, ...(action === "click" && !m.openedAt ? { openedAt: now } : {}) } });
  if (count && action !== "dismiss") {
    await recordEvent({ userId: actor.id, familyId: actor.familyId, type: action === "open" ? "NOTIFICATION_OPENED" : "NOTIFICATION_CLICKED", eventId: `${action}:${m.id}`, at: now, meta: { automation: m.automationKey, channel: m.channel } });
  }
  return { ok: true, link: safeLink(m.link) };
}

/** In-app messages the parent has now seen on the Safety plan: opened, once each. */
export async function noteMessagesShown(actor: Actor, ids: string[], now = new Date()) {
  const unseen = await db.parentCareMessage.findMany({ where: { id: { in: ids }, userId: actor.id, channel: "IN_APP", openedAt: null }, select: { id: true, automationKey: true } });
  if (!unseen.length) return;
  await db.parentCareMessage.updateMany({ where: { id: { in: unseen.map((m) => m.id) }, openedAt: null }, data: { openedAt: now } });
  await recordEvents(unseen.map((m) => ({ userId: actor.id, familyId: actor.familyId, type: "NOTIFICATION_OPENED" as const, eventId: `open:${m.id}`, at: now, meta: { automation: m.automationKey, channel: "IN_APP" } })));
}

/** An email's tracked link: records the click, and says where to go. Null for a link that isn't ours. */
export async function openByToken(token: string, now = new Date()) {
  if (!token || token.length > 64) return null;
  const m = await db.parentCareMessage.findUnique({ where: { token }, select: { id: true, userId: true, link: true, user: { select: { familyId: true } } } });
  if (!m) return null;
  await markMessage({ id: m.userId, familyId: m.user.familyId }, m.id, "click", now);
  return safeLink(m.link);
}

export { optOutByToken } from "./optout";

/* ---------- Monthly report ---------- */

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A month's report (default: last month), from the family's own records only. */
export async function careReport(actor: Actor, month?: string, now = new Date()) {
  const ctx = await context(actor);
  const m = month ?? previousMonth(now, ctx.tz);
  const thisMonth = localDay(now, ctx.tz).slice(0, 7);
  if (!MONTH.test(m) || m > thisMonth) throw new ServiceError(400, "Choose a month that has started.", "invalid");
  const numbers = await monthlyNumbers(ctx.user, m, ctx.tz);
  const from = slot(`${m}-01`, 0, ctx.tz), to = slot(`${addDays(`${m}-01`, 32).slice(0, 7)}-01`, 0, ctx.tz);
  const done = await db.parentCareEvent.findMany({ where: { userId: actor.id, type: "ACTIVITY_COMPLETED", occurredAt: { gte: from, lt: to } }, orderBy: { occurredAt: "asc" }, select: { meta: true, occurredAt: true } });
  const states = await db.parentCareActivity.findMany({ where: { userId: actor.id }, select: { activityKey: true, status: true, completedAt: true } });
  const [next] = pickPlan({ ages: ctx.ages, states, now });
  await recordEvent({ userId: actor.id, familyId: actor.familyId, type: "REPORT_VIEWED", eventId: `report:${actor.id}:${m}:${localDay(now, "UTC")}`, at: now, meta: { month: m } });
  return {
    ...numbers,
    activities: done.map((e) => {
      const a = activityByKey(String((e.meta as Record<string, unknown>).activity ?? ""));
      return a ? { key: a.key, title: a.title, completedAt: e.occurredAt.toISOString() } : null;
    }).filter((a) => !!a),
    nextStep: next ? { key: next, title: activityByKey(next)!.title, minutes: activityByKey(next)!.minutes } : null,
    joinedAfter: ctx.user.createdAt >= to,
  };
}

/** Records that the parent opened this week's plan (once a week), for plan engagement */
export async function notePlanOpened(actor: Actor, now = new Date()) {
  const ctx = await context(actor);
  const week = weekOf(now, ctx.tz);
  const { count } = await db.parentCarePlan.updateMany({ where: { userId: actor.id, week, openedAt: null }, data: { openedAt: now } });
  if (count) await recordEvent({ userId: actor.id, familyId: actor.familyId, type: "PLAN_OPENED", eventId: `planopen:${actor.id}:${week}`, at: now, meta: { week } });
}
