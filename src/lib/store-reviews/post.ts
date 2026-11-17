import "server-only";
import { db } from "../db";
import { googlePlayConfig } from "../google-play";
import { ServiceError, conflict, invalid, notFound } from "../errors";
import { logStaff } from "../staff-auth";
import { replyPlayReview } from "./play";
import { appStoreConfig, respondAscReview } from "./app-store";
import { REPLY_MAX, STORE_LABEL, type Store } from "./types";

/**
 * Posting a reply staff approved (console › Store reviews). The steps are claimed one state at a time, so a double
 * click or two staff members post once, and a reply is never posted under a review whose words changed after it was
 * written (StoreReviewReply.forTextHash).
 */

export type ReplyPoster = (store: Store, externalId: string, text: string) => Promise<{ id: string | null; at: Date }>;

/** The real stores, through the credentials the sync uses */
export const storePoster: ReplyPoster = async (store, externalId, text) => {
  if (store === "GOOGLE_PLAY") {
    const cfg = googlePlayConfig();
    if (!cfg) throw new ServiceError(503, "Google Play isn't set up on this server (GOOGLE_PLAY_*).", "not_configured");
    return replyPlayReview(cfg, externalId, text);
  }
  const cfg = appStoreConfig();
  if (!cfg) throw new ServiceError(503, "App Store Connect isn't set up on this server (APP_STORE_CONNECT_*).", "not_configured");
  return respondAscReview(cfg, externalId, text);
};

/** Problems with a reply's text, for staff, or null when it can be posted */
export function replyProblem(store: Store, text: string) {
  const t = text.trim();
  if (!t) return "Write a reply first.";
  if (t.length > REPLY_MAX[store]) return `${STORE_LABEL[store]} takes at most ${REPLY_MAX[store]} characters: this one has ${t.length}.`;
  return null;
}

/** Saves staff's edits to the open draft (or starts one), without posting it */
export async function saveDraft(reviewId: string, text: string, staffId: string) {
  const review = await db.storeReview.findUnique({ where: { id: reviewId }, select: { id: true, textHash: true, status: true } });
  if (!review) throw notFound("Review");
  if (review.status === "POSTING") throw conflict("This review's reply is being posted right now.");
  const t = text.trim().replace(/\r\n/g, "\n");
  if (!t) throw invalid("Write a reply first.");
  const open = await db.storeReviewReply.findFirst({
    where: { reviewId, status: { in: ["DRAFT", "FAILED"] }, forTextHash: review.textHash },
    orderBy: { createdAt: "desc" },
  });
  const reply = open
    ? await db.storeReviewReply.update({ where: { id: open.id }, data: { text: t, status: "DRAFT", postError: null, ...(open.text !== t ? { source: "STAFF", trimmed: false, createdById: staffId } : {}) } })
    : await db.storeReviewReply.create({ data: { reviewId, text: t, source: "STAFF", forTextHash: review.textHash, createdById: staffId } });
  if (["NEW", "FAILED"].includes(review.status)) await db.storeReview.update({ where: { id: reviewId }, data: { status: "DRAFTED" } });
  return reply;
}

/**
 * Approves the text staff sent and posts it to the store. On a store error the reply and review are FAILED with the
 * reason, and staff can try again.
 */
export async function approveAndPost(reviewId: string, text: string, staffId: string, post: ReplyPoster = storePoster) {
  const review = await db.storeReview.findUnique({ where: { id: reviewId }, select: { id: true, store: true, externalId: true, textHash: true, status: true } });
  if (!review) throw notFound("Review");
  const store = review.store as Store;
  const problem = replyProblem(store, text);
  if (problem) throw invalid(problem);
  if (review.status === "POSTING") throw conflict("This reply is being posted already.");

  const draft = await saveDraft(reviewId, text, staffId);
  // Claim the draft, then the review, each from the state it must be in
  const approved = await db.storeReviewReply.updateMany({
    where: { id: draft.id, status: "DRAFT", forTextHash: review.textHash },
    data: { status: "APPROVED", approvedById: staffId, approvedAt: new Date() },
  });
  if (!approved.count) throw conflict("This reply was approved already.");
  const posting = await db.storeReview.updateMany({
    where: { id: reviewId, textHash: draft.forTextHash, status: { not: "POSTING" } },
    data: { status: "POSTING" },
  });
  if (!posting.count) {
    await db.storeReviewReply.update({ where: { id: draft.id }, data: { status: "SUPERSEDED" } });
    throw conflict("The reviewer changed their review, or it's being answered already. Reload and check the reply still fits.");
  }
  await db.storeReviewReply.update({ where: { id: draft.id }, data: { status: "POSTING" } });

  try {
    const res = await post(store, review.externalId, draft.text);
    await db.$transaction([
      db.storeReviewReply.update({ where: { id: draft.id }, data: { status: "POSTED", postedAt: res.at, postError: null } }),
      db.storeReview.update({
        where: { id: reviewId },
        data: { status: "REPLIED", storeReplyText: draft.text, storeReplyAt: res.at, ...(res.id ? { storeReplyId: res.id } : {}) },
      }),
    ]);
    await logStaff(staffId, "review.reply.post", `review:${reviewId}`, `${STORE_LABEL[store]}, ${draft.text.length} chars`);
    return { posted: true as const };
  } catch (e) {
    const msg = (e instanceof ServiceError ? e.message : "The store couldn't be reached.").slice(0, 300);
    await db.$transaction([
      db.storeReviewReply.update({ where: { id: draft.id }, data: { status: "FAILED", postError: msg } }),
      db.storeReview.update({ where: { id: reviewId }, data: { status: "FAILED" } }),
    ]);
    await logStaff(staffId, "review.reply.fail", `review:${reviewId}`, msg);
    throw e instanceof ServiceError ? e : new ServiceError(502, msg, "store_unavailable");
  }
}
