import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ family: { findUniqueOrThrow: vi.fn(), update: vi.fn() } }));
vi.mock("../db", () => ({ db }));
const rate = vi.hoisted(() => ({ hit: vi.fn() }));
vi.mock("../rate-limit", () => ({ LIMITS: { deviceParentUnlock: { max: 5, windowMs: 900_000 } }, hit: rate.hit }));

const { DevicePin, checkDevicePin, setDevicePin } = await import("../device-pin");
const { DeviceAppRules, appRulesOf, appRulesUpdate, describeAppRules } = await import("../device-app-rules");
const { hashPassword } = await import("../auth");

const device = { id: "d1", familyId: "fam1" };

beforeEach(() => {
  vi.clearAllMocks();
  rate.hit.mockResolvedValue({ limited: false, retryAfter: 0 });
});

describe("device PIN", () => {
  it("takes 4 to 8 digits only", () => {
    expect(DevicePin.safeParse("1234").success).toBe(true);
    expect(DevicePin.safeParse("12345678").success).toBe(true);
    for (const bad of ["123", "123456789", "12a4", " 1234"]) expect(DevicePin.safeParse(bad).success).toBe(false);
  });

  it("is stored hashed, never as typed, and cleared with null", async () => {
    db.family.findUniqueOrThrow.mockResolvedValue({ devicePinHash: "h", devicePinSetAt: new Date() });
    await setDevicePin("fam1", "4821");
    const data = db.family.update.mock.calls[0][0].data;
    expect(data.devicePinHash).toMatch(/^\$argon2id\$/);
    expect(data.devicePinHash).not.toContain("4821");
    await setDevicePin("fam1", null);
    expect(db.family.update.mock.calls[1][0].data).toEqual({ devicePinHash: null, devicePinSetAt: null });
  });

  it("checks a try against the hash, and says when none is set", async () => {
    db.family.findUniqueOrThrow.mockResolvedValue({ devicePinHash: await hashPassword("4821") });
    expect(await checkDevicePin(device, "4821")).toEqual({ result: "ok" });
    expect(await checkDevicePin(device, "0000")).toEqual({ result: "wrong" });
    db.family.findUniqueOrThrow.mockResolvedValue({ devicePinHash: null });
    expect(await checkDevicePin(device, "4821")).toEqual({ result: "not_set" });
  });

  it("is throttled per device before the PIN is even looked at", async () => {
    rate.hit.mockResolvedValue({ limited: true, retryAfter: 600 });
    expect(await checkDevicePin(device, "4821")).toEqual({ result: "limited", retryAfter: 600 });
    expect(rate.hit).toHaveBeenCalledWith("parent-unlock:d1", { max: 5, windowMs: 900_000 });
    expect(db.family.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("iPhone app rules summary", () => {
  const rules = { blocked: { apps: 3, categories: 1, sites: 0 }, limited: [{ minutes: 90, counts: { apps: 2, categories: 0, sites: 0 } }] };

  it("describes the counts for the parent", () => {
    expect(describeAppRules(rules)).toBe("Blocked: 3 apps, 1 category · 1 h 30 min a day: 2 apps");
    expect(describeAppRules({ blocked: { apps: 0, categories: 0, sites: 0 }, limited: [] })).toBeNull();
    expect(describeAppRules(null)).toBeNull();
  });

  it("is written only when it changed, and an older or odd stored shape reads as none", () => {
    expect(appRulesUpdate(rules, rules)).toBeUndefined();
    expect(appRulesUpdate(null, rules)).toEqual(rules);
    expect(appRulesUpdate(rules, undefined)).toBeUndefined();
    expect(appRulesOf({ blocked: 3 })).toBeNull();
    expect(appRulesOf(rules)).toEqual(rules);
  });

  it("refuses out-of-range or extra fields", () => {
    expect(DeviceAppRules.safeParse({ ...rules, extra: 1 }).success).toBe(false);
    expect(DeviceAppRules.safeParse({ ...rules, limited: [{ minutes: 0, counts: rules.blocked }] }).success).toBe(false);
  });
});
