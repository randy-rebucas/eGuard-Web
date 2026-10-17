import { describe, expect, it } from "vitest";
import { MIN_PLAY_REVIEWS, proof } from "../social-proof";

/** The site shows proof only when it's real: nothing by default, no thin ratings, no quotes without consent. */
describe("proof", () => {
  it("shows nothing until something real is added", () => {
    expect(proof({ playRating: null, testimonials: [], press: [] })).toEqual({ rating: null, quotes: [], press: [], any: false });
  });

  it("hides a rating with too few reviews behind it", () => {
    const thin = { stars: 5, reviews: MIN_PLAY_REVIEWS - 1, checkedOn: "2026-10-17" };
    expect(proof({ playRating: thin, testimonials: [], press: [] }).any).toBe(false);
    expect(proof({ playRating: { ...thin, reviews: MIN_PLAY_REVIEWS }, testimonials: [], press: [] }).rating).toMatchObject({ stars: 5 });
  });

  it("drops a quote without a consent date or a name", () => {
    const ok = { quote: "Bedtime finally holds.", name: "Maria, Tacloban", consentedOn: "2026-10-17" };
    const r = proof({ playRating: null, press: [], testimonials: [ok, { ...ok, consentedOn: "" }, { ...ok, name: " " }] });
    expect(r.quotes).toEqual([ok]);
    expect(r.any).toBe(true);
  });
});
