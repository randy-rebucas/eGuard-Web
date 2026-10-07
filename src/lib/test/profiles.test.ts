import { describe, expect, it } from "vitest";
import { PROFILES, ageReview, profileConfig, profileConfigs, recommendedProfile } from "../profiles";
import { PROTECTIONS, defaultConfig, isConfigured } from "../protections";
import { entitlementsFor, nextPlan, planByProduct, planFeatures } from "../plans";
import { HELP_ARTICLES, searchHelp } from "../help";
import { distanceM } from "../location";

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

  describe("ageReview", () => {
    const settings = (age: number) => profileConfigs("PROTECTED", age).map((config) => ({ key: config.key, config }));
    it("is empty when the recommendation doesn't change with the new age", () => {
      expect(ageReview(9, 10, settings(9))).toEqual([]);
    });
    it("names what eGuard recommends differently at the new age", () => {
      // Under 11 → 11: the weekday limit goes from 2h to 3h; ratings and bedtime stay
      expect(ageReview(10, 11, settings(10))).toEqual(["Screen Time"]);
    });
    it("skips settings the parent already has at the new recommendation", () => {
      expect(ageReview(10, 11, settings(11))).toEqual([]);
    });
    it("turning 13 moves to Balanced: limits, bedtime and ratings", () => {
      expect(ageReview(12, 13, settings(12))).toEqual(["Screen Time", "Bedtime", "App Restrictions", "Content Restrictions"]);
    });
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
  it("lists what each plan includes, as the pricing page does", () => {
    expect(planFeatures("Free").map((f) => f.label)).toEqual(["Up to 1 child", "Basic protection setup", "Screen time management", "App monitoring (limited)", "Email support"]);
    expect(planFeatures("eGuard Plus")[0].label).toBe("Up to 5 children");
    expect(planFeatures("Family Pro").map((f) => f.label)).toContain("API access (schools/organizations)");
  });

  it("gates features by plan, and unknown or retired plans get Free", () => {
    expect(entitlementsFor("Free")).toMatchObject({ childLimit: 1, locationSharing: false, appMonitoringLimit: 5, realtimeAlerts: false, advancedReports: false });
    expect(entitlementsFor("eGuard Plus")).toMatchObject({ childLimit: 5, locationSharing: true, appMonitoringLimit: null, realtimeAlerts: true, advancedReports: false, apiAccess: false, categoryLimits: true });
    expect(entitlementsFor("Family Pro")).toMatchObject({ childLimit: 10, advancedReports: true, apiAccess: true });
    expect(entitlementsFor("eGuard Family").childLimit).toBe(1);
  });

  it("maps store products to plans, keeping the retired eGuard Family products as Family Pro", () => {
    expect(planByProduct("plus_monthly")?.name).toBe("eGuard Plus");
    expect(planByProduct("pro_pass_month")?.name).toBe("Family Pro");
    expect(planByProduct("family_yearly")?.name).toBe("Family Pro");
    expect(planByProduct("eguard_family")?.name).toBe("Family Pro");
    expect(planByProduct("eguard_plus")?.name).toBe("eGuard Plus");
    expect(planByProduct("nope")).toBeNull();
    expect(nextPlan("Free")?.name).toBe("eGuard Plus");
    expect(nextPlan("Family Pro")).toBeNull();
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
