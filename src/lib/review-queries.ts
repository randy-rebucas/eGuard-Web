import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { pageByTime } from "./paging";
import { SENTIMENTS, TOPICS, URGENCIES, isStore, type Store } from "./store-reviews/types";

/**
 * What console › Store reviews reads (docs/console.md › Store reviews). Kept apart from lib/console-queries, whose
 * privacy rule forbids any text: store reviews are public words their authors posted, not a family's data. Nothing
 * here reads an account, a child or their activity (src/lib/test/review-queries.test.ts checks it).
 */

export const REVIEW_PAGE = 50;

export const REVIEW_STATUSES = ["NEW", "DRAFTED", "FAILED", "REPLIED", "IGNORED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  NEW: "New", DRAFTED: "Draft ready", FAILED: "Post failed", REPLIED: "Replied", IGNORED: "Ignored",
};

export type ReviewFilter = {
  status?: ReviewStatus | null;
  store?: Store | null;
  /** 1–5 */
  stars?: number | null;
  sentiment?: (typeof SENTIMENTS)[number] | null;
  topic?: (typeof TOPICS)[number] | null;
  urgency?: (typeof URGENCIES)[number] | null;
  likelyChild?: boolean;
};

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const oneOf = <T extends string>(list: readonly T[], v: string): T | null => ((list as readonly string[]).includes(v) ? (v as T) : null);

/** The inbox's filters from its query string; anything unknown is ignored */
export function reviewFilter(sp: Record<string, string | string[] | undefined>): ReviewFilter {
  const stars = Number(one(sp.stars));
  const store = one(sp.store);
  return {
    status: oneOf(REVIEW_STATUSES, one(sp.status)),
    store: isStore(store) ? store : null,
    stars: Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : null,
    sentiment: oneOf(SENTIMENTS, one(sp.sentiment)),
    topic: oneOf(TOPICS, one(sp.topic)),
    urgency: oneOf(URGENCIES, one(sp.urgency)),
    likelyChild: one(sp.child) === "1",
  };
}

function where(f: ReviewFilter): Prisma.StoreReviewWhereInput {
  return {
    // "Post failed" also covers a draft that failed and is waiting; "New" includes reviews still being read by AI
    ...(f.status ? { status: f.status } : {}),
    ...(f.store ? { store: f.store } : {}),
    ...(f.stars ? { rating: f.stars } : {}),
    ...(f.sentiment ? { sentiment: f.sentiment } : {}),
    ...(f.topic ? { topics: { has: f.topic } } : {}),
    ...(f.urgency ? { urgency: f.urgency } : {}),
    ...(f.likelyChild ? { likelyChild: true } : {}),
  };
}

export async function listStoreReviews(f: ReviewFilter, before?: Date) {
  const w = where(f);
  return pageByTime(
    REVIEW_PAGE,
    (reviewedAt, take) => db.storeReview.findMany({
      where: { ...w, reviewedAt },
      orderBy: { reviewedAt: "desc" },
      take,
      select: {
        id: true, store: true, rating: true, reviewTitle: true, text: true, authorName: true, reviewedAt: true, status: true,
        sentiment: true, topics: true, urgency: true, summary: true, likelyChild: true, storeReplyText: true,
      },
    }),
    (r) => r.reviewedAt,
    before,
  );
}

export async function storeReviewDetail(id: string) {
  return db.storeReview.findUnique({
    where: { id },
    include: { replies: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
}

/** The draft staff are working on: the newest open reply written for the review's current words */
export const openDraft = <R extends { status: string; forTextHash: string }>(replies: R[], textHash: string) =>
  replies.find((r) => ["DRAFT", "FAILED"].includes(r.status) && r.forTextHash === textHash) ?? null;

/** Median of a list of numbers, or null */
export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const daysAgo = (n: number, now: number) => new Date(now - n * 864e5);

/** The strip above the inbox: averages, what's waiting, how fast replies go out, and what reviews are about */
export async function reviewStats(now = Date.now()) {
  const since90 = daysAgo(90, now);
  const [byStore30, byStore90, byStoreAll, waiting, lowUnanswered, replied, topics, sync] = await Promise.all([
    db.storeReview.groupBy({ by: ["store"], where: { reviewedAt: { gte: daysAgo(30, now) } }, _avg: { rating: true }, _count: true }),
    db.storeReview.groupBy({ by: ["store"], where: { reviewedAt: { gte: since90 } }, _avg: { rating: true }, _count: true }),
    db.storeReview.groupBy({ by: ["store"], _avg: { rating: true }, _count: true }),
    db.storeReview.count({ where: { status: { in: ["NEW", "DRAFTED", "FAILED"] } } }),
    db.storeReview.count({ where: { rating: { lte: 2 }, storeReplyText: null, status: { not: "IGNORED" }, reviewedAt: { gte: since90 } } }),
    db.storeReviewReply.findMany({
      where: { status: "POSTED", postedAt: { gte: since90 } },
      select: { postedAt: true, review: { select: { reviewedAt: true } } },
      take: 1000,
    }),
    db.$queryRaw<{ topic: string; n: bigint }[]>`
      SELECT t AS topic, COUNT(*) AS n FROM "StoreReview", unnest("topics") AS t
      WHERE "reviewedAt" >= ${since90} GROUP BY t ORDER BY n DESC LIMIT 6`,
    db.storeSyncState.findMany(),
  ]);
  const per = (rows: typeof byStoreAll) => Object.fromEntries(rows.map((r) => [r.store, { avg: r._avg.rating, n: r._count }])) as Partial<Record<Store, { avg: number | null; n: number }>>;
  const hours = replied.flatMap((r) => (r.postedAt ? [(r.postedAt.getTime() - r.review.reviewedAt.getTime()) / 3600_000] : []));
  return {
    d30: per(byStore30), d90: per(byStore90), all: per(byStoreAll),
    waiting, lowUnanswered,
    medianReplyHours: median(hours),
    topics: topics.map((t) => ({ topic: t.topic, n: Number(t.n) })),
    sync: Object.fromEntries(sync.map((s) => [s.store, s])) as Partial<Record<Store, (typeof sync)[number]>>,
  };
}

/** Console › Alerts: 1–2 star reviews unanswered for 2 days, and stores whose sync hasn't worked in 36 hours */
export async function reviewAlerts(now = Date.now()) {
  const [stale, sync] = await Promise.all([
    db.storeReview.count({
      where: { rating: { lte: 2 }, storeReplyText: null, status: { notIn: ["IGNORED", "REPLIED"] }, reviewedAt: { lt: new Date(now - 48 * 3600_000), gte: daysAgo(30, now) } },
    }),
    db.storeSyncState.findMany({ select: { store: true, lastSuccessAt: true, lastError: true, lastRunAt: true } }),
  ]);
  const failing = sync.filter((s) => s.lastRunAt && (!s.lastSuccessAt || now - s.lastSuccessAt.getTime() > 36 * 3600_000));
  return { unansweredLow: stale, failingSync: failing };
}
