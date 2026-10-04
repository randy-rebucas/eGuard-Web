import { describe, expect, it } from "vitest";
import { browserNeedsAttention, computeHealth, deviceState, evaluate, familySummary, healthBadge, healthLabel, isDismissible, worst } from "../health";
import { PROTECTIONS, configMatches, describeConfig, defaultConfig } from "../protections";

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
  it("passes a protection the parent turned off once the device agrees, or is stricter", () => {
    const off = { key: "BEDTIME", enabled: false, start: "22:00", end: "06:00", days: "EVERY_DAY" };
    expect(evaluate("AVAILABLE", off, off)).toBe("PASS");
    expect(evaluate("AVAILABLE", off, { ...off, enabled: true })).toBe("PASS");
    expect(evaluate("AVAILABLE", { key: "UNINSTALL_PROTECTION", enabled: false }, { key: "UNINSTALL_PROTECTION", enabled: false })).toBe("PASS");
  });
  it("reports NOT_CONFIGURED when the child has no setting and the device has it off", () => {
    const off = { key: "BEDTIME", enabled: false, start: "22:00", end: "06:00", days: "EVERY_DAY" };
    expect(evaluate("AVAILABLE", undefined, off)).toBe("NOT_CONFIGURED");
    expect(evaluate("AVAILABLE", null, { ...off, enabled: true })).toBe("PASS");
  });
  it("compares web filtering on its mode, not the count of sites the device loaded", () => {
    const web = (mode: string, blockedSites: number) => ({ key: "WEB", mode, blockedSites });
    expect(configMatches(web("FILTER", 42), web("FILTER", 81_244))).toBe(true);
    expect(evaluate("AVAILABLE", web("FILTER", 0), web("FILTER", 81_244))).toBe("PASS");
    expect(evaluate("AVAILABLE", web("ALLOWLIST", 0), web("FILTER", 81_244))).toBe("WARNING");
    expect(describeConfig(web("FILTER", 42))).toBe("Adult and unsafe sites filtered");
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

  describe("offline devices", () => {
    const offline = (id: string, protections = allPass(), platform: "ANDROID" | "IOS" = "ANDROID") =>
      ({ ...dev(id, protections, platform), lastSeenAt: new Date(Date.now() - 3 * 864e5) });
    const never = (id: string) => ({ ...dev(id), lastSeenAt: null });

    it("scores by the last known state, but never calls it verified", () => {
      const h = computeHealth([dev("phone"), offline("tab")]);
      expect(h.score).toBe(10);
      expect(h.offline).toBe(1);
      expect(h.verified).toBe(false);
      expect(h.checks[0].detail).toBe("Verified on 1 of 2 devices; 1 offline, last known state");
    });
    it("is verified only with every device online and every check passing", () => {
      expect(computeHealth([dev("a"), dev("b")])).toMatchObject({ score: 10, offline: 0, verified: true });
      expect(computeHealth([dev("a", allPass({ BEDTIME: "WARNING" }))]).verified).toBe(false);
      expect(computeHealth([]).verified).toBe(false);
    });
    it("treats a device that never synced as offline", () => {
      expect(computeHealth([never("new")])).toMatchObject({ offline: 1, verified: false });
    });
    it("still reports real failures on offline devices", () => {
      const loc = computeHealth([offline("tab", allPass({ LOCATION: "ACTION_REQUIRED" }))]).checks.find((c) => c.key === "LOCATION")!;
      expect(loc.status).toBe("ACTION_REQUIRED");
      expect(loc.fixDeviceId).toBe("tab");
    });
    it("is verified again once the device syncs", () => {
      expect(computeHealth([{ ...offline("tab"), lastSeenAt: new Date() }]).verified).toBe(true);
    });
    it("measures offline from the given time", () => {
      const seen = new Date("2026-09-01T00:00:00Z");
      const d = { ...dev("tab"), lastSeenAt: seen };
      expect(computeHealth([d], { now: seen.getTime() + 3600_000 }).verified).toBe(true);
      expect(computeHealth([d], { now: seen.getTime() + 2 * 864e5 }).verified).toBe(false);
    });
  });
});

