import "server-only";
import { db } from "../db";
import { pushAvailable } from "../push";
import { AUTOMATIONS, CONTACT_LIMITS, HOLDOUT_PCT, INACTIVE_DAYS } from "./definitions";
import { TEMPLATES } from "./templates";

/**
 * Aggregated parent-care numbers for the console (docs/features/parent-care.md › Metrics). Counts only, never a
 * parent's identity. Every rate names its numerator and denominator, and retention and reactivation are split by
 * cohort, so the holdout group is the comparison: a difference between cohorts is evidence, a before-and-after
 * isn't.
 */

const DAY = 864e5;
export type Rate = { n: number; of: number; pct: number | null };
const rate = (n: number, of: number): Rate => ({ n, of, pct: of ? Math.round((n / of) * 1000) / 10 : null });
type CohortRates = { TREATMENT: Rate; HOLDOUT: Rate };
const byCohort = (rows: { cohort: string; n: number; total: number }[]): CohortRates => {
  const get = (c: string) => rows.find((r) => r.cohort === c) ?? { n: 0, total: 0 };
  return { TREATMENT: rate(get("TREATMENT").n, get("TREATMENT").total), HOLDOUT: rate(get("HOLDOUT").n, get("HOLDOUT").total) };
};

/**
 * Retention: of parents who signed up in the window, the share with a qualifying action `fromDay`–`toDay` days
 * after signing up (signing up itself doesn't count). Day 7: actions on days 1–7, for sign-ups 8–37 days ago.
 * Day 30: actions on days 23–30, for sign-ups 31–60 days ago.
 */
async function retention(now: Date, fromDay: number, toDay: number, windowDays: number) {
  const to = new Date(now.getTime() - (toDay + 1) * DAY), from = new Date(to.getTime() - windowDays * DAY);
  const rows = await db.$queryRaw<{ cohort: string; n: number; total: number }[]>`
    SELECT p.cohort, count(*)::int AS total,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "ParentCareEvent" e WHERE e."userId" = u.id AND e.type = 'QUALIFYING_ACTIVITY'
          AND e."occurredAt" > u."createdAt" + make_interval(days => ${fromDay}::int) AND e."occurredAt" <= u."createdAt" + make_interval(days => ${toDay}::int)
      ))::int AS n
    FROM "User" u JOIN "ParentCarePreference" p ON p."userId" = u.id
    WHERE u."createdAt" >= ${from} AND u."createdAt" < ${to}
    GROUP BY p.cohort`;
  return { ...byCohort(rows), window: { from: from.toISOString(), to: to.toISOString() } };
}

/** Of check-in enrollments started 7–60 days ago, the share whose parent came back within 7 days of enrolling. */
async function reactivationRate(now: Date) {
  const rows = await db.$queryRaw<{ cohort: string; n: number; total: number }[]>`
    SELECT p.cohort, count(*)::int AS total,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "ParentCareEvent" e WHERE e."userId" = en."userId" AND e.type = 'PARENT_REACTIVATED'
          AND e."occurredAt" >= en."startedAt" AND e."occurredAt" <= en."startedAt" + interval '7 days'
      ))::int AS n
    FROM "ParentCareEnrollment" en JOIN "ParentCarePreference" p ON p."userId" = en."userId"
    WHERE en."automationKey" = 'check_in' AND en."startedAt" >= ${new Date(now.getTime() - 60 * DAY)} AND en."startedAt" < ${new Date(now.getTime() - 7 * DAY)}
    GROUP BY 1`;
  return byCohort(rows);
}

/** Of activities started 7–37 days ago, the share completed within 7 days of starting. */
async function completionRate(now: Date) {
  const [r] = await db.$queryRaw<{ n: number; total: number }[]>`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "ParentCareEvent" c WHERE c."userId" = s."userId" AND c.type = 'ACTIVITY_COMPLETED'
          AND c.meta->>'activity' = s.meta->>'activity' AND c."occurredAt" >= s."occurredAt" AND c."occurredAt" <= s."occurredAt" + interval '7 days'
      ))::int AS n
    FROM "ParentCareEvent" s
    WHERE s.type = 'ACTIVITY_STARTED' AND s."occurredAt" >= ${new Date(now.getTime() - 37 * DAY)} AND s."occurredAt" < ${new Date(now.getTime() - 7 * DAY)}`;
  return rate(r?.n ?? 0, r?.total ?? 0);
}

