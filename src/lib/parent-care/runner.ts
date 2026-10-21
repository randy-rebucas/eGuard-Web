import "server-only";
import type { ParentCareJob, ParentCarePreference, Prisma } from "@prisma/client";
import { db } from "../db";
import { isPendingInvite, newToken } from "../auth";
import { activityByKey, agesFrom, pickPlan, pickTip, type ActivityState } from "./content";
import { AUTOMATIONS, CONTACT_LIMITS, INACTIVE_DAYS, LATE_MS, automationByKey, type AutomationDef, type AutomationKey, type Channel } from "./definitions";
import { ADAPTERS, availableChannels } from "./delivery";
import { checkEligibility, type EligibilityInput, type SentMessage } from "./eligibility";
import { cohortFor, ensurePreference, recordEvent, recordEvents } from "./events";
import { cancelJobs, claimDue, classifyError, enqueue, nextAttempt, releaseStale, type NewJob } from "./queue";
import { addDays, afterQuietHours, daysSince, localDay, previousMonth, slot, slotsBetween, weekOf } from "./schedule";
import { render, safeLink, type MonthlyNumbers, type RenderInput } from "./templates";

/**
 * The parent-care engine's moving parts (docs/features/parent-care.md): keeps the automations' rows in step with
 * their definitions, plans each parent's time-based messages, and delivers due jobs, rechecking everything first.
 * Runs as a step of the maintenance cron (runParentCare); nothing here sends from a parent's own request.
 */

/** How far ahead time-based messages are planned, and how often a parent is re-planned */
const HORIZON_DAYS = 2;
const REPLAN_MS = 6 * 3600_000;

/* ---------- Automations ---------- */

const snapshot = (a: AutomationDef) => ({
  schedule: a.schedule, channels: a.channels, cooldownDays: a.cooldownDays, toggle: a.toggle,
  ...(a.steps ? { steps: a.steps } : {}), ...(a.delayHours ? { delayHours: a.delayHours } : {}), limits: CONTACT_LIMITS,
});

/** Creates missing rows and refreshes changed definitions; staff's on/off is kept. Returns each automation's on/off. */
export async function syncAutomations() {
  const rows = new Map((await db.parentCareAutomation.findMany()).map((r) => [r.key, r]));
  for (const a of AUTOMATIONS) {
    const row = rows.get(a.key);
    const data = { name: a.name, description: a.description, triggerType: a.trigger, version: a.version, config: snapshot(a), templateKey: a.templateKey };
    if (!row) await db.parentCareAutomation.createMany({ data: [{ key: a.key, ...data }], skipDuplicates: true });
    else if (row.version !== a.version || row.name !== a.name || row.description !== a.description || JSON.stringify(row.config) !== JSON.stringify(data.config)) {
      await db.parentCareAutomation.update({ where: { key: a.key }, data });
    }
  }
  const live = await db.parentCareAutomation.findMany({ select: { key: true, enabled: true } });
  return new Map(live.map((r) => [r.key, r.enabled]));
}

/** Preferences for parents who have none yet (everyone, the first time this runs), with their cohort. */
export async function backfillPreferences(limit = 500) {
  const users = await db.user.findMany({ where: { carePreference: null }, select: { id: true }, take: limit });
  if (!users.length) return 0;
  const { count } = await db.parentCarePreference.createMany({ data: users.map((u) => ({ userId: u.id, cohort: cohortFor(u.id) })), skipDuplicates: true });
  return count;
}

/* ---------- A parent's context ---------- */

export type CareContext = {
  user: { id: string; email: string; name: string; familyId: string; createdAt: Date };
  active: boolean;
  emailVerified: boolean;
  tz: string;
  prefs: ParentCarePreference;
  ages: number[];
  suppressions: { scope: string; reason: string; until: Date | null }[];
  recent: SentMessage[];
  available: Record<Channel, boolean>;
};

