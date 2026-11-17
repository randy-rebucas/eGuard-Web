import { describe, expect, it } from "vitest";
import { MAX_RATING_AGE_DAYS, MIN_PLAY_REVIEWS, proof } from "../social-proof";

/** The site shows proof only when it's real: nothing by default, no thin ratings, no quotes without consent. */
describe("proof", () => {
  it("shows nothing until something real is added", () => {
    expect(proof({ playRating: null, testimonials: [], press: [] })).toEqual({ rating: null, quotes: [], press: [], any: false });
  });

  const now = Date.parse("2026-11-01T00:00:00Z");

  it("hides a rating with too few reviews behind it", () => {
    const thin = { stars: 5, reviews: MIN_PLAY_REVIEWS - 1, checkedOn: "2026-10-17" };
    expect(proof({ playRating: thin, testimonials: [], press: [], now }).any).toBe(false);
    expect(proof({ playRating: { ...thin, reviews: MIN_PLAY_REVIEWS }, testimonials: [], press: [], now }).rating).toMatchObject({ stars: 5 });
  });

  it("hides a rating nobody has checked in a while", () => {
    const r = { stars: 4.6, reviews: 120, checkedOn: "2026-10-17" };
    const later = (days: number) => Date.parse("2026-10-17T00:00:00Z") + days * 864e5;
    expect(proof({ playRating: r, press: [], now: later(MAX_RATING_AGE_DAYS) }).rating).toEqual(r);
    expect(proof({ playRating: r, press: [], now: later(MAX_RATING_AGE_DAYS + 1) }).rating).toBeNull();
    expect(proof({ playRating: { ...r, checkedOn: "soon" }, press: [], now }).rating).toBeNull();
  });

  it("drops a quote without a consent date or a name", () => {
    const ok = { quote: "Bedtime finally holds.", name: "Maria, Tacloban", consentedOn: "2026-10-17" };
    const r = proof({ playRating: null, press: [], testimonials: [ok, { ...ok, consentedOn: "" }, { ...ok, name: " " }] });
    expect(r.quotes).toEqual([ok]);
    expect(r.any).toBe(true);
  });
});
