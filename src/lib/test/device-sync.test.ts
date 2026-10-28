import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  device: { update: vi.fn() },
  configRequest: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  childPolicy: { findMany: vi.fn() },
  deviceProtection: { upsert: vi.fn() },
  deviceLocation: { upsert: vi.fn() },
  alert: { updateMany: vi.fn(), findMany: vi.fn() },
  configChange: { create: vi.fn() },
  // createAlertUnless: the lock, then no open alert, then the new one
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ $executeRaw: vi.fn(), alert: { findFirst: vi.fn(async () => null), create: alertCreate } })),
};
const alertCreate = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db }));

const { deviceSync, processReport } = await import("../engine");

const verified = { key: "SCREEN_TIME", dailyMinutes: 120, weekendMinutes: 180 };
const changed = { key: "SCREEN_TIME", dailyMinutes: 150, weekendMinutes: 180 };
const bedtime = { key: "BEDTIME", enabled: true, start: "21:00", end: "06:00", days: "EVERY_DAY" };

describe("deviceSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.device.update.mockResolvedValue({ id: "d1", familyId: "f1", child: { policies: [{ key: "SCREEN_TIME", config: verified }, { key: "BEDTIME", config: bedtime }] } });
    db.configRequest.updateMany.mockResolvedValue({ count: 0 });
    db.alert.updateMany.mockResolvedValue({ count: 0 });
    db.alert.findMany.mockResolvedValue([]);
  });

  it("sends a change waiting for the device in policy too, so a device enforcing policy applies it", async () => {
    db.configRequest.findMany.mockResolvedValue([{ id: "r1", key: "SCREEN_TIME", status: "PENDING", desired: changed }]);
    const s = await deviceSync("d1");
    expect(s.requests).toEqual([{ id: "r1", key: "SCREEN_TIME", config: changed }]);
    expect(s.policy).toEqual([{ key: "SCREEN_TIME", config: changed }, { key: "BEDTIME", config: bedtime }]);
  });

  it("sends the verified policy once nothing is waiting (a cancelled or failed change goes back)", async () => {
    db.configRequest.findMany.mockResolvedValue([]);
    expect((await deviceSync("d1")).policy).toEqual([{ key: "SCREEN_TIME", config: verified }, { key: "BEDTIME", config: bedtime }]);
  });

  it("saves the push token the device sends, clears it on null, and leaves it when absent", async () => {
    db.configRequest.findMany.mockResolvedValue([]);
    await deviceSync("d1", { pushToken: "fcm-1" });
    expect(db.device.update.mock.calls[0][0].data).toMatchObject({ pushToken: "fcm-1" });
    await deviceSync("d1", { pushToken: null });
    expect(db.device.update.mock.calls[1][0].data).toMatchObject({ pushToken: null });
    await deviceSync("d1", {});
    expect(db.device.update.mock.calls[2][0].data).not.toHaveProperty("pushToken");
  });
});