/** Everything eligibility needs, read fresh. Null when the parent's account is gone. */
export async function loadContext(userId: string, now = new Date()): Promise<CareContext | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, familyId: true, createdAt: true, role: true, passwordSet: true, emailVerifiedAt: true, notifyPush: true,
      family: { select: { timezone: true, children: { select: { birthYear: true } } } },
    },
  });
  if (!user) return null;
  const [prefs, suppressions, recent, available] = await Promise.all([
    ensurePreference(userId),
    db.parentCareSuppression.findMany({ where: { userId }, select: { scope: true, reason: true, until: true } }),
    db.parentCareMessage.findMany({
      where: { userId, proactive: true, status: { in: ["ACCEPTED", "DELIVERED", "UNCERTAIN"] }, sentAt: { gte: new Date(now.getTime() - 7 * 864e5) } },
      select: { channel: true, automationKey: true, sentAt: true },
    }),
    availableChannels(user),
  ]);
  return {
    user: { id: user.id, email: user.email, name: user.name, familyId: user.familyId, createdAt: user.createdAt },
    active: !isPendingInvite(user), emailVerified: !!user.emailVerifiedAt,
    tz: prefs.timezone ?? user.family.timezone, prefs, ages: agesFrom(user.family.children.map((c) => c.birthYear), now),
    suppressions, recent: recent.map((m) => ({ ...m, sentAt: m.sentAt! })), available,
  };
}

const eligibilityInput = (ctx: CareContext, a: AutomationDef, enabled: boolean, now: Date, extra: Partial<EligibilityInput> = {}): EligibilityInput => ({
  now, timezone: ctx.tz, automation: { ...a, enabled }, account: { active: ctx.active, emailVerified: ctx.emailVerified },
  prefs: ctx.prefs, suppressions: ctx.suppressions, available: ctx.available, recent: ctx.recent, ...extra,
});

/* ---------- Plans ---------- */

async function activityStates(userId: string): Promise<ActivityState[]> {
  return db.parentCareActivity.findMany({ where: { userId }, select: { activityKey: true, status: true, completedAt: true } });
}

/** This week's plan for the parent, made the first time it's asked for (by the page or the Monday message). */
export async function ensurePlan(ctx: Pick<CareContext, "user" | "tz" | "ages">, now = new Date()) {
  const week = weekOf(now, ctx.tz);
  const found = await db.parentCarePlan.findUnique({ where: { userId_week: { userId: ctx.user.id, week } } });
  if (found) return found;
  const activityKeys = pickPlan({ ages: ctx.ages, states: await activityStates(ctx.user.id), now });
  await db.parentCarePlan.createMany({ data: [{ userId: ctx.user.id, week, activityKeys }], skipDuplicates: true });
  const plan = await db.parentCarePlan.findUniqueOrThrow({ where: { userId_week: { userId: ctx.user.id, week } } });
  await recordEvent({ userId: ctx.user.id, familyId: ctx.user.familyId, type: "PLAN_CREATED", eventId: `plan:${plan.id}`, meta: { week, activities: activityKeys.length } });
  return plan;
}

/* ---------- Planning time-based automations ---------- */

