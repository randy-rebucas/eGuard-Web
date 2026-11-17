import "server-only";
import { db } from "../db";
import { googlePlayConfig } from "../google-play";
import { aiAvailable } from "../ai";
import { classifyAndDraft, CLASSIFIER_VERSION } from "../review-ai";
import { escapeHtml, sendMail } from "../mail";
import { supportEmail } from "../support";
import { ServiceError } from "../errors";
import { CONSOLE_HOST } from "../console-host";
import { listPlayReviews, normalizePlayReview } from "./play";
import { appStoreConfig, listAscReviews } from "./app-store";
import { STORE_LABEL, reviewTextHash, type NormalizedReview, type Store } from "./types";

/**
 * Keeps StoreReview in step with Google Play and the App Store (docs/console.md › Store reviews). Run by the
 * maintenance job every 10 minutes; each store is only read every REVIEW_SYNC_HOURS (default 6), since Play keeps
 * reviews in its API for about a week. Then new reviews are read by AI (lib/review-ai) and low ratings are emailed to
 * the team.
 */

type Fetch = typeof fetch;

const HOUR = 3600_000;
/** After a failed sync, try again sooner than the usual interval */
const RETRY_MS = HOUR;
/** App Store paging stops this far past the newest review already saved, to catch ones that arrived late */
const OVERLAP_MS = 2 * 24 * HOUR;
/** A safety stop: Play has a week of reviews, the App Store's first sync reads its whole history */
const MAX_PAGES = 25;
/** Reviews read by AI per run, so a first sync's backlog spreads over a few runs */
export const CLASSIFY_PER_RUN = 15;
/** Only reviews this recent are emailed: a first sync's old 1-star reviews are history, not news */
const ALERT_WINDOW_MS = 14 * 24 * HOUR;

export const syncEveryMs = (env: Record<string, string | undefined> = process.env) => {
  const h = Number(env.REVIEW_SYNC_HOURS);
  return (Number.isFinite(h) && h >= 1 && h <= 72 ? h : 6) * HOUR;
};

type SyncState = { lastRunAt: Date | null; lastSuccessAt: Date | null; newestReviewAt: Date | null } | null;

/** Whether a store is due: never synced, the interval passed, or the last run failed an hour or more ago */
export function syncDue(state: SyncState, now: number, everyMs = syncEveryMs()) {
  if (!state?.lastRunAt) return true;
  const since = now - state.lastRunAt.getTime();
  const failed = !state.lastSuccessAt || state.lastSuccessAt < state.lastRunAt;
  return since >= everyMs || (failed && since >= Math.min(RETRY_MS, everyMs));
}

/** App Store pages come newest first: stop once a page reaches back past what's saved (less an overlap) */
export function shouldStopPaging(pageOldest: Date | null, newestKnown: Date | null, overlapMs = OVERLAP_MS) {
  return !!pageOldest && !!newestKnown && pageOldest.getTime() < newestKnown.getTime() - overlapMs;
}

type Existing = { textHash: string; storeReplyText: string | null } | null;

/** What a synced review means for the saved one */
export function reviewChange(existing: Existing, incoming: NormalizedReview): "new" | "edited" | "reply_changed" | "same" {
  if (!existing) return "new";
  if (existing.textHash !== reviewTextHash(incoming)) return "edited";
  if ((existing.storeReplyText ?? null) !== (incoming.reply?.text ?? null)) return "reply_changed";
  return "same";
}

const OPEN_REPLY = ["DRAFT", "APPROVED", "FAILED"];

