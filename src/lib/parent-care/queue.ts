import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { RETRY, STALE_LOCK_MS } from "./definitions";
import { recordEvents } from "./events";

/**
 * The parent-care job queue, in Postgres: no broker to run. The maintenance cron (every 10 minutes) works through
 * due jobs. Safe with overlapping runs and several servers: a job is claimed with FOR UPDATE SKIP LOCKED, so two
 * workers never take the same one, and every send is keyed so a retry can't deliver it twice (runner.ts).
 */

export type NewJob = {
  userId: string; familyId: string; automationKey: string; idempotencyKey: string; runAt: Date;
  step?: number; enrollmentId?: string | null; payload?: Prisma.InputJsonValue;
};

/** Schedules jobs; one whose key already exists (in any state) is left alone. Returns the ones created. */
export async function enqueue(jobs: NewJob[]) {
  if (!jobs.length) return [];
  const created = await db.parentCareJob.createManyAndReturn({
    data: jobs.map((j) => ({
      userId: j.userId, automationKey: j.automationKey, idempotencyKey: j.idempotencyKey, runAt: j.runAt,
      step: j.step ?? 0, enrollmentId: j.enrollmentId ?? null, payload: j.payload ?? {},
    })),
    skipDuplicates: true,
    select: { id: true, idempotencyKey: true, automationKey: true, userId: true, runAt: true },
  });
  const family = new Map(jobs.map((j) => [j.idempotencyKey, j.familyId]));
  await recordEvents(created.map((j) => ({
    userId: j.userId, familyId: family.get(j.idempotencyKey)!, type: "NOTIFICATION_SCHEDULED" as const, eventId: `scheduled:${j.idempotencyKey}`,
    meta: { automation: j.automationKey, runAt: j.runAt.toISOString() },
  })));
  return created;
}

/** Cancels pending jobs (an activity was completed, the parent returned or opted out). Returns how many. */
export async function cancelJobs(where: Prisma.ParentCareJobWhereInput, reason: string, familyId?: string) {
  const jobs = await db.parentCareJob.findMany({ where: { ...where, status: "PENDING" }, select: { id: true, userId: true, automationKey: true, idempotencyKey: true } });
  if (!jobs.length) return 0;
  // Re-checks the status: a job a worker claimed meanwhile is left to it (it rechecks relevance itself)
  const { count } = await db.parentCareJob.updateMany({ where: { id: { in: jobs.map((j) => j.id) }, status: "PENDING" }, data: { status: "CANCELLED", lastError: reason, processedAt: new Date() } });
  if (familyId) {
    await recordEvents(jobs.map((j) => ({
      userId: j.userId, familyId, type: "NOTIFICATION_CANCELLED" as const, eventId: `cancelled:${j.idempotencyKey}`, meta: { automation: j.automationKey, reason },
    })));
  }
  return count;
}

/**
 * Takes up to `limit` due jobs for this worker: PENDING with runAt passed, oldest first. Each is marked RUNNING
 * and its attempt counted in the same statement, so a crash after claiming still counts against its retries.
 */
export async function claimDue(limit: number, now = new Date()) {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "ParentCareJob" SET status = 'RUNNING', "lockedAt" = ${now}, attempts = attempts + 1, "updatedAt" = ${now}
    WHERE id IN (
      SELECT id FROM "ParentCareJob" WHERE status = 'PENDING' AND "runAt" <= ${now}
      ORDER BY "runAt" ASC LIMIT ${limit} FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  if (!rows.length) return [];
  return db.parentCareJob.findMany({ where: { id: { in: rows.map((r) => r.id) } }, orderBy: { runAt: "asc" } });
}

/**
 * Jobs a worker claimed and never finished (the server restarted mid-run): back to PENDING to try again, or DEAD
 * when out of attempts. Their message, if sending had started, is marked UNCERTAIN on the next run, not re-sent.
 */
export async function releaseStale(now = new Date()) {
  const cutoff = new Date(now.getTime() - STALE_LOCK_MS);
  const dead = await db.parentCareJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: cutoff }, attempts: { gte: RETRY.maxAttempts } },
    data: { status: "DEAD", lastError: "worker_lost", lockedAt: null, processedAt: now },
  });
  const retried = await db.parentCareJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: cutoff } },
    data: { status: "PENDING", lastError: "worker_lost", lockedAt: null, runAt: now },
  });
  return { retried: retried.count, dead: dead.count };
}

/** Exponential backoff with ±20% jitter: 5 min, 10, 20, 40… capped at 6 hours. `attempt` counts from 1. */
export function backoffMs(attempt: number, random = Math.random) {
  const base = Math.min(RETRY.maxMs, RETRY.baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.8 + random() * 0.4));
}

/** A delivery failure with an error code safe to store and show in the console. */
export class DeliveryError extends Error {
  constructor(public code: string, public retryable: boolean, message?: string) {
    super(message ?? code);
    this.name = "DeliveryError";
  }
}

/** Retry or give up: a DeliveryError says which; anything else (a timeout, the network, the database) is retried. */
export function classifyError(e: unknown): { code: string; retryable: boolean } {
  if (e instanceof DeliveryError) return { code: e.code, retryable: e.retryable };
  const msg = e instanceof Error ? e.message : String(e);
  if (/RESEND_API_KEY isn't set/.test(msg)) return { code: "email_not_configured", retryable: true };
  if (/\(4(?:0[0-9]|2[0-9])\)/.test(msg) && !/\(429\)/.test(msg)) return { code: "provider_rejected", retryable: false };
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|fetch failed|\(5\d\d\)|\(429\)/i.test(msg)) return { code: "provider_unavailable", retryable: true };
  return { code: "unexpected_error", retryable: true };
}

/** After a failure: when to try again, or null to give up. */
export const nextAttempt = (attempts: number, retryable: boolean, now: Date, random = Math.random) =>
  retryable && attempts < RETRY.maxAttempts ? new Date(now.getTime() + backoffMs(attempts, random)) : null;
