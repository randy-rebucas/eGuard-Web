import { API, accessToken, reach, unreachable, type GooglePlayConfig } from "../google-play";
import { ServiceError } from "../errors";
import type { NormalizedReview } from "./types";

/**
 * Google Play reviews through the Play Developer API (reviews.list, reviews.reply), with the same service account as
 * Play Billing (lib/google-play). In Play Console, that account also needs "Reply to reviews".
 *
 * What the API gives: only reviews with written text, and only those created or edited in about the last week. So the
 * sync runs every few hours (REVIEW_SYNC_HOURS) and keeps everything it saw; star-only ratings never arrive.
 */

type Fetch = typeof fetch;
type Stamp = { seconds?: string | number; nanos?: number };

export type PlayReview = {
  reviewId: string;
  authorName?: string;
  comments?: {
    userComment?: {
      text?: string;
      lastModified?: Stamp;
      starRating?: number;
      reviewerLanguage?: string;
      device?: string;
      androidOsVersion?: number;
      appVersionName?: string;
    };
    developerComment?: { text?: string; lastModified?: Stamp };
  }[];
};

type ListResponse = { reviews?: PlayReview[]; tokenPagination?: { nextPageToken?: string } };

const at = (s: Stamp | undefined) => (s?.seconds != null ? new Date(Number(s.seconds) * 1000 + Math.floor((s.nanos ?? 0) / 1e6)) : null);

/**
 * The fields eGuard keeps, or null for a review without the parts every review has (an id, stars, a date). Play puts a
 * review's title before its text, separated by a tab.
 */
export function normalizePlayReview(raw: PlayReview): NormalizedReview | null {
  const user = raw.comments?.find((c) => c.userComment)?.userComment;
  const dev = raw.comments?.find((c) => c.developerComment)?.developerComment;
  const reviewedAt = at(user?.lastModified);
  const rating = user?.starRating;
  if (!raw.reviewId || !user || !reviewedAt || !rating || rating < 1 || rating > 5) return null;
  const full = (user.text ?? "").trim();
  const tab = full.indexOf("\t");
  const reviewTitle = tab > 0 ? full.slice(0, tab).trim() || null : null;
  const text = (tab > 0 ? full.slice(tab + 1) : full).trim();
  const os = user.androidOsVersion ? `Android API ${user.androidOsVersion}` : null;
  return {
    store: "GOOGLE_PLAY",
    externalId: raw.reviewId,
    rating,
    reviewTitle,
    text,
    authorName: raw.authorName?.trim() || null,
    language: user.reviewerLanguage ?? null,
    territory: null,
    appVersion: user.appVersionName ?? null,
    device: [user.device, os].filter(Boolean).join(" · ") || null,
    reviewedAt,
    reply: dev?.text?.trim() ? { text: dev.text.trim(), at: at(dev.lastModified), id: null } : null,
  };
}

/** One page of recent reviews, and the token for the next (null on the last page) */
export async function listPlayReviews(cfg: GooglePlayConfig, page: { token?: string | null } = {}, f: Fetch = fetch) {
  const token = await accessToken(cfg.account, f);
  const qs = new URLSearchParams({ maxResults: "100" });
  if (page.token) qs.set("token", page.token);
  const res = await reach(f, `${API}/${encodeURIComponent(cfg.packageName)}/reviews?${qs}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) throw new ServiceError(503, "Google Play refused the service account: give it \"Reply to reviews\" in Play Console.", "store_forbidden");
  if (!res.ok) throw unreachable();
  const body = (await res.json().catch(() => { throw unreachable(); })) as ListResponse;
  return { reviews: body.reviews ?? [], nextToken: body.tokenPagination?.nextPageToken || null };
}

/** Posts (or replaces) the developer reply. Play shows at most 350 characters. */
export async function replyPlayReview(cfg: GooglePlayConfig, reviewId: string, text: string, f: Fetch = fetch) {
  const token = await accessToken(cfg.account, f);
  const res = await reach(f, `${API}/${encodeURIComponent(cfg.packageName)}/reviews/${encodeURIComponent(reviewId)}:reply`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ replyText: text }),
  });
  if (res.status === 401 || res.status === 403) throw new ServiceError(503, "Google Play refused the reply: give the service account \"Reply to reviews\" in Play Console.", "store_forbidden");
  if (res.status === 400) throw new ServiceError(400, "Google Play didn't accept this reply (too long, or the review is gone).", "store_rejected");
  if (!res.ok) throw unreachable();
  return { id: null as string | null, at: new Date() };
}