/** The jobs to schedule for one parent over the next HORIZON_DAYS, keyed by local date so planning again adds nothing. */
export async function planUser(ctx: CareContext, enabled: Map<string, boolean>, now = new Date()) {
  const jobs: NewJob[] = [];
  const uid = ctx.user.id, minute = ctx.prefs.deliveryMinute;
  const base = { userId: uid, familyId: ctx.user.familyId };
  const allowed = (key: AutomationKey) => checkEligibility(eligibilityInput(ctx, automationByKey(key)!, enabled.get(key) ?? false, now), "schedule");

  if (allowed("briefing").ok) {
    for (const s of slotsBetween(now, HORIZON_DAYS, ctx.tz, minute, ctx.prefs.briefingDays)) {
      jobs.push({ ...base, automationKey: "briefing", idempotencyKey: `briefing:${uid}:${s.day}`, runAt: s.at, payload: { day: s.day } });
    }
  }
  if (allowed("weekly_plan").ok) {
    for (const s of slotsBetween(now, HORIZON_DAYS, ctx.tz, minute, [1])) {
      jobs.push({ ...base, automationKey: "weekly_plan", idempotencyKey: `weekly_plan:${uid}:${s.day}`, runAt: s.at, payload: { week: s.day } });
    }
  }
  if (allowed("monthly_report").ok) {
    for (const s of slotsBetween(now, HORIZON_DAYS, ctx.tz, minute).filter((x) => x.day.endsWith("-01"))) {
      const month = previousMonth(s.at, ctx.tz);
      jobs.push({ ...base, automationKey: "monthly_report", idempotencyKey: `monthly_report:${uid}:${month}`, runAt: s.at, payload: { month } });
    }
  }

  // Check-ins: one enrollment per inactivity period, named by when it started
  const last = ctx.prefs.lastQualifyingAt;
  if (daysSince(last, now) >= INACTIVE_DAYS) {
    const a = automationByKey("check_in")!;
    const d = allowed("check_in");
    const holdout = !d.ok && d.reason === "holdout";
    if (d.ok || holdout) {
      const subjectKey = last.toISOString();
      await recordEvent({ ...base, type: "AUTOMATION_ELIGIBLE", eventId: `eligible:check_in:${uid}:${subjectKey}`, meta: { automation: "check_in", cohort: ctx.prefs.cohort } });
      const { count } = await db.parentCareEnrollment.createMany({
        data: [{ userId: uid, automationKey: "check_in", subjectKey, status: holdout ? "HOLDOUT" : "ACTIVE", version: a.version, startedAt: now }],
        skipDuplicates: true,
      });
      if (count) await recordEvent({ ...base, type: "AUTOMATION_ENROLLED", eventId: `enrolled:check_in:${uid}:${subjectKey}`, meta: { automation: "check_in", cohort: ctx.prefs.cohort } });
      const enrollment = await db.parentCareEnrollment.findUniqueOrThrow({ where: { userId_automationKey_subjectKey: { userId: uid, automationKey: "check_in", subjectKey } } });
      if (enrollment.status === "ACTIVE") {
        a.steps!.forEach((days, step) => {
          if (step < enrollment.step) return;
          const at = slot(localDay(new Date(last.getTime() + days * 864e5), ctx.tz), minute, ctx.tz);
          if (at.getTime() < now.getTime() - LATE_MS || at.getTime() > now.getTime() + HORIZON_DAYS * 864e5) return;
          jobs.push({ ...base, automationKey: "check_in", idempotencyKey: `check_in:${uid}:${subjectKey}:${step}`, runAt: at, step, enrollmentId: enrollment.id, payload: { subjectKey, step } });
        });
      }
    }
  }
  const created = await enqueue(jobs);
  await db.parentCarePreference.update({ where: { userId: uid }, data: { plannedAt: now } });
  return created.length;
}

/** Plans parents not planned in REPLAN_MS, a batch per run. Returns how many jobs were scheduled. */
export async function planDue(enabled: Map<string, boolean>, now = new Date(), limit = 300) {
  const due = await db.parentCarePreference.findMany({
    where: { enabled: true, OR: [{ plannedAt: null }, { plannedAt: { lt: new Date(now.getTime() - REPLAN_MS) } }] },
    orderBy: { plannedAt: { sort: "asc", nulls: "first" } }, take: limit, select: { userId: true },
  });
  let scheduled = 0;
  for (const p of due) {
    try {
      const ctx = await loadContext(p.userId, now);
      if (ctx) scheduled += await planUser(ctx, enabled, now);
    } catch (e) {
      console.error("[parent-care] planning failed", p.userId, e);
    }
  }
  return { parents: due.length, scheduled };
}

/** The follow-up for an activity just started: one per start, so a restarted (repeatable) activity can have another. */
export async function scheduleFollowUp(ctx: CareContext, activity: { activityKey: string; startedAt: Date }, enabled: boolean) {
  const a = automationByKey("follow_up")!;
  if (!checkEligibility(eligibilityInput(ctx, a, enabled, activity.startedAt), "schedule").ok) return null;
  const at = new Date(activity.startedAt.getTime() + a.delayHours! * 3600_000);
  const runAt = afterQuietHours(at, ctx.tz, ctx.prefs.quietStart, ctx.prefs.quietEnd);
  const [job] = await enqueue([{
    userId: ctx.user.id, familyId: ctx.user.familyId, automationKey: "follow_up", runAt,
    idempotencyKey: `follow_up:${ctx.user.id}:${activity.activityKey}:${activity.startedAt.getTime()}`,
    payload: { activityKey: activity.activityKey, startedAt: activity.startedAt.toISOString() },
  }]);
  return job ?? null;
}