describe("deviceState", () => {
  it("marks devices unseen for over a day as offline", () => {
    expect(deviceState({ id: "x", name: "x", platform: "ANDROID", lastSeenAt: new Date(Date.now() - 3 * 864e5), protections: allPass() }).key).toBe("offline");
  });
  it("counts issues excluding unsupported", () => {
    expect(deviceState({ id: "x", name: "x", platform: "IOS", lastSeenAt: now, protections: allPass({ BEDTIME: "WARNING", NOTIFICATIONS: "UNSUPPORTED" }) })).toEqual({ key: "issues", issues: 1, firstCheck: false });
  });
  it("is not healthy before the device reports, as the child's health score says", () => {
    const fresh = { id: "x", name: "x", platform: "ANDROID" as const, lastSeenAt: now, protections: [] };
    // firstCheck lets the web and the app say "Waiting for first check" rather than "10 issues"
    expect(deviceState(fresh)).toEqual({ key: "issues", issues: PROTECTIONS.length, firstCheck: true });
    expect(computeHealth([fresh]).score).toBe(0);
  });
  it("counts a protection the device left out of its report", () => {
    expect(deviceState({ id: "x", name: "x", platform: "ANDROID", lastSeenAt: now, protections: allPass().filter((p) => p.key !== "BEDTIME") })).toEqual({ key: "issues", issues: 1, firstCheck: false });
  });
});

describe("familySummary", () => {
  const dev = (id: string, protections = allPass(), lastSeenAt: Date | null = now) => ({ id, name: id, platform: "ANDROID" as const, lastSeenAt, protections });
  const stale = new Date(Date.now() - 3 * 864e5);
  const kid = (name: string, devices: unknown[] = [{}]) => ({ id: name, name, devices });
  const summary = (devices: ReturnType<typeof dev>[], kids = [kid("Mia")]) => familySummary(computeHealth(devices), kids, devices.length);

  it("asks to pair when nothing is, without counting unconfigured checks as issues", () => {
    expect(summary([], [kid("Mia", [])])).toMatchObject({ lede: ["Your family is almost set.", "Pair a device to start protecting them."], issues: 0 });
  });
  it("is verified only with every check passing and every device online", () => {
    expect(summary([dev("a")]).lede).toEqual(["Every protection is verified.", "Your family is set."]);
  });
  it("names offline devices it can't verify", () => {
    expect(summary([dev("a", allPass(), stale)]).lede[1]).toBe("1 device is offline, so we can't verify it now.");
  });
  it("looks good with a setting or two to review, all online", () => {
    expect(summary([dev("a", allPass({ BEDTIME: "WARNING" }))])).toMatchObject({ lede: ["Your family's digital safety", "looks good today."], issues: 1 });
  });
  it("never looks good while a device is offline", () => {
    expect(summary([dev("a", allPass({ BEDTIME: "WARNING" }), stale)]).lede[1]).toBe("needs a little attention.");
  });
  it("never looks good while a protection is turned off", () => {
    expect(summary([dev("a", allPass({ UNINSTALL_PROTECTION: "ACTION_REQUIRED" }))]).lede[1]).toBe("needs your attention.");
  });
  it("still reports a child with no device when settings need attention", () => {
    const s = summary([dev("a", allPass({ BEDTIME: "WARNING" }))], [kid("Mia"), kid("Leo", [])]);
    expect(s.lede[1]).toBe("needs a little attention.");
    expect(s.unpaired).toEqual([{ id: "Leo", name: "Leo" }]);
  });
  it("names the unpaired child when everything paired is set", () => {
    expect(summary([dev("a")], [kid("Mia"), kid("Leo", [])]).lede).toEqual(["Every paired device is verified.", "Leo has no paired device yet."]);
  });
});

