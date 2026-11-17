/**
 * Proof on the public site, and only proof that's real. Every list starts empty, and the landing page's proof band
 * (ProofBand in app/page.tsx) shows nothing until there is something true to show. Rules:
 * - A testimonial is a parent's own words, with their written consent to be quoted, under the name they agreed to
 *   (first name and town, or a description like "Parent of two, Cebu"). Consent is collected and kept by
 *   lib/testimonials; console › Social proof publishes. Never edit the meaning of a quote: any edit needs consent again.
 * - The Google Play rating is copied from the Play Console into console › Social proof with the date it was checked,
 *   and only shown once there are MIN_PLAY_REVIEWS reviews and while it's under MAX_RATING_AGE_DAYS old.
 * - It's never put in structured data (JSON-LD): Google only accepts ratings collected on the site itself.
 * - Press: only coverage that actually ran, linked to the article.
 * How to add each one: docs/marketing-site-review.md › Social proof. What the site reads: lib/social-proof-data.
 */

export type Testimonial = {
  quote: string;
  /** As the parent agreed to be named: "Maria, Tacloban" or "Parent of two, Cebu" */
  name: string;
  /** YYYY-MM-DD: when they agreed, in writing, to be quoted on the site */
  consentedOn: string;
};

export type PlayRating = { stars: number; reviews: number; checkedOn: string };

/** Shown once this many reviews back it up: a 5.0 from three reviews says nothing */
export const MIN_PLAY_REVIEWS = 20;

/** A rating checked longer ago than this is hidden until someone checks it again (console › Social proof warns at 30) */
export const MAX_RATING_AGE_DAYS = 45;
export const RATING_STALE_WARN_DAYS = 30;

export type PressMention = { outlet: string; title: string; url: string; date: string };

export const PRESS: PressMention[] = [];

/** True facts that need no third party: who makes eGuard and where (lib/legal) */
export const MADE_IN = "Baybay City, Leyte";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Days since a YYYY-MM-DD date, or Infinity when it isn't one */
export const daysSince = (date: string, now = Date.now()) => (DATE.test(date) ? (now - Date.parse(`${date}T00:00:00Z`)) / 864e5 : Infinity);

/** What the proof band can show right now; nothing at all until something is real */
export function proof({ playRating = null, testimonials = [], press = PRESS, now = Date.now() }: {
  playRating?: PlayRating | null; testimonials?: Testimonial[]; press?: PressMention[]; now?: number;
} = {}) {
  const rating = playRating && playRating.reviews >= MIN_PLAY_REVIEWS && playRating.stars >= 1 && playRating.stars <= 5
    && daysSince(playRating.checkedOn, now) <= MAX_RATING_AGE_DAYS ? playRating : null;
  // A quote without a consent date isn't shown, whatever else it has
  const quotes = testimonials.filter((t) => t.quote.trim() && t.name.trim() && DATE.test(t.consentedOn));
  return { rating, quotes, press, any: !!rating || quotes.length > 0 || press.length > 0 };
}
