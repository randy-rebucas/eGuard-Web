import { describe, expect, it } from "vitest";
import { PROFILES, ageReview, profileConfig, profileConfigs, recommendedProfile } from "../profiles";
import { PROTECTIONS, defaultConfig, isConfigured } from "../protections";
import { entitlementsFor, familyFeatures, limitsFor, nextPlan, planByName, planByProduct, planFeatures } from "../plans";
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
    expect(planFeatures("Free").map((f) => f.label)).toEqual(["Up to 1 child and 1 device", "Setup wizard and protection profiles", "Basic Configuration Health", "Run a check any time", "Screen time and per-app limits", "Alerts if eGuard is removed or tampered with", "Email support"]);
    expect(planFeatures("eGuard Plus")[0].label).toBe("Up to 3 children and 5 devices");
    expect(planFeatures("eGuard Family")[0].label).toBe("Up to 6 children and 12 devices");
    expect(planFeatures("eGuard Family").map((f) => f.label)).toContain("API access (schools/organizations)");
  });

  it("gates features by plan, and unknown or retired plans get Free", () => {
    expect(entitlementsFor("Free")).toMatchObject({ childLimit: 1, deviceLimit: 1, locationSharing: false, appMonitoringLimit: 5, realtimeAlerts: false, advancedReports: false, driftAlerts: false });
    expect(entitlementsFor("eGuard Plus")).toMatchObject({ childLimit: 3, deviceLimit: 5, locationSharing: true, appMonitoringLimit: null, realtimeAlerts: true, advancedReports: false, apiAccess: false, categoryLimits: true, driftAlerts: true });
    expect(entitlementsFor("eGuard Family")).toMatchObject({ childLimit: 6, deviceLimit: 12, advancedReports: true, apiAccess: true, driftAlerts: true });
    expect(entitlementsFor("Gold").childLimit).toBe(1);
  });

  it("still reads the plan's old name, Family Pro", () => {
    expect(planByName("Family Pro").id).toBe("PRO");
    expect(entitlementsFor("Family Pro").apiAccess).toBe(true);
  });

  it("keeps the old limits for families subscribed before 2026-10-28, never on Free", () => {
    expect(limitsFor("eGuard Plus", true)).toEqual({ childLimit: 5, deviceLimit: 10 });
    expect(limitsFor("eGuard Family", true)).toEqual({ childLimit: 10, deviceLimit: 20 });
    expect(limitsFor("eGuard Plus", false)).toEqual({ childLimit: 3, deviceLimit: 5 });
    expect(limitsFor("Free", true)).toEqual({ childLimit: 1, deviceLimit: 1 });
    expect(familyFeatures({ plan: "eGuard Plus", childLimit: 5, deviceLimit: 10 })[0].label).toBe("Up to 5 children and 10 devices");
  });

  it("maps store products to plans, keeping the retired eGuard Family products as the PRO plan", () => {
    expect(planByProduct("plus_monthly")?.name).toBe("eGuard Plus");
    expect(planByProduct("pro_pass_month")?.name).toBe("eGuard Family");
    expect(planByProduct("family_yearly")?.id).toBe("PRO");
    expect(planByProduct("eguard_family")?.id).toBe("PRO");
    expect(planByProduct("eguard_plus")?.name).toBe("eGuard Plus");
    expect(planByProduct("nope")).toBeNull();
    expect(nextPlan("Free")?.name).toBe("eGuard Plus");
    expect(nextPlan("eGuard Family")).toBeNull();
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
    // The iPhone app's copy names no price and no place to buy; the web's does
    const plans = (ios: boolean) => searchHelp("", "FAQ", ios).find((a) => a.slug === "upgrade-plan")!;
    expect(plans(false).body.join(" ")).toMatch(/₱.*on the web/);
    expect(plans(true).body.join(" ")).not.toMatch(/₱|on the web|card|GCash|upgrade/i);
    expect(plans(true)).not.toHaveProperty("iosApp");
  });
});

describe("distanceM", () => {
  it("is zero for the same point and about 111 km per degree of latitude", () => {
    expect(distanceM({ lat: 14.65, lng: 121.05 }, { lat: 14.65, lng: 121.05 })).toBe(0);
    expect(Math.round(distanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) / 1000)).toBe(111);
  });
});
