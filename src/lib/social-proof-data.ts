import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import { invalid } from "./errors";
import { proof, type PlayRating } from "./social-proof";
import { PROOF_TAG, publishedQuotes } from "./testimonials";

/** SiteStat key of the Google Play rating */
export const PLAY_RATING_KEY = "play_rating";

/** The stored Play rating, or null when none is (or it's malformed) */
export async function playRating(): Promise<PlayRating | null> {
  const row = await db.siteStat.findUnique({ where: { key: PLAY_RATING_KEY } });
  const v = row?.value as { stars?: unknown; reviews?: unknown } | undefined;
  if (!row || typeof v?.stars !== "number" || typeof v?.reviews !== "number") return null;
  return { stars: v.stars, reviews: v.reviews, checkedOn: row.checkedOn.toISOString().slice(0, 10) };
}

/**
 * The landing page's proof band (lib/social-proof proof()), cached for everyone and refreshed hourly; console ›
 * Social proof and a parent withdrawing expire it at once (PROOF_TAG). If the database can't be read (a build without
 * one), the empty result is cached only briefly, so it's read again at request time rather than kept for hours.
 */
export async function loadProof() {
  "use cache";
  cacheTag(PROOF_TAG);
  try {
    const [rating, quotes] = await Promise.all([playRating(), publishedQuotes()]);
    cacheLife("hours");
    return proof({ playRating: rating, testimonials: quotes });
  } catch (e) {
    console.error("[social-proof] reading proof failed", e instanceof Error ? e.message : e);
    cacheLife("seconds");
    return proof();
  }
}

/** Saves the Play rating as read in the Play Console (console › Social proof) */
export async function savePlayRating(input: { stars: number; reviews: number; checkedOn: string }, staffId: string) {
  const stars = Math.round(input.stars * 10) / 10;
  const reviews = Math.round(input.reviews);
  if (!(stars >= 1 && stars <= 5)) throw invalid("Stars go from 1.0 to 5.0, as the Play Console shows them.");
  if (!(reviews >= 0 && reviews < 10_000_000)) throw invalid("Enter how many ratings the Play Console counts.");
  const checkedOn = new Date(`${input.checkedOn}T00:00:00Z`);
  if (Number.isNaN(checkedOn.getTime()) || checkedOn.getTime() > Date.now() + 864e5) throw invalid("Enter the day you checked, today or earlier.");
  await db.siteStat.upsert({
    where: { key: PLAY_RATING_KEY },
    create: { key: PLAY_RATING_KEY, value: { stars, reviews }, checkedOn, updatedById: staffId },
    update: { value: { stars, reviews }, checkedOn, updatedById: staffId },
  });
}

/** What eGuard's own copy of Play reviews says (lib/store-reviews), to sanity-check the number typed in */
export async function ingestedPlayStats() {
  const r = await db.storeReview.aggregate({ where: { store: "GOOGLE_PLAY" }, _avg: { rating: true }, _count: true });
  return { avg: r._avg.rating, n: r._count };
}