/** Saves one review; returns what changed */
async function save(r: NormalizedReview, now: Date) {
  const existing = await db.storeReview.findUnique({
    where: { store_externalId: { store: r.store, externalId: r.externalId } },
    select: { id: true, textHash: true, storeReplyText: true, status: true, rating: true },
  });
  const change = reviewChange(existing, r);
  const fields = {
    rating: r.rating, reviewTitle: r.reviewTitle, text: r.text, authorName: r.authorName, language: r.language, territory: r.territory,
    appVersion: r.appVersion, device: r.device, reviewedAt: r.reviewedAt, textHash: reviewTextHash(r), lastSyncedAt: now,
  };
  const reply = { storeReplyText: r.reply?.text ?? null, storeReplyAt: r.reply?.at ?? null, storeReplyId: r.reply?.id ?? null };
  if (change === "new") {
    try {
      await db.storeReview.create({ data: { store: r.store, externalId: r.externalId, ...fields, ...reply, status: r.reply ? "REPLIED" : "NEW" } });
    } catch (e) {
      // Another run saved it first
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  } else if (existing && change === "edited") {
    // New words: the old reading and any reply written for them no longer fit
    await db.$transaction([
      db.storeReview.update({
        where: { id: existing.id },
        data: {
          ...fields, ...reply, sentiment: null, topics: [], urgency: null, summary: null, likelyChild: false, classifiedAt: null, classifierVersion: null,
          status: existing.status === "POSTING" ? existing.status : "NEW",
          // Re-alert a review that was edited down to 1 or 2 stars
          ...(r.rating <= 2 && existing.rating > 2 ? { alertedAt: null } : {}),
        },
      }),
      db.storeReviewReply.updateMany({ where: { reviewId: existing.id, status: { in: OPEN_REPLY } }, data: { status: "SUPERSEDED" } }),
    ]);
  } else if (existing && change === "reply_changed") {
    // Someone replied (or changed the reply) in Play Console / App Store Connect
    const status = r.reply && !["POSTING", "IGNORED"].includes(existing.status) ? "REPLIED" : existing.status;
    await db.storeReview.update({ where: { id: existing.id }, data: { ...reply, lastSyncedAt: now, status } });
  }
  return change;
}

/** Reads one store's reviews, if it's set up. `force` syncs now whatever the interval (console › Store reviews). */
export async function syncStore(store: Store, now = new Date(), opts: { force?: boolean; f?: Fetch } = {}) {
  const play = store === "GOOGLE_PLAY" ? googlePlayConfig() : null;
  const asc = store === "APP_STORE" ? appStoreConfig() : null;
  if (!play && !asc) return { skipped: "not_configured" as const };

  const state = await db.storeSyncState.upsert({ where: { store }, create: { store }, update: {} });
  if (!opts.force && !syncDue(state, now.getTime())) return { skipped: "not_due" as const };
  // Claimed from the state just read, so two runs don't both sync
  const claimed = await db.storeSyncState.updateMany({ where: { store, lastRunAt: state.lastRunAt }, data: { lastRunAt: now } });
  if (!claimed.count) return { skipped: "running" as const };

  const counts = { fetched: 0, new: 0, edited: 0, replyChanged: 0 };
  let newest = state.newestReviewAt;
  try {
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      let reviews: (NormalizedReview | null)[];
      let next: string | null;
      if (play) {
        const res = await listPlayReviews(play, { token: cursor }, opts.f);
        reviews = res.reviews.map(normalizePlayReview);
        next = res.nextToken;
      } else {
        const res = await listAscReviews(asc!, { next: cursor }, opts.f);
        reviews = res.reviews;
        next = res.next;
      }
      const ok = reviews.filter((r): r is NormalizedReview => !!r);
      for (const r of ok) {
        counts.fetched++;
        const c = await save(r, now);
        if (c === "new") counts.new++;
        else if (c === "edited") counts.edited++;
        else if (c === "reply_changed") counts.replyChanged++;
        if (!newest || r.reviewedAt > newest) newest = r.reviewedAt;
      }
      const oldest = ok.reduce<Date | null>((m, r) => (!m || r.reviewedAt < m ? r.reviewedAt : m), null);
      if (!next || (asc && shouldStopPaging(oldest, state.newestReviewAt))) break;
      cursor = next;
    }
    await db.storeSyncState.update({ where: { store }, data: { lastSuccessAt: new Date(), lastError: null, newestReviewAt: newest, fetched: counts.fetched } });
    return counts;
  } catch (e) {
    const msg = e instanceof ServiceError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : "failed";
    await db.storeSyncState.update({ where: { store }, data: { lastError: msg.slice(0, 300) } });
    throw e;
  }
}

const READ_SELECT = { id: true, store: true, rating: true, reviewTitle: true, text: true, language: true, textHash: true, storeReplyText: true, status: true } as const;

/**
 * Has AI read one review: its sentiment, topics and urgency, and a draft reply. `draft: "auto"` drafts only for a review
 * with no reply in the store yet (the sync); "always" drafts anyway (staff pressing Regenerate, perhaps to change a
 * reply already posted). Throws a ServiceError from the provider. False: the words changed while it was reading.
 */
export async function readReview(id: string, opts: { instruction?: string; draft?: "auto" | "always"; staffId?: string } = {}) {
  const r = await db.storeReview.findUnique({ where: { id }, select: READ_SELECT });
  if (!r) throw new ServiceError(404, "Review not found.", "not_found");
  if (r.status === "POSTING") throw new ServiceError(409, "This review's reply is being posted right now.", "conflict");
  const reading = await classifyAndDraft({ store: r.store as Store, rating: r.rating, reviewTitle: r.reviewTitle, text: r.text, language: r.language }, opts.instruction);
  const wantsDraft = opts.draft === "always" || (!r.storeReplyText && ["NEW", "FAILED", "DRAFTED"].includes(r.status));
  return db.$transaction(async (tx) => {
    // Only if the words didn't change while the AI was reading them
    const u = await tx.storeReview.updateMany({
      where: { id: r.id, textHash: r.textHash, status: { not: "POSTING" } },
      data: {
        sentiment: reading.sentiment, topics: reading.topics, urgency: reading.urgency, summary: reading.summary, likelyChild: reading.likelyChild,
        classifiedAt: new Date(), classifierVersion: CLASSIFIER_VERSION,
        ...(wantsDraft && ["NEW", "FAILED", "IGNORED"].includes(r.status) ? { status: "DRAFTED" } : {}),
      },
    });
    if (!u.count) return false;
    if (wantsDraft) {
      await tx.storeReviewReply.updateMany({ where: { reviewId: r.id, status: { in: ["DRAFT", "FAILED"] } }, data: { status: "SUPERSEDED" } });
      await tx.storeReviewReply.create({
        data: { reviewId: r.id, text: reading.reply, source: "AI", provider: reading.provider, forTextHash: r.textHash, trimmed: reading.trimmed, createdById: opts.staffId ?? null },
      });
    }
    return true;
  });
}