describe("processReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.device.update.mockResolvedValue({ id: "d1", familyId: "f1", family: { plan: "eGuard Plus" }, childId: "c1", name: "iPad", platform: "IOS", checkRequestedAt: null, child: { name: "Mia" }, protections: [] });
    db.childPolicy.findMany.mockResolvedValue([{ key: "SCREEN_TIME", config: verified }]);
    db.alert.updateMany.mockResolvedValue({ count: 0 });
  });

  it("says why a device couldn't apply a change, on the failed change and on the device's status", async () => {
    db.configRequest.findMany.mockResolvedValue([{ id: "r1", key: "SCREEN_TIME", status: "DELIVERED", mode: "APPLY", desired: changed, createdAt: new Date() }]);
    await processReport("d1", { protections: [{ key: "SCREEN_TIME", config: { dailyMinutes: 0, weekendMinutes: 0 }, error: "Choose at least one app or category first." }] });
    expect(db.configRequest.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { status: "FAILED", failureReason: "The device couldn't apply it: Choose at least one app or category first." } });
    expect(db.deviceProtection.upsert.mock.calls[0][0].update.message).toBe("Screen Time couldn't be applied on Mia's iPad: Choose at least one app or category first.");
  });

  it("keeps the mismatch wording when the device gives no reason", async () => {
    db.configRequest.findMany.mockResolvedValue([]);
    await processReport("d1", { protections: [{ key: "SCREEN_TIME", config: { dailyMinutes: 60, weekendMinutes: 60 } }] });
    expect(db.deviceProtection.upsert.mock.calls[0][0].update.message).toMatch(/doesn't match your setting/);
  });

  it("takes a protection left out of a full report as not in force, not as its last Pass", async () => {
    db.configRequest.findMany.mockResolvedValue([]);
    db.device.update.mockResolvedValue({ id: "d1", familyId: "f1", family: { plan: "eGuard Plus" }, childId: "c1", name: "Pixel", platform: "ANDROID", checkRequestedAt: null, child: { name: "Mia" }, protections: [] });
    await processReport("d1", { full: true, protections: [{ key: "BEDTIME", config: { enabled: true, start: "21:00", end: "06:00", days: "EVERY_DAY" } }] });
    const byKey = new Map(db.deviceProtection.upsert.mock.calls.map((c) => [c[0].where.deviceId_key.key, c[0].update]));
    expect(byKey.get("SCREEN_TIME")).toMatchObject({ status: "WARNING", message: expect.stringMatching(/^Screen Time couldn't be applied on Mia's Pixel: eGuard isn't applying it/) });
    // Unsupported or set by the parent in Google Play: nothing the device could have sent
    expect(byKey.has("APP_RESTRICTIONS")).toBe(false);
    expect(byKey.has("CONTENT")).toBe(false);
    expect(byKey.size).toBe(8);
  });

  it("leaves out nothing from a report that isn't full", async () => {
    db.configRequest.findMany.mockResolvedValue([]);
    await processReport("d1", { protections: [{ key: "SCREEN_TIME", config: { dailyMinutes: 120, weekendMinutes: 180 } }] });
    expect(db.deviceProtection.upsert).toHaveBeenCalledTimes(1);
  });

  it("ignores what an Android device reports for a rating the parent sets in Google Play", async () => {
    db.configRequest.findMany.mockResolvedValue([]);
    db.device.update.mockResolvedValue({ id: "d1", familyId: "f1", family: { plan: "eGuard Plus" }, childId: "c1", name: "Pixel", platform: "ANDROID", checkRequestedAt: null, child: { name: "Mia" }, protections: [] });
    await processReport("d1", { protections: [{ key: "APP_RESTRICTIONS", config: { maxAgeRating: 9 } }, { key: "CONTENT", config: { maxAgeRating: 9 } }] });
    expect(db.deviceProtection.upsert).not.toHaveBeenCalled();
  });
});

describe("drift alerts by plan", () => {
  const uninstallOn = { key: "UNINSTALL_PROTECTION", enabled: true };
  // A device whose Screen Time and Uninstall Protection passed before this report
  const onPlan = (plan: string) => db.device.update.mockResolvedValue({
    id: "d1", familyId: "f1", family: { plan }, childId: "c1", name: "Pixel", platform: "ANDROID", checkRequestedAt: null, child: { name: "Mia" },
    protections: [{ key: "SCREEN_TIME", status: "PASS", reported: verified }, { key: "UNINSTALL_PROTECTION", status: "PASS", reported: uninstallOn }],
  });
  const drifted = { key: "SCREEN_TIME" as const, config: { dailyMinutes: 300, weekendMinutes: 300 } };

  beforeEach(() => {
    vi.clearAllMocks();
    db.configRequest.findMany.mockResolvedValue([]);
    db.childPolicy.findMany.mockResolvedValue([{ key: "SCREEN_TIME", config: verified }, { key: "UNINSTALL_PROTECTION", config: uninstallOn }]);
    db.alert.updateMany.mockResolvedValue({ count: 0 });
  });

  it("alerts on a setting changed on the device with eGuard Plus", async () => {
    onPlan("eGuard Plus");
    await processReport("d1", { protections: [drifted] });
    expect(alertCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ title: "Protection setting changed" }) });
  });

  it("on Free, records the change in history without an alert", async () => {
    onPlan("Free");
    await processReport("d1", { protections: [drifted] });
    expect(alertCreate).not.toHaveBeenCalled();
    expect(db.configChange.create).toHaveBeenCalledWith({ data: expect.objectContaining({ title: "Screen Time changed on device" }) });
    expect(db.deviceProtection.upsert.mock.calls[0][0].update.status).toBe("WARNING");
  });

  it("on Free, still alerts when uninstall protection is turned off or a protection can't be applied", async () => {
    onPlan("Free");
    await processReport("d1", { protections: [{ key: "UNINSTALL_PROTECTION", config: { enabled: false } }, { ...drifted, error: "Usage access is off." }] });
    expect(alertCreate).toHaveBeenCalledTimes(2);
  });
});