/** The Engagement overview */
export async function engagementOverview(now = new Date()) {
  const week = new Date(now.getTime() - 7 * DAY), month = new Date(now.getTime() - 30 * DAY);
  const [[waf], retention7, retention30, inactive, reactivated, reactivation, completion, completed30, started30, channelRows, optOutRows] = await Promise.all([
    db.$queryRaw<{ n: number }[]>`SELECT count(DISTINCT "familyId")::int AS n FROM "ParentCareEvent" WHERE type = 'QUALIFYING_ACTIVITY' AND "occurredAt" >= ${week}`,
    retention(now, 1, 7, 30),
    retention(now, 23, 30, 30),
    db.parentCarePreference.groupBy({ by: ["cohort"], where: { lastQualifyingAt: { lt: new Date(now.getTime() - INACTIVE_DAYS * DAY) } }, _count: true }),
    db.parentCareEvent.count({ where: { type: "PARENT_REACTIVATED", occurredAt: { gte: month } } }),
    reactivationRate(now),
    completionRate(now),
    db.parentCareEvent.count({ where: { type: "ACTIVITY_COMPLETED", occurredAt: { gte: month } } }),
    db.parentCareEvent.count({ where: { type: "ACTIVITY_STARTED", occurredAt: { gte: month } } }),
    db.$queryRaw<{ channel: string; sent: number; opened: number; clicked: number }[]>`
      SELECT channel, count(*)::int AS sent, count("openedAt")::int AS opened, count("clickedAt")::int AS clicked
      FROM "ParentCareMessage" WHERE status IN ('ACCEPTED', 'DELIVERED', 'UNCERTAIN') AND "sentAt" >= ${month} GROUP BY channel`,
    db.$queryRaw<{ scope: string; n: number }[]>`
      SELECT coalesce(meta->>'channel', meta->>'automation', meta->>'scope', 'other') AS scope, count(*)::int AS n
      FROM "ParentCareEvent" WHERE type = 'NOTIFICATION_OPTED_OUT' AND "occurredAt" >= ${month} GROUP BY 1`,
  ]);
  const optOuts = new Map(optOutRows.map((r) => [r.scope, r.n]));
  return {
    weeklyActiveFamilies: waf?.n ?? 0,
    retention7, retention30,
    eligibleInactive: Object.fromEntries(inactive.map((r) => [r.cohort, r._count])) as Partial<Record<string, number>>,
    reactivated30: reactivated,
    reactivation,
    completion, completed30, started30,
    channels: (["PUSH", "EMAIL", "IN_APP"] as const).map((c) => {
      const r = channelRows.find((x) => x.channel === c) ?? { sent: 0, opened: 0, clicked: 0 };
      // Opt-out rate: opt-outs of the channel per message sent on it, same 30 days
      return { channel: c, sent: r.sent, opened: rate(r.opened, r.sent), clicked: rate(r.clicked, r.sent), optOut: rate(optOuts.get(c) ?? 0, r.sent) };
    }),
    optOutsAll: optOuts.get("ALL") ?? 0,
    holdoutPct: HOLDOUT_PCT,
  };
}