/** Has AI read new reviews, newest first. Stops early when the provider is busy or not set up. */
export async function classifyPending(limit = CLASSIFY_PER_RUN) {
  if (!aiAvailable()) return { classified: 0, skipped: "ai_not_configured" as const };
  const rows = await db.storeReview.findMany({
    where: { classifiedAt: null, status: { notIn: ["POSTING", "IGNORED"] } },
    orderBy: { reviewedAt: "desc" },
    take: limit,
    select: { id: true, textHash: true },
  });
  let classified = 0;
  for (const r of rows) {
    try {
      if (await readReview(r.id)) classified++;
    } catch (e) {
      const code = e instanceof ServiceError ? e.code : null;
      if (code === "unavailable" || code === "rate_limited") break;
      if (code === "refused") {
        // Don't ask again every run: staff can press Reclassify
        await db.storeReview.updateMany({ where: { id: r.id, textHash: r.textHash }, data: { classifiedAt: new Date(), classifierVersion: CLASSIFIER_VERSION } });
      } else {
        console.error("[store-reviews] reading a review failed", r.id, e);
      }
    }
  }
  return { classified };
}

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

/** One email per run to the team about new 1- and 2-star reviews nobody has answered yet */
export async function alertLowRatings(now = new Date()) {
  const rows = await db.storeReview.findMany({
    where: { rating: { lte: 2 }, alertedAt: null, storeReplyText: null, reviewedAt: { gte: new Date(now.getTime() - ALERT_WINDOW_MS) } },
    orderBy: { reviewedAt: "desc" },
    take: 50,
    select: { id: true, store: true, rating: true, reviewTitle: true, text: true, summary: true },
  });
  const claimed: typeof rows = [];
  for (const r of rows) {
    if ((await db.storeReview.updateMany({ where: { id: r.id, alertedAt: null }, data: { alertedAt: now } })).count) claimed.push(r);
  }
  if (!claimed.length) return { alerted: 0 };
  const to = process.env.REVIEWS_ALERT_EMAIL?.trim() || supportEmail();
  const base = consoleBase();
  const line = (r: (typeof rows)[number]) => `${stars(r.rating)} ${STORE_LABEL[r.store as Store]}: ${r.reviewTitle ? `${r.reviewTitle} — ` : ""}${r.text.slice(0, 280)}`;
  const subject = claimed.length === 1 ? `New ${claimed[0].rating}-star review on ${STORE_LABEL[claimed[0].store as Store]}` : `${claimed.length} new low-rated store reviews`;
  try {
    await sendMail({
      to,
      subject,
      text: `${claimed.map((r) => `${line(r)}\n${base}/reviews/${r.id}`).join("\n\n")}\n\nDraft replies are waiting in the console: ${base}/reviews?status=DRAFTED`,
      html: `${claimed.map((r) => `<p>${escapeHtml(line(r))}<br><a href="${base}/reviews/${r.id}">Open in the console</a></p>`).join("")}<p><a href="${base}/reviews?status=DRAFTED">All drafts waiting for review</a></p>`,
    });
  } catch (e) {
    // Let the next run try again
    await db.storeReview.updateMany({ where: { id: { in: claimed.map((r) => r.id) } }, data: { alertedAt: null } });
    throw e;
  }
  return { alerted: claimed.length };
}

/** Links in the alert email open the console: its own host (lib/console-host), console.localhost in development */
function consoleBase() {
  const host = process.env.CONSOLE_HOST?.trim();
  if (host) return `https://${host}`;
  return process.env.NODE_ENV === "production" ? `https://${CONSOLE_HOST}` : "http://console.localhost:3000";
}

/** The maintenance step: each store that's set up and due, then AI reading, then the alert email */
export async function syncStoreReviews(now = new Date()) {
  const result: Record<string, unknown> = {};
  const failed: string[] = [];
  for (const store of ["GOOGLE_PLAY", "APP_STORE"] as const) {
    try {
      result[store] = await syncStore(store, now);
    } catch (e) {
      failed.push(store);
      console.error(`[store-reviews] ${store} sync failed`, e);
    }
  }
  result.ai = await classifyPending();
  result.alerts = await alertLowRatings(now);
  if (failed.length) throw new Error(`Store review sync failed: ${failed.join(", ")}`);
  return result;
}