/* ---------- Preparing a due job ---------- */

/** Last month's numbers, from the family's own records: events of activities done, protection changes, plans. */
export async function monthlyNumbers(user: { id: string; familyId: string }, month: string, tz: string): Promise<MonthlyNumbers> {
  const first = `${month}-01`;
  const next = addDays(first, 32).slice(0, 7);
  const from = slot(first, 0, tz), to = slot(`${next}-01`, 0, tz);
  const [completed, started, protectionChanges, planWeeks] = await Promise.all([
    db.parentCareEvent.count({ where: { userId: user.id, type: "ACTIVITY_COMPLETED", occurredAt: { gte: from, lt: to } } }),
    db.parentCareEvent.count({ where: { userId: user.id, type: "ACTIVITY_STARTED", occurredAt: { gte: from, lt: to } } }),
    db.configChange.count({ where: { familyId: user.familyId, createdAt: { gte: from, lt: to } } }),
    db.parentCarePlan.count({ where: { userId: user.id, week: { gte: addDays(first, -6), lt: `${next}-01` } } }),
  ]);
  return { month, completed, started, protectionChanges, planWeeks };
}

type Prepared = { irrelevant: string } | { irrelevant?: undefined; input: RenderInput; contentKey: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Rechecks a job's reason to exist and gathers what its message says. */
async function prepare(job: ParentCareJob, ctx: CareContext, now: Date): Promise<Prepared> {
  const p = (job.payload ?? {}) as Record<string, unknown>;
  // A planned message whose moment has long passed (the scheduler was down) would arrive at an odd hour
  if (job.automationKey !== "follow_up" && now.getTime() - job.runAt.getTime() > LATE_MS) return { irrelevant: "too_late" };
  switch (job.automationKey as AutomationKey) {
    case "briefing": {
      const sent = new Set((await db.parentCareMessage.findMany({ where: { userId: ctx.user.id, contentKey: { startsWith: "tip:" } }, select: { contentKey: true } })).map((m) => m.contentKey!));
      const seed = [...ctx.user.id].reduce((s, c) => s + c.charCodeAt(0), 0);
      const tip = pickTip({ ages: ctx.ages, sent, now, seed });
      if (!tip) return { irrelevant: "no_fresh_content" };
      const [suggestion] = pickPlan({ ages: ctx.ages, states: await activityStates(ctx.user.id), now });
      return { input: { params: { tipKey: tip.key, activityKey: suggestion ?? null } }, contentKey: tip.key };
    }
    case "follow_up": {
      const key = str(p.activityKey);
      if (!activityByKey(key)) return { irrelevant: "content_removed" };
      const row = await db.parentCareActivity.findUnique({ where: { userId_activityKey: { userId: ctx.user.id, activityKey: key } } });
      if (!row || row.status !== "STARTED") return { irrelevant: row?.status === "COMPLETED" ? "activity_completed" : "activity_not_open" };
      if (row.startedAt.toISOString() !== str(p.startedAt)) return { irrelevant: "activity_restarted" };
      return { input: { params: { activityKey: key } }, contentKey: `activity:${key}` };
    }
    case "weekly_plan": {
      const plan = await ensurePlan(ctx, now);
      const states = new Map((await activityStates(ctx.user.id)).map((s) => [s.activityKey, s.status]));
      const open = plan.activityKeys.filter((k) => states.get(k) !== "COMPLETED" && states.get(k) !== "DISMISSED");
      if (!open.length) return { irrelevant: plan.activityKeys.length ? "already_done" : "nothing_to_suggest" };
      return { input: { params: { activityKeys: open, week: plan.week } }, contentKey: `plan:${plan.week}` };
    }
    case "check_in": {
      const enrollment = job.enrollmentId ? await db.parentCareEnrollment.findUnique({ where: { id: job.enrollmentId } }) : null;
      if (!enrollment || enrollment.status !== "ACTIVE") return { irrelevant: "enrollment_closed" };
      // Any qualifying action since the period began means they're back
      if (ctx.prefs.lastQualifyingAt.toISOString() !== enrollment.subjectKey || daysSince(ctx.prefs.lastQualifyingAt, now) < INACTIVE_DAYS) return { irrelevant: "returned" };
      const plan = pickPlan({ ages: ctx.ages, states: await activityStates(ctx.user.id), now });
      const step = job.step;
      const activityKey = step === 2 ? null : plan[Math.min(step, plan.length - 1)] ?? null;
      if (step < 2 && !activityKey) return { irrelevant: "nothing_to_suggest" };
      return { input: { params: { step, activityKey } }, contentKey: `check_in:${step}:${activityKey ?? "last"}` };
    }
    case "monthly_report": {
      const month = str(p.month);
      // A parent who joined after the month ended has nothing to look back on
      if (!/^\d{4}-\d{2}$/.test(month) || ctx.user.createdAt >= slot(`${addDays(`${month}-01`, 32).slice(0, 7)}-01`, 0, ctx.tz)) return { irrelevant: "no_history" };
      return { input: { params: { month }, report: await monthlyNumbers(ctx.user, month, ctx.tz) }, contentKey: `report:${month}` };
    }
  }
  return { irrelevant: "unknown_automation" };
}

/* ---------- Delivering ---------- */

/** Reasons a skipped check-in also ends its sequence: no later step could be sent either. */
const ENDS_SEQUENCE = new Set(["opted_out", "care_off", "automation_off", "account_inactive", "returned", "enrollment_closed", "no_channel"]);

async function finish(job: ParentCareJob, status: string, lastError: string | null, now: Date) {
  await db.parentCareJob.updateMany({ where: { id: job.id, status: "RUNNING" }, data: { status, lastError, lockedAt: null, processedAt: now } });
}

export type JobOutcome = "done" | "skipped" | "deferred" | "retry" | "dead" | "cancelled" | "duplicate";

/** Delivers one claimed (RUNNING) job, exactly once whatever the retries. */
export async function processJob(job: ParentCareJob, enabled: Map<string, boolean>, now = new Date()): Promise<JobOutcome> {
  const def = automationByKey(job.automationKey);
  const ctx = await loadContext(job.userId, now);
  if (!ctx || !def) { await finish(job, "CANCELLED", ctx ? "unknown_automation" : "account_gone", now); return "cancelled"; }
  const base = { userId: ctx.user.id, familyId: ctx.user.familyId };

  // The one-message-per-job guard: a retry finds the earlier attempt
  const existing = await db.parentCareMessage.findUnique({ where: { dedupeKey: job.idempotencyKey } });
  if (existing && existing.status !== "FAILED") {
    // SENDING: the worker stopped mid-send. The provider may have it, so it's never sent again
    if (existing.status === "SENDING") await db.parentCareMessage.update({ where: { id: existing.id }, data: { status: "UNCERTAIN", error: "interrupted_send" } });
    await recordEvent({ ...base, type: "DUPLICATE_BLOCKED", eventId: `dup:${job.id}:${job.attempts}`, meta: { automation: job.automationKey, was: existing.status } });
    await finish(job, "DONE", existing.status === "SENDING" ? "interrupted_send" : "already_sent", now);
    return "duplicate";
  }

  const prepared = await prepare(job, ctx, now);
  const decision = checkEligibility(eligibilityInput(ctx, def, enabled.get(def.key) ?? false, now, { irrelevant: prepared.irrelevant ?? null }), "deliver");
  if (!decision.ok) {
    if (decision.retryAt) {
      // Quiet hours: later, without spending an attempt
      await db.parentCareJob.updateMany({ where: { id: job.id, status: "RUNNING" }, data: { status: "PENDING", runAt: decision.retryAt, attempts: { decrement: 1 }, lockedAt: null, lastError: decision.reason } });
      return "deferred";
    }
    await finish(job, "SKIPPED", decision.reason, now);
    if (job.automationKey === "check_in" && job.enrollmentId && ENDS_SEQUENCE.has(decision.reason)) await exitEnrollment(job.enrollmentId, decision.reason, ctx.user.familyId, now);
    return "skipped";
  }
  if (prepared.irrelevant !== undefined) throw new Error("unreachable: eligibility passed an irrelevant job");
  const rendered = render(def.templateKey, ctx.prefs.language, prepared.input);
  if (!rendered) { await finish(job, "SKIPPED", "render_failed", now); return "skipped"; }
  const channel = decision.channel;
  const link = safeLink(rendered.link);

  const fields = {
    channel, templateKey: def.templateKey, templateVersion: rendered.version, language: rendered.language, contentKey: prepared.contentKey,
    params: prepared.input.params as Prisma.InputJsonValue, link, status: "SENDING", error: null, jobId: job.id,
  };
  const message = existing
    ? await db.parentCareMessage.update({ where: { id: existing.id }, data: fields })
    : await db.parentCareMessage.create({ data: { ...fields, userId: ctx.user.id, automationKey: job.automationKey, dedupeKey: job.idempotencyKey, token: newToken(24) } });
  await recordEvent({ ...base, type: "NOTIFICATION_ATTEMPTED", eventId: `attempt:${job.id}:${job.attempts}`, meta: { automation: job.automationKey, channel } });

  try {
    const r = await ADAPTERS[channel].send({ messageId: message.id, token: message.token, user: ctx.user, rendered: { ...rendered, link } });
    const sentAt = new Date();
    await db.parentCareMessage.update({
      where: { id: message.id },
      data: { status: r.status, providerRef: r.providerRef ?? null, sentAt, ...(r.status === "DELIVERED" ? { deliveredAt: sentAt } : {}) },
    });
    await recordEvents([
      { ...base, type: "NOTIFICATION_ACCEPTED", eventId: `accepted:${message.id}`, at: sentAt, meta: { automation: job.automationKey, channel } },
      ...(r.status === "DELIVERED" ? [{ ...base, type: "NOTIFICATION_DELIVERED" as const, eventId: `delivered:${message.id}`, at: sentAt, meta: { automation: job.automationKey, channel } }] : []),
    ]);
    await afterSent(job, prepared.input, sentAt);
    await finish(job, "DONE", null, sentAt);
    return "done";
  } catch (e) {
    const { code, retryable } = classifyError(e);
    console.error("[parent-care] delivery failed", job.id, channel, code, e instanceof Error ? e.message : e);
    await db.parentCareMessage.update({ where: { id: message.id }, data: { status: "FAILED", error: code } });
    const retryAt = nextAttempt(job.attempts, retryable, now);
    await recordEvent({ ...base, type: "NOTIFICATION_FAILED", eventId: `failed:${job.id}:${job.attempts}`, meta: { automation: job.automationKey, channel, code, final: !retryAt } });
    if (retryAt) {
      await db.parentCareJob.updateMany({ where: { id: job.id, status: "RUNNING" }, data: { status: "PENDING", runAt: retryAt, lockedAt: null, lastError: code } });
      return "retry";
    }
    await finish(job, "DEAD", code, now);
    return "dead";
  }
}

async function afterSent(job: ParentCareJob, input: RenderInput, at: Date) {
  if (job.automationKey === "weekly_plan") {
    await db.parentCarePlan.updateMany({ where: { userId: job.userId, week: String(input.params.week), deliveredAt: null }, data: { deliveredAt: at } });
  }
  if (job.automationKey === "check_in" && job.enrollmentId) {
    const last = (automationByKey("check_in")!.steps!.length - 1) === job.step;
    await db.parentCareEnrollment.updateMany({
      where: { id: job.enrollmentId, status: "ACTIVE" },
      data: last ? { step: job.step + 1, status: "COMPLETED", completedAt: at, nextAt: null } : { step: job.step + 1 },
    });
  }
}

async function exitEnrollment(id: string, reason: string, familyId: string, now: Date) {
  const { count } = await db.parentCareEnrollment.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "EXITED", exitReason: reason, completedAt: now, nextAt: null } });
  if (!count) return;
  await cancelJobs({ enrollmentId: id }, reason, familyId);
  const e = await db.parentCareEnrollment.findUniqueOrThrow({ where: { id }, select: { userId: true, automationKey: true } });
  await recordEvent({ userId: e.userId, familyId, type: "AUTOMATION_EXITED", eventId: `exited:${id}`, at: now, meta: { automation: e.automationKey, reason } });
}