/** Per automation: live state, enrollments, last 30 days' messages, clicks and conversions. */
export async function automationStats(now = new Date()) {
  const month = new Date(now.getTime() - 30 * DAY);
  const [rows, jobs, enrollments, perf] = await Promise.all([
    db.parentCareAutomation.findMany({ orderBy: { key: "asc" } }),
    db.parentCareJob.groupBy({ by: ["automationKey", "status"], _count: true }),
    db.parentCareEnrollment.groupBy({ by: ["automationKey", "status"], _count: true }),
    // Conversion: a message followed by a completed activity within 7 days
    db.$queryRaw<{ automationKey: string; sent: number; clicked: number; converted: number }[]>`
      SELECT m."automationKey", count(*)::int AS sent, count(m."clickedAt")::int AS clicked,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM "ParentCareEvent" e WHERE e."userId" = m."userId" AND e.type = 'ACTIVITY_COMPLETED'
            AND e."occurredAt" >= m."sentAt" AND e."occurredAt" <= m."sentAt" + interval '7 days'
        ))::int AS converted
      FROM "ParentCareMessage" m WHERE m.status IN ('ACCEPTED', 'DELIVERED', 'UNCERTAIN') AND m."sentAt" >= ${month}
      GROUP BY m."automationKey"`,
  ]);
  return AUTOMATIONS.map((def) => {
    const row = rows.find((r) => r.key === def.key);
    const count = (list: { automationKey: string; status: string; _count: number }[], status: string) => list.find((x) => x.automationKey === def.key && x.status === status)?._count ?? 0;
    const p = perf.find((x) => x.automationKey === def.key) ?? { sent: 0, clicked: 0, converted: 0 };
    return {
      def, enabled: row?.enabled ?? false, synced: !!row, liveVersion: row?.version ?? null, updatedBy: row?.updatedBy ?? null, updatedAt: row?.updatedAt ?? null,
      jobs: Object.fromEntries(["PENDING", "RUNNING", "DONE", "SKIPPED", "CANCELLED", "DEAD"].map((s) => [s, count(jobs, s)])) as Record<string, number>,
      enrollments: Object.fromEntries(["ACTIVE", "COMPLETED", "EXITED", "HOLDOUT"].map((s) => [s, count(enrollments, s)])) as Record<string, number>,
      sent30: p.sent, clicked: rate(p.clicked, p.sent), converted: rate(p.converted, p.sent),
    };
  });
}

/** Why jobs were skipped or failed, per automation: the codes, never details about a parent */
export async function outcomeReasons(automationKey?: string) {
  const rows = await db.parentCareJob.groupBy({
    by: ["status", "lastError"], where: { status: { in: ["SKIPPED", "DEAD", "CANCELLED", "PENDING"] }, lastError: { not: null }, ...(automationKey ? { automationKey } : {}) },
    _count: true, orderBy: { _count: { status: "desc" } }, take: 40,
  });
  return rows.map((r) => ({ status: r.status, reason: r.lastError!, n: r._count }));
}

/** Delivery operations: the queue by state, retries, failures and duplicate guards over the last 30 days. */
export async function deliveryOps(now = new Date()) {
  const month = new Date(now.getTime() - 30 * DAY);
  const [byStatus, overdue, retrying, processed, dead, duplicates, uncertain, messageStatus, errors] = await Promise.all([
    db.parentCareJob.groupBy({ by: ["status"], _count: true }),
    db.parentCareJob.count({ where: { status: "PENDING", runAt: { lt: new Date(now.getTime() - 30 * 60_000) } } }),
    db.parentCareJob.count({ where: { status: "PENDING", attempts: { gt: 0 } } }),
    db.parentCareJob.count({ where: { status: { in: ["DONE", "SKIPPED", "DEAD"] }, processedAt: { gte: month } } }),
    db.parentCareJob.count({ where: { status: "DEAD", processedAt: { gte: month } } }),
    db.parentCareEvent.count({ where: { type: "DUPLICATE_BLOCKED", occurredAt: { gte: month } } }),
    db.parentCareMessage.count({ where: { status: "UNCERTAIN", createdAt: { gte: month } } }),
    db.parentCareMessage.groupBy({ by: ["channel", "status"], where: { createdAt: { gte: month } }, _count: true }),
    db.parentCareMessage.groupBy({ by: ["channel", "error"], where: { status: "FAILED", error: { not: null }, createdAt: { gte: month } }, _count: true }),
  ]);
  const accepted = messageStatus.filter((m) => m.status === "ACCEPTED" || m.status === "DELIVERED").reduce((s, m) => s + m._count, 0);
  const failed = messageStatus.filter((m) => m.status === "FAILED").reduce((s, m) => s + m._count, 0);
  return {
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])) as Partial<Record<string, number>>,
    overdue, retrying,
    reliability: rate(accepted, accepted + failed),
    failureRate: rate(dead, processed),
    duplicateRate: rate(duplicates, processed),
    duplicatesBlocked: duplicates, uncertain,
    messageStatus: messageStatus.map((m) => ({ channel: m.channel, status: m.status, n: m._count })),
    providerErrors: errors.map((e) => ({ channel: e.channel, code: e.error!, n: e._count })).sort((a, b) => b.n - a.n),
  };
}

