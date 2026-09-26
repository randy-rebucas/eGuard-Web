import { describe, expect, it } from "vitest";
import { computeHealth, deviceState, evaluate, worst } from "./health";
import { PROTECTIONS, configMatches, describeConfig, defaultConfig } from "./protections";

const now = new Date();
const allPass = (overrides: Record<string, string> = {}) =>
  PROTECTIONS.map((p) => ({ key: p.key, status: (overrides[p.key] ?? "PASS") as never, message: null, lastVerifiedAt: now }));

describe("evaluate", () => {
  it("passes when the device reports exactly the requested config", () => {
    expect(evaluate("AVAILABLE", defaultConfig("BEDTIME", 12), defaultConfig("BEDTIME", 12))).toBe("PASS");
  });
  it("ignores key order when comparing", () => {
    expect(configMatches({ key: "LOCATION", sharing: true }, { sharing: true, key: "LOCATION" })).toBe(true);
  });
  it("warns when the device differs from policy", () => {
    expect(evaluate("GUIDED", { key: "LOCATION", sharing: true }, { key: "LOCATION", sharing: false })).toBe("WARNING");
  });
  it("requires action when uninstall protection is switched off", () => {
    expect(evaluate("AVAILABLE", { key: "UNINSTALL_PROTECTION", enabled: true }, { key: "UNINSTALL_PROTECTION", enabled: false })).toBe("ACTION_REQUIRED");
  });
  it("reports NOT_CONFIGURED when neither policy nor device has it on", () => {
    const off = { key: "BEDTIME", enabled: false, start: "22:00", end: "06:00", days: "EVERY_DAY" };
    expect(evaluate("AVAILABLE", off, off)).toBe("NOT_CONFIGURED");
  });
  it("never scores unsupported capabilities", () => {
    expect(evaluate("UNSUPPORTED", { key: "NOTIFICATIONS", quietDuringBedtime: true }, null)).toBe("UNSUPPORTED");
  });
});

describe("computeHealth", () => {
  const dev = (id: string, protections = allPass(), platform: "ANDROID" | "IOS" = "ANDROID") => ({ id, name: id, platform, lastSeenAt: now, protections });

  it("scores 10/10 when everything passes", () => {
    expect(computeHealth([dev("a"), dev("b")]).score).toBe(10);
  });
  it("counts UNSUPPORTED as not failing", () => {
    expect(computeHealth([dev("i", allPass({ NOTIFICATIONS: "UNSUPPORTED" }), "IOS")]).score).toBe(10);
  });
  it("uses the worst device status per check (matches the 8/10 seed)", () => {
    const h = computeHealth([dev("a"), dev("sophie", allPass({ BEDTIME: "NOT_CONFIGURED", LOCATION: "WARNING", NOTIFICATIONS: "UNSUPPORTED" }), "IOS")]);
    expect(h.score).toBe(8);
    expect(h.checks.find((c) => c.key === "LOCATION")?.status).toBe("WARNING");
    expect(h.checks.find((c) => c.key === "LOCATION")?.fixDeviceId).toBe("sophie");
  });
  it("is not a behavior score: no devices means not configured, not zero risk", () => {
    const h = computeHealth([]);
    expect(h.checks.every((c) => c.status === "NOT_CONFIGURED")).toBe(true);
  });
});

describe("deviceState", () => {
  it("marks devices unseen for over a day as offline", () => {
    expect(deviceState({ id: "x", name: "x", platform: "ANDROID", lastSeenAt: new Date(Date.now() - 3 * 864e5), protections: allPass() }).key).toBe("offline");
  });
  it("counts issues excluding unsupported", () => {
    expect(deviceState({ id: "x", name: "x", platform: "IOS", lastSeenAt: now, protections: allPass({ BEDTIME: "WARNING", NOTIFICATIONS: "UNSUPPORTED" }) })).toEqual({ key: "issues", issues: 1 });
  });
});

describe("helpers", () => {
  it("picks the most severe status", () => {
    expect(worst(["PASS", "WARNING", "UNSUPPORTED"])).toBe("WARNING");
  });
  it("describes configs for people", () => {
    expect(describeConfig({ key: "BEDTIME", enabled: true, start: "21:30", end: "06:00", days: "EVERY_DAY" })).toBe("9:30 PM – 6:00 AM");
    expect(describeConfig({ key: "SCREEN_TIME", dailyMinutes: 150, weekendMinutes: 200 })).toBe("2h 30m / day");
  });
});
