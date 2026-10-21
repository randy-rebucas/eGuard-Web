import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { HOLDOUT_PCT, INACTIVE_DAYS } from "./definitions";

/**
 * Parent-care events: the lifecycle of every automation and what parents did, for measuring retention and
 * reactivation (lib/parent-care/metrics). Each has a stable `eventId`, so recording the same thing twice (a retry,
 * a double tap, an app resending its queue) stores it once. Only ever about the signed-in parent: callers pass the
 * user from the session, never an id a client sent.
 */

export const EVENT_TYPES = [
  "PARENT_REGISTERED", "QUALIFYING_ACTIVITY",
  "ACTIVITY_STARTED", "ACTIVITY_COMPLETED", "ACTIVITY_DISMISSED",
  "PLAN_CREATED", "PLAN_OPENED", "WEEKLY_PLAN_STARTED", "REPORT_VIEWED",
  "AUTOMATION_ELIGIBLE", "AUTOMATION_ENROLLED", "AUTOMATION_EXITED",
  "NOTIFICATION_SCHEDULED", "NOTIFICATION_CANCELLED", "NOTIFICATION_ATTEMPTED", "NOTIFICATION_ACCEPTED",
  "NOTIFICATION_DELIVERED", "NOTIFICATION_OPENED", "NOTIFICATION_CLICKED", "NOTIFICATION_OPTED_OUT",
  "NOTIFICATION_FAILED", "DUPLICATE_BLOCKED", "PARENT_REACTIVATED",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * What counts as a parent actually using eGuard: changing a protection, answering a child's request, adding a
 * child or device, working on a safety activity. Opening the app, reading a page or a background sync never does.
 */
export const QUALIFYING_KINDS = [
  "protection_change", "app_decision", "web_request_decision", "screen_rule", "extra_time", "child_added", "child_updated",
  "device_pairing", "browser_policy", "place_saved", "activity_started", "activity_completed", "registered",
] as const;
export type QualifyingKind = (typeof QUALIFYING_KINDS)[number];

/** The events a client (the app) may report itself through POST /care/events; the rest only happen on the server. */
export const CLIENT_EVENT_TYPES = ["NOTIFICATION_OPENED", "NOTIFICATION_CLICKED", "PLAN_OPENED", "REPORT_VIEWED"] as const satisfies readonly EventType[];

type Meta = Record<string, string | number | boolean | null>;

export type RecordEvent = { userId: string; familyId: string; type: EventType; eventId?: string; at?: Date; meta?: Meta };

/** Stores events, dropping any whose `eventId` is already stored. Returns how many were new. */
export async function recordEvents(events: RecordEvent[], client: Prisma.TransactionClient | typeof db = db) {
  if (!events.length) return 0;
  const { count } = await client.parentCareEvent.createMany({
    data: events.map((e) => ({
      eventId: e.eventId ?? `${e.type}:${randomUUID()}`, userId: e.userId, familyId: e.familyId, type: e.type,
      occurredAt: e.at ?? new Date(), meta: e.meta ?? {},
    })),
    skipDuplicates: true,
  });
  return count;
}

export const recordEvent = (e: RecordEvent, client?: Prisma.TransactionClient | typeof db) => recordEvents([e], client);

/** TREATMENT or HOLDOUT, from the user id alone: stable, and the same whichever server makes the row. */
export function cohortFor(userId: string, pct = HOLDOUT_PCT) {
  const n = createHash("sha256").update(`care-holdout:${userId}`).digest().readUInt32BE(0) % 100;
  return n < pct ? "HOLDOUT" : "TREATMENT";
}

/** The parent's preferences row, made on first use with the defaults and their cohort. */
export async function ensurePreference(userId: string) {
  const found = await db.parentCarePreference.findUnique({ where: { userId } });
  if (found) return found;
  await db.parentCarePreference.createMany({ data: [{ userId, cohort: cohortFor(userId) }], skipDuplicates: true });
  return db.parentCarePreference.findUniqueOrThrow({ where: { userId } });
}

/** Whole minutes: the same action reported twice within a minute is one event */
const minuteOf = (d: Date) => Math.floor(d.getTime() / 60_000);

/**
 * Records a qualifying action. If it ends at least INACTIVE_DAYS without one, it's a reactivation: recorded once
 * per inactivity period, and the rest of that period's check-in sequence is cancelled straight away.
 */
export async function noteActivity(actor: { id: string; familyId: string }, kind: QualifyingKind, at = new Date()) {
  const pref = await ensurePreference(actor.id);
  const before = pref.lastQualifyingAt;
  await recordEvent({ userId: actor.id, familyId: actor.familyId, type: "QUALIFYING_ACTIVITY", eventId: `qa:${actor.id}:${kind}:${minuteOf(at)}`, at, meta: { kind } });
  // Only forward: a late, older report doesn't make the parent look inactive
  const { count } = await db.parentCarePreference.updateMany({ where: { userId: actor.id, lastQualifyingAt: { lt: at } }, data: { lastQualifyingAt: at } });
  if (!count || at.getTime() - before.getTime() < INACTIVE_DAYS * 864e5) return { reactivated: false };

  const open = await db.parentCareEnrollment.findMany({
    where: { userId: actor.id, automationKey: "check_in", OR: [{ status: "ACTIVE" }, { status: "HOLDOUT", completedAt: null }] },
    select: { id: true, status: true, step: true },
  });
  await db.$transaction([
    db.parentCareJob.updateMany({
      where: { userId: actor.id, automationKey: "check_in", status: "PENDING" },
      data: { status: "CANCELLED", lastError: "returned", processedAt: at },
    }),
    db.parentCareEnrollment.updateMany({
      where: { id: { in: open.filter((e) => e.status === "ACTIVE").map((e) => e.id) } },
      data: { status: "EXITED", exitReason: "returned", completedAt: at, nextAt: null },
    }),
    // Holdout enrollments keep their status, so they stay the comparison group; only their end is recorded
    db.parentCareEnrollment.updateMany({
      where: { id: { in: open.filter((e) => e.status === "HOLDOUT").map((e) => e.id) }, completedAt: null },
      data: { exitReason: "returned", completedAt: at },
    }),
  ]);
  await recordEvent({
    userId: actor.id, familyId: actor.familyId, type: "PARENT_REACTIVATED", eventId: `react:${actor.id}:${before.toISOString()}`, at,
    meta: {
      kind, inactiveDays: Math.floor((at.getTime() - before.getTime()) / 864e5), cohort: pref.cohort,
      // Messages already sent before they came back: 0 means they returned on their own
      enrolled: open.some((e) => e.status === "ACTIVE"), messagesBefore: open.find((e) => e.status === "ACTIVE")?.step ?? 0,
    },
  });
  return { reactivated: true };
}

/**
 * For the app's own services: a qualifying action must never fail the action itself (a parent's protection change
 * matters more than our measurement of it), so a failure here is logged and the caller carries on.
 */
export async function noteActivitySafely(actor: { id: string; familyId: string }, kind: QualifyingKind) {
  try {
    await noteActivity(actor, kind);
  } catch (e) {
    console.error("[parent-care] couldn't record activity", kind, e);
  }
}