/** Failed and retrying jobs, newest first: ids, codes and counts only. */
export async function failedJobs(o: { status?: "DEAD" | "RETRYING"; before?: Date; take?: number } = {}) {
  const take = o.take ?? 50;
  const rows = await db.parentCareJob.findMany({
    where: o.status === "RETRYING" ? { status: "PENDING", attempts: { gt: 0 } } : { status: "DEAD", ...(o.before ? { processedAt: { lt: o.before } } : {}) },
    orderBy: o.status === "RETRYING" ? { runAt: "asc" } : { processedAt: "desc" }, take: take + 1,
    select: { id: true, automationKey: true, attempts: true, lastError: true, runAt: true, processedAt: true, createdAt: true, user: { select: { familyId: true } }, messages: { select: { channel: true, status: true, error: true } } },
  });
  return { rows: rows.slice(0, take), nextBefore: rows.length > take ? rows[take - 1].processedAt : null };
}

/** Trust and compliance: consent, suppressions, channel readiness, limits, templates. Counts only. */
export async function trustOverview() {
  const [total, prefs, suppressions] = await Promise.all([
    db.parentCarePreference.count(),
    db.$queryRaw<{ enabled: number; off: number; inApp: number; push: number; pushConsent: number; email: number; emailConsent: number; holdout: number; fil: number }[]>`
      SELECT count(*) FILTER (WHERE enabled)::int AS enabled, count(*) FILTER (WHERE NOT enabled)::int AS off,
        count(*) FILTER (WHERE enabled AND "inApp")::int AS "inApp",
        count(*) FILTER (WHERE enabled AND push)::int AS push, count(*) FILTER (WHERE push AND "pushConsentAt" IS NOT NULL)::int AS "pushConsent",
        count(*) FILTER (WHERE enabled AND email)::int AS email, count(*) FILTER (WHERE email AND "emailConsentAt" IS NOT NULL)::int AS "emailConsent",
        count(*) FILTER (WHERE cohort = 'HOLDOUT')::int AS holdout, count(*) FILTER (WHERE language = 'fil')::int AS fil
      FROM "ParentCarePreference"`,
    db.parentCareSuppression.groupBy({ by: ["scope", "reason"], _count: true }),
  ]);
  const production = process.env.NODE_ENV === "production";
  return {
    total, prefs: prefs[0],
    suppressions: suppressions.map((s) => ({ scope: s.scope, reason: s.reason, n: s._count })),
    channels: {
      push: pushAvailable() ? "FCM configured (FCM_SERVICE_ACCOUNT)" : "Not configured: FCM_SERVICE_ACCOUNT isn't set, so push is never chosen",
      email: !production ? "Development: every email goes to Mailpit"
        : process.env.RESEND_API_KEY?.trim() ? "Resend (RESEND_API_KEY)" : process.env.SMTP_URL?.trim() ? "SMTP (SMTP_URL)" : "Not configured: emails fail and are retried, then given up",
      inApp: "Always available",
    },
    limits: CONTACT_LIMITS,
    templates: TEMPLATES.map((t) => ({ key: t.key, name: t.name, version: t.version, languages: Object.entries(t.copy).map(([lang, c]) => ({ lang, approval: c!.approval })) })),
  };
}

/** Staff changes to parent care, from the console's own audit log */
export const careAudit = (take = 30) =>
  db.staffAuditLog.findMany({ where: { action: { startsWith: "care." } }, orderBy: { createdAt: "desc" }, take, include: { staff: { select: { name: true } } } });