describe("healthLabel and healthBadge", () => {
  const h = (score: number, offline = 0) => ({ score, total: 10, offline });
  it("labels every band, as the mobile API does", () => {
    expect(healthLabel(10, 10, 0, 0)).toBe("No devices yet");
    expect(healthLabel(10, 10, 0, 1)).toBe("Fully protected");
    expect(healthLabel(10, 10, 1, 1)).toBe("Last known: all set");
    expect(healthLabel(8, 10, 0, 1)).toBe("Good protection");
    expect(healthLabel(5, 10, 0, 1)).toBe("Needs attention");
    expect(healthLabel(4, 10, 0, 1)).toBe("Action required");
  });
  it("gives each band a tone", () => {
    expect(healthBadge(h(10), 0).tone).toBe("muted");
    expect(healthBadge(h(9), 1).tone).toBe("ok");
    expect(healthBadge(h(8), 1).tone).toBe("accent");
    expect(healthBadge(h(6), 1).tone).toBe("warn");
    expect(healthBadge(h(3), 1)).toMatchObject({ label: "Action required", tone: "crit" });
  });
});

describe("browserNeedsAttention", () => {
  const b = (o: Partial<{ revokedAt: Date | null; lastSeenAt: Date | null; protectionState: string | null }> = {}) =>
    ({ revokedAt: null, lastSeenAt: now, protectionState: "PROTECTED", ...o });
  it("is quiet for a protected or brand-new browser", () => {
    expect(browserNeedsAttention(b())).toBe(false);
    expect(browserNeedsAttention(b({ protectionState: null }))).toBe(false);
    // A state from a newer extension reads as "Connected", not a problem
    expect(browserNeedsAttention(b({ protectionState: "SOMETHING_NEW" }))).toBe(false);
  });
  it("flags disconnected, silent and self-reported problems", () => {
    expect(browserNeedsAttention(b({ revokedAt: now }))).toBe(true);
    expect(browserNeedsAttention(b({ lastSeenAt: new Date(Date.now() - 2 * 864e5) }))).toBe(true);
    expect(browserNeedsAttention(b({ protectionState: "SYNC_PAUSED" }))).toBe(true);
  });
});

describe("isDismissible", () => {
  const alert = (severity: string, resolveKey: string | null, resolvedAt: Date | null = null) => ({ severity, resolveKey, resolvedAt });
  it("lets parents clear what nothing else would", () => {
    expect(isDismissible(alert("INFO", null))).toBe(true);
    // "Device removed": ATTENTION with no resolveKey would otherwise stay open forever
    expect(isDismissible(alert("ATTENTION", null))).toBe(true);
  });
  it("keeps alerts that resolve once the problem is fixed", () => {
    expect(isDismissible(alert("ATTENTION", "OFFLINE:d1"))).toBe(false);
    expect(isDismissible(alert("ACTION_REQUIRED", "BROWSER_REVOKED:b1"))).toBe(false);
    expect(isDismissible(alert("INFO", null, new Date()))).toBe(false);
  });
});

describe("helpers", () => {
  it("picks the most severe status", () => {
    expect(worst(["PASS", "WARNING", "UNSUPPORTED"])).toBe("WARNING");
  });
  it("describes configs for people", () => {
    expect(describeConfig({ key: "BEDTIME", enabled: true, start: "21:30", end: "06:00", days: "EVERY_DAY" })).toBe("9:30 PM – 6:00 AM");
    expect(describeConfig({ key: "BEDTIME", enabled: true, start: "21:30", end: "06:00", days: "SCHOOL_NIGHTS" })).toBe("9:30 PM – 6:00 AM, school nights");
    expect(describeConfig({ key: "SCREEN_TIME", dailyMinutes: 150, weekendMinutes: 150 })).toBe("2h 30m / day");
    expect(describeConfig({ key: "SCREEN_TIME", dailyMinutes: 150, weekendMinutes: 240 })).toBe("2h 30m / day, 4h weekends");
    // A weekend-only change must read differently before and after
    expect(describeConfig({ key: "SCREEN_TIME", dailyMinutes: 120, weekendMinutes: 180 }))
      .not.toBe(describeConfig({ key: "SCREEN_TIME", dailyMinutes: 120, weekendMinutes: 240 }));
  });
});