/* ---------- The cron step ---------- */

/** Unusual opt-outs or failures in the last day: logged as warnings for the log alerts, and shown in the console. */
export async function healthSignals(now = new Date()) {
  const day = new Date(now.getTime() - 864e5);
  const [optOuts, sent, dead] = await Promise.all([
    db.parentCareEvent.count({ where: { type: "NOTIFICATION_OPTED_OUT", occurredAt: { gte: day } } }),
    db.parentCareMessage.count({ where: { sentAt: { gte: day }, channel: { in: ["PUSH", "EMAIL"] } } }),
    db.parentCareJob.count({ where: { status: "DEAD", processedAt: { gte: day } } }),
  ]);
  const optOutSpike = optOuts >= 5 && optOuts > sent * 0.02;
  const failureSpike = dead >= 10;
  if (optOutSpike) console.warn(`[parent-care] opt-out spike: ${optOuts} opt-outs for ${sent} push/email messages in 24 h`);
  if (failureSpike) console.warn(`[parent-care] ${dead} jobs failed for good in 24 h`);
  return { optOuts, sent, dead, optOutSpike, failureSpike };
}

/**
 * One run: sync definitions, make missing preferences, release jobs lost to a restart, plan, then deliver due jobs
 * until none are left or the time budget is spent (the next run carries on).
 */
