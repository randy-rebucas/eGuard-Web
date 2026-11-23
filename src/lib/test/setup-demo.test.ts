import { describe, expect, it } from "vitest";
import { PROTECTIONS } from "../protections";
import {
  CODE_ALPHABET, CODE_LENGTH, browserChecks, checkCode, computerChecks, countdown, formatCode, health, makeCode,
  normalizeCode, phoneChecks, slotsUsed, type DemoProtection,
} from "../setup-demo";

/** The same table the /demo page passes in. */
const TABLE: DemoProtection[] = PROTECTIONS.map((p) => ({ key: p.key, name: p.checkName, android: p.caps.ANDROID, computer: p.caps.WINDOWS }));
const state = (checks: { key: string; state: string }[], key: string) => checks.find((c) => c.key === key)?.state;

describe("pairing codes", () => {
  it("makes 8 characters from the pairing alphabet", () => {
    let i = 0;
    const seq = [0, 0.999999, 0.5, 0.25, 0.1, 0.9, 0.33, 0.66];
    const code = makeCode(() => seq[i++ % seq.length]);
    expect(code).toHaveLength(CODE_LENGTH);
    expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    expect(CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it("accepts what a parent types: lowercase, spaces, dashes", () => {
    expect(normalizeCode(" k7pq-2m9x ")).toBe("K7PQ2M9X");
    expect(normalizeCode("K7PQ 2M9X")).toBe("K7PQ2M9X");
    expect(formatCode("K7PQ2M9X")).toBe("K7PQ 2M9X");
  });

  it("explains each wrong code the way the apps do", () => {
    expect(checkCode("k7pq-2m9x", { want: "K7PQ2M9X", kind: "DEVICE" })).toEqual({ ok: true });
    expect(checkCode("K7PQ", { want: "K7PQ2M9X", kind: "DEVICE" }).ok).toBe(false);
    expect(checkCode("AAAAAAAA", { want: "K7PQ2M9X", kind: "DEVICE" })).toMatchObject({ message: expect.stringContaining("15 minutes") });
    // A browser code typed into the phone app, and the other way round
    expect(checkCode("PQ7KM92X", { want: "K7PQ2M9X", kind: "DEVICE", other: "PQ7KM92X" })).toMatchObject({ message: expect.stringContaining("browser extension") });
    expect(checkCode("K7PQ2M9X", { want: "PQ7KM92X", kind: "BROWSER", other: "K7PQ2M9X" })).toMatchObject({ message: expect.stringContaining("phone app") });
  });

  it("counts down in mm:ss and stops at zero", () => {
    expect(countdown(15 * 60_000)).toBe("15:00");
    expect(countdown(61_500)).toBe("1:02");
    expect(countdown(-5)).toBe("0:00");
  });
});

describe("what each device reports", () => {
  it("an Android phone: verified where Android can apply it, honest about the rest", () => {
    const checks = phoneChecks(TABLE, { skipped: [], locationOnPlan: false });
    expect(state(checks, "SCREEN_TIME")).toBe("verified");
    expect(state(checks, "WEB")).toBe("guided");
    expect(state(checks, "APP_RESTRICTIONS")).toBe("parent");
    expect(state(checks, "LOCATION")).toBe("plan");
    // Not on the plan never counts against health
    expect(health(checks).total).toBe(9);
  });

  it("a skipped permission leaves its protections off", () => {
    // Usage access only counts time: App Approval still works without it, as on a real phone
    const checks = phoneChecks(TABLE, { skipped: ["usage", "admin"], locationOnPlan: true });
    expect(state(checks, "SCREEN_TIME")).toBe("off");
    expect(state(checks, "APP_APPROVAL")).toBe("verified");
    // Accessibility is what pauses apps: without it, bedtime, limits and approvals are all off
    const noAccessibility = phoneChecks(TABLE, { skipped: ["accessibility"], locationOnPlan: true });
    for (const key of ["SCREEN_TIME", "BEDTIME", "APP_APPROVAL", "DOWNLOADS"]) expect(state(noAccessibility, key)).toBe("off");
    expect(state(checks, "UNINSTALL_PROTECTION")).toBe("off");
    expect(state(checks, "LOCATION")).toBe("verified");
  });

  it("a Windows PC: web filtering waits for a browser, uninstall protection for a standard account", () => {
    const before = computerChecks(TABLE, { browserConnected: false, adminAccountIncluded: false });
    expect(state(before, "WEB")).toBe("guided");
    expect(state(before, "UNINSTALL_PROTECTION")).toBe("verified");
    expect(state(before, "LOCATION")).toBe("na");
    const after = computerChecks(TABLE, { browserConnected: true, adminAccountIncluded: true });
    expect(state(after, "WEB")).toBe("verified");
    expect(state(after, "UNINSTALL_PROTECTION")).toBe("guided");
    // Unsupported protections aren't counted
    expect(health(after).total).toBe(TABLE.filter((p) => p.computer !== "UNSUPPORTED").length);
  });

  it("a browser reports web filtering only", () => {
    expect(browserChecks(TABLE)).toEqual([{ key: "WEB", name: expect.any(String), state: "verified" }]);
  });
});

describe("device slots", () => {
  it("a browser on a computer running eGuard takes no slot", () => {
    expect(slotsUsed(["phone", "computer", "browser"])).toBe(2);
    expect(slotsUsed(["phone", "browser"])).toBe(2);
    expect(slotsUsed(["browser"])).toBe(1);
    expect(slotsUsed(["computer", "browser"])).toBe(1);
  });
});
