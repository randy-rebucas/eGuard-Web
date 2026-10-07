import { describe, expect, it } from "vitest";
import { APP_CATEGORIES, CATEGORY_UPGRADE, categoryOf, guessCategory, recommendedGamingMinutes } from "../app-categories";

describe("guessCategory", () => {
  it("knows common apps, whatever their spelling", () => {
    expect(guessCategory("Roblox")).toBe("GAMES");
    expect(guessCategory("Mobile Legends: Bang Bang")).toBe("GAMES");
    expect(guessCategory("TikTok")).toBe("SOCIAL");
    expect(guessCategory("YouTube Kids")).toBe("VIDEO");
    expect(guessCategory("Messenger Kids")).toBe("MESSAGING");
    expect(guessCategory("Khan Academy")).toBe("EDUCATION");
    expect(guessCategory("Google Chrome")).toBe("BROWSERS");
  });
  it("reads a name that says it's a game, and leaves the rest as Other", () => {
    expect(guessCategory("Word Games Deluxe")).toBe("GAMES");
    expect(guessCategory("Gamestop")).toBe("OTHER");
    expect(guessCategory("Calculator")).toBe("OTHER");
  });
});

describe("categoryOf", () => {
  it("is the parent's choice when there is one, eGuard's guess otherwise", () => {
    expect(categoryOf({ name: "Roblox", category: null })).toEqual({ category: "GAMES", auto: true });
    expect(categoryOf({ name: "Roblox", category: "EDUCATION" })).toEqual({ category: "EDUCATION", auto: false });
  });
});

it("labels every category, names the plan with limits, and suggests more gaming time for Balanced", () => {
  expect(APP_CATEGORIES.map((c) => c.key)).toContain("OTHER");
  expect(CATEGORY_UPGRADE).toContain("eGuard Plus");
  expect([recommendedGamingMinutes("PROTECTED"), recommendedGamingMinutes("BALANCED"), recommendedGamingMinutes("CUSTOM")]).toEqual([60, 90, 60]);
});
