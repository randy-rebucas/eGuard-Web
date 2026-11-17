import { createHash } from "node:crypto";

/** The stores eGuard's apps are reviewed in */
export const STORES = ["GOOGLE_PLAY", "APP_STORE"] as const;
export type Store = (typeof STORES)[number];
export const STORE_LABEL: Record<Store, string> = { GOOGLE_PLAY: "Google Play", APP_STORE: "App Store" };
export const isStore = (v: unknown): v is Store => typeof v === "string" && (STORES as readonly string[]).includes(v);

/**
 * Longest public reply each store takes. Play's is 350 characters; App Store Connect's limit is far longer (about
 * 5,970), but a reply should still read as a short note.
 */
export const REPLY_MAX: Record<Store, number> = { GOOGLE_PLAY: 350, APP_STORE: 5970 };

/** A review as both stores' APIs are turned into, before it's saved */
export type NormalizedReview = {
  store: Store;
  externalId: string;
  rating: number;
  reviewTitle: string | null;
  text: string;
  authorName: string | null;
  language: string | null;
  territory: string | null;
  appVersion: string | null;
  device: string | null;
  reviewedAt: Date;
  /** The developer reply the store shows now, if any */
  reply: { text: string; at: Date | null; id: string | null } | null;
};

/** Changes when the reviewer edits the stars, title or words: a reply drafted before that answers something else */
export const reviewTextHash = (r: Pick<NormalizedReview, "rating" | "reviewTitle" | "text">) =>
  createHash("sha256").update(`${r.rating}\n${r.reviewTitle ?? ""}\n${r.text}`).digest("hex");

/** How AI sorts a review (lib/review-ai); bump CLASSIFIER_VERSION there when these change */
export const TOPICS = [
  "SETUP", "PAIRING", "BLOCKING", "SCREEN_TIME", "LOCATION", "BILLING", "BUGS", "PERFORMANCE", "PRIVACY", "SUPPORT", "CHILD_BYPASS", "PRAISE", "OTHER",
] as const;
export type Topic = (typeof TOPICS)[number];
export const SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE"] as const;
export const URGENCIES = ["LOW", "NORMAL", "HIGH"] as const;

/**
 * How long store review history is kept (lib/maintenance purgeExpiredData). Reviews are public words, kept two years
 * for trends; a reply draft replaced by a newer one is only kept 90 days.
 */
export const STORE_REVIEW_RETENTION_DAYS = { reviews: 730, supersededReplies: 90 } as const;
