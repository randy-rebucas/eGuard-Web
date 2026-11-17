import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { pageByTime } from "./paging";
import { FEEDBACK_KINDS, FOLLOW_UPS, npsScore, type FeedbackKind, type FollowUp } from "./feedback";

/**
 * What console › Feedback reads (docs/features/feedback.md). Survey answers and "Send feedback" are the parent's own
 * words to the eGuard team, like a support ticket, so staff see them with the parent's email. Nothing here reads a
 * child or their activity (src/lib/test/feedback.test.ts checks it).
 */

export const FEEDBACK_PAGE = 50;
export const BUCKETS = ["PROMOTER", "PASSIVE", "DETRACTOR"] as const;

export type FeedbackFilter = { kind: FeedbackKind | null; bucket: (typeof BUCKETS)[number] | null; followUp: FollowUp | null };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const oneOf = <T extends string>(list: readonly T[], v: string): T | null => ((list as readonly string[]).includes(v) ? (v as T) : null);

export function feedbackFilter(sp: Record<string, string | string[] | undefined>): FeedbackFilter {
  return { kind: oneOf(FEEDBACK_KINDS, one(sp.kind)), bucket: oneOf(BUCKETS, one(sp.bucket)), followUp: oneOf(FOLLOW_UPS, one(sp.followUp)) };
}

export async function listFeedback(f: FeedbackFilter, before?: Date) {
  const where: Prisma.FeedbackWhereInput = {
    ...(f.kind ? { kind: f.kind } : {}), ...(f.bucket ? { bucket: f.bucket } : {}), ...(f.followUp ? { followUp: f.followUp } : {}),
  };
  return pageByTime(
    FEEDBACK_PAGE,
    (createdAt, take) => db.feedback.findMany({
      where: { ...where, createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, kind: true, score: true, bucket: true, comment: true, contactOk: true, platform: true, appVersion: true, followUp: true, ticketId: true, createdAt: true,
        user: { select: { email: true } }, family: { select: { id: true, name: true, plan: true } },
      },
    }),
    (r) => r.createdAt,
    before,
  );
}

const daysAgo = (n: number, now: number) => new Date(now - n * 864e5);

/** NPS over 30 and 90 days, answers by group, and what's waiting for staff */
export async function feedbackStats(now = Date.now()) {
  const [scores30, scores90, needed, byKind] = await Promise.all([
    db.feedback.findMany({ where: { kind: "NPS", createdAt: { gte: daysAgo(30, now) } }, select: { score: true } }),
    db.feedback.findMany({ where: { kind: "NPS", createdAt: { gte: daysAgo(90, now) } }, select: { score: true, bucket: true } }),
    db.feedback.count({ where: { followUp: "NEEDED" } }),
    db.feedback.groupBy({ by: ["kind"], where: { createdAt: { gte: daysAgo(90, now) } }, _count: true }),
  ]);
  const s30 = scores30.flatMap((r) => (r.score != null ? [r.score] : []));
  const s90 = scores90.flatMap((r) => (r.score != null ? [r.score] : []));
  const buckets = Object.fromEntries(BUCKETS.map((b) => [b, scores90.filter((r) => r.bucket === b).length])) as Record<(typeof BUCKETS)[number], number>;
  return {
    nps30: npsScore(s30), n30: s30.length, nps90: npsScore(s90), n90: s90.length, buckets, needed,
    byKind: Object.fromEntries(byKind.map((k) => [k.kind, k._count])) as Partial<Record<FeedbackKind, number>>,
  };
}

/** Console › Alerts: unhappy parents waiting over 2 days for staff to look */
export const feedbackNeedingFollowUp = (now = Date.now()) =>
  db.feedback.count({ where: { followUp: "NEEDED", createdAt: { lt: new Date(now - 2 * 864e5) } } });

/** One answer's words, to propose as a testimonial (console › Social proof) */
export const feedbackForQuote = (id: string) =>
  db.feedback.findUnique({ where: { id }, select: { id: true, comment: true, user: { select: { email: true } } } });