export async function runParentCare(now = new Date(), o: { budgetMs?: number; maxJobs?: number } = {}) {
  const started = Date.now();
  const budget = o.budgetMs ?? 90_000, max = o.maxJobs ?? 500;
  const enabled = await syncAutomations();
  const preferences = await backfillPreferences();
  const released = await releaseStale(now);
  const planned = await planDue(enabled, now);
  const outcomes: Record<JobOutcome, number> = { done: 0, skipped: 0, deferred: 0, retry: 0, dead: 0, cancelled: 0, duplicate: 0 };
  let processed = 0;
  while (processed < max && Date.now() - started < budget) {
    const at = new Date(Math.max(now.getTime(), Date.now()));
    const batch = await claimDue(Math.min(25, max - processed), at);
    if (!batch.length) break;
    for (const job of batch) {
      processed++;
      try {
        outcomes[await processJob(job, enabled, at)]++;
      } catch (e) {
        // A bug or an outage outside the send itself: retried like a failed send, and logged in full
        console.error("[parent-care] job failed", job.id, e);
        const { code, retryable } = classifyError(e);
        const retryAt = nextAttempt(job.attempts, retryable, at);
        await db.parentCareJob.updateMany({
          where: { id: job.id, status: "RUNNING" },
          data: retryAt ? { status: "PENDING", runAt: retryAt, lockedAt: null, lastError: code } : { status: "DEAD", lastError: code, lockedAt: null, processedAt: at },
        });
        outcomes[retryAt ? "retry" : "dead"]++;
      }
    }
  }
  const health = await healthSignals(now);
  return { preferences, released, planned, processed, outcomes, health };
}

/** Cancels a parent's pending jobs of these automations (they changed their schedule, or turned something off). */
export async function cancelPendingFor(userId: string, familyId: string, automationKeys: AutomationKey[] | "ALL", reason: string) {
  const where: Prisma.ParentCareJobWhereInput = { userId, ...(automationKeys === "ALL" ? {} : { automationKey: { in: automationKeys } }) };
  return cancelJobs(where, reason, familyId);
}
