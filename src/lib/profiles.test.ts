import { describe, expect, it } from "vitest";
import { PROFILES, profileConfig, profileConfigs, recommendedProfile } from "./profiles";
import { PROTECTIONS, defaultConfig, isConfigured } from "./protections";
import { planFeatures } from "./plans";
import { HELP_ARTICLES, searchHelp } from "./help";
import { distanceM } from "./location";

describe("protection profiles", () => {
  it("offers Balanced, Protected and Custom", () => {
    expect(PROFILES.map((p) => p.id)).toEqual(["BALANCED", "PROTECTED", "CUSTOM"]);
  });

  it("recommends Protected for younger children and Balanced for teens", () => {
    expect(recommendedProfile(9)).toBe("PROTECTED");
    expect(recommendedProfile(12)).toBe("PROTECTED");
    expect(recommendedProfile(13)).toBe("BALANCED");
  });

  it("Protected matches the design's recommended setup for a 12 year old", () => {
    const cfgs = profileConfigs("PROTECTED", 12);
    expect(cfgs.find((c) => c.key === "SCREEN_TIME")).toMatchObject({ dailyMinutes: 180 });
    expect(cfgs.find((c) => c.key === "BEDTIME")).toMatchObject({ enabled: true, start: "21:30", end: "06:00" });
    expect(cfgs.find((c) => c.key === "DOWNLOADS")).toMatchObject({ requireApproval: true });
    expect(cfgs.find((c) => c.key === "LOCATION")).toMatchObject({ sharing: true });
  });

  it("Custom starts from the same values as Protected", () => {
    expect(profileConfigs("CUSTOM", 10)).toEqual(profileConfigs("PROTECTED", 10));
  });

  it("Balanced loosens limits, bedtime and age ratings", () => {
    const p = (k: Parameters<typeof profileConfig>[1]) => profileConfig("BALANCED", k, 12);
    expect(p("SCREEN_TIME")).toMatchObject({ dailyMinutes: 240, weekendMinutes: 300 });
    expect(p("BEDTIME")).toMatchObject({ start: "22:30", end: "06:00" });
    expect(p("APP_RESTRICTIONS")).toMatchObject({ maxAgeRating: 13 });
    expect(p("CONTENT")).toMatchObject({ maxAgeRating: 13 });
    expect(p("UNINSTALL_PROTECTION")).toEqual(defaultConfig("UNINSTALL_PROTECTION", 12));
  });

  it("wraps bedtime past midnight and caps ratings at 18", () => {
    expect(profileConfig("BALANCED", "BEDTIME", 17)).toMatchObject({ start: "23:00" });
    expect(profileConfig("BALANCED", "CONTENT", 17)).toMatchObject({ maxAgeRating: 16 });
  });

  it("never lowers the health score: every profile keeps all 10 protections on", () => {
    for (const p of PROFILES) for (const age of [5, 10, 12, 15, 17]) {
      const cfgs = profileConfigs(p.id, age);
      expect(cfgs.map((c) => c.key)).toEqual(PROTECTIONS.map((x) => x.key));
      expect(cfgs.every(isConfigured)).toBe(true);
    }
  });
});

describe("plans", () => {
  it("labels the device limit from the family's plan", () => {
    const f = planFeatures("eGuard Plus", 5);
    expect(f.find((x) => x.key === "devices")?.label).toBe("Up to 5 devices");
    expect(f.find((x) => x.key === "priority_support")?.included).toBe(false);
  });
});

describe("help search", () => {
  it("returns everything for an empty query and filters by category", () => {
    expect(searchHelp("")).toHaveLength(HELP_ARTICLES.length);
    expect(searchHelp("", "PRIVACY").every((a) => a.category === "PRIVACY")).toBe(true);
  });
  it("matches every term, case-insensitively", () => {
    expect(searchHelp("OFFLINE device").map((a) => a.slug)).toContain("device-offline");
    expect(searchHelp("zzzz")).toEqual([]);
  });
});

describe("distanceM", () => {
  it("is zero for the same point and about 111 km per degree of latitude", () => {
    expect(distanceM({ lat: 14.65, lng: 121.05 }, { lat: 14.65, lng: 121.05 })).toBe(0);
    expect(Math.round(distanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) / 1000)).toBe(111);
  });
});
