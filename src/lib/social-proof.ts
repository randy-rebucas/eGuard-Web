/**
 * Proof on the public site, and only proof that's real. Every list starts empty, and the landing page's proof band
 * (ProofBand in app/page.tsx) shows nothing until there is something true to show. Rules:
 * - A testimonial is a parent's own words, with their written consent to be quoted, under the name they agreed to
 *   (first name and town, or a description like "Parent of two, Cebu"). Keep the email that gave consent. Never
 *   edit the meaning of a quote; trimming for length is fine if they approved the result.
 * - The Google Play rating is copied from the Play Console with the date it was checked, and only shown once there
 *   are MIN_PLAY_REVIEWS reviews. Update it at least monthly, or set it back to null.
 * - It's never put in structured data (JSON-LD): Google only accepts ratings collected on the site itself.
 * - Press: only coverage that actually ran, linked to the article.
 * How to add each one: docs/marketing-site-review.md › Social proof.
 */

export type Testimonial = {
  quote: string;
  /** As the parent agreed to be named: "Maria, Tacloban" or "Parent of two, Cebu" */
  name: string;
  /** YYYY-MM-DD: when they agreed, in writing, to be quoted on the site */
  consentedOn: string;
};

export const TESTIMONIALS: Testimonial[] = [];

/** Shown once this many reviews back it up: a 5.0 from three reviews says nothing */
export const MIN_PLAY_REVIEWS = 20;

/** From the Play Console (Ratings and reviews), or null */
export const PLAY_RATING: { stars: number; reviews: number; checkedOn: string } | null = null;

export type PressMention = { outlet: string; title: string; url: string; date: string };

export const PRESS: PressMention[] = [];

/** True facts that need no third party: who makes eGuard and where (lib/legal) */
export const MADE_IN = "Baybay City, Leyte";

/** What the proof band can show right now; nothing at all until something is real */
export function proof({ playRating = PLAY_RATING, testimonials = TESTIMONIALS, press = PRESS } = {}) {
  const rating = playRating && playRating.reviews >= MIN_PLAY_REVIEWS ? playRating : null;
  // A quote without a consent date isn't shown, whatever else it has
  const quotes = testimonials.filter((t) => t.quote.trim() && t.name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(t.consentedOn));
  return { rating, quotes, press, any: !!rating || quotes.length > 0 || press.length > 0 };
}
