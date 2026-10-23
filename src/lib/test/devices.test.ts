import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Each write returns a tag, so the test can see what ran inside the transaction and in which order
const op = (name: string, count = 1) => vi.fn((args: unknown) => ({ op: name, args, count }));
const db = vi.hoisted(() => ({
  device: { findFirst: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  screenTimeDaily: { deleteMany: vi.fn() },
  appUsageDaily: { deleteMany: vi.fn() },
  locationVisit: { deleteMany: vi.fn() },
  child: { findFirst: vi.fn() },
  alert: { updateMany: vi.fn(), create: vi.fn() },
  browserInstallation: { findMany: vi.fn(async () => [] as { appliedPolicyVersion: number | null }[]) },
  browserPolicy: { findUnique: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));
// The transaction client moveDevice works with, inside the (mocked) family device lock
const tx = vi.hoisted(() => ({
  device: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
  screenTimeDaily: { updateMany: vi.fn() },
  appUsageDaily: { updateMany: vi.fn() },
  locationVisit: { updateMany: vi.fn() },
  deviceProtection: { deleteMany: vi.fn() },
  deviceLocation: { updateMany: vi.fn() },
  configRequest: { updateMany: vi.fn() },
  alert: { updateMany: vi.fn() },
  browserInstallation: { updateMany: vi.fn() },
}));
const audit = vi.hoisted(() => vi.fn());
const confirmDestructive = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ db }));
vi.mock("../auth", () => ({ PASSWORD_TOO_LONG: "", passwordTooLong: () => false, confirmDestructive }));
vi.mock("../billing", () => ({}));
vi.mock("../web-billing", () => ({}));
vi.mock("../organizations", () => ({}));
vi.mock("../audit", () => ({ audit }));
vi.mock("../email-verification", () => ({}));
vi.mock("../rate-limit", () => ({}));
const push = vi.hoisted(() => ({ wakeDevices: vi.fn(), wakeChildDevices: vi.fn() }));
vi.mock("../push", () => push);
const policy = vi.hoisted(() => ({ signPolicy: () => ({ signature: "sig", keyId: "k" }), advancePolicyPast: vi.fn() }));
vi.mock("../browser-policy", () => policy);
const slots = vi.hoisted(() => ({
  ensurePrimary: vi.fn(), makePrimary: vi.fn(), promoteOldest: vi.fn(),
  withDeviceLock: vi.fn(async (_familyId: string, fn: (t: unknown) => unknown) => fn(tx)),
}));
const { ensurePrimary } = slots;
vi.mock("../device-slots", () => slots);

const { removeDevice, cancelDeviceRemoval, renameDevice, setPrimaryDevice, moveDevice, DeviceName } = await import("../family-service");

const actor = { id: "u1", familyId: "fam1", name: "Ana", role: "FAMILY_ADMIN" } as Parameters<typeof removeDevice>[0];
const confirm = { password: "pw", phrase: "" };
const ops = () => (db.$transaction.mock.calls[0][0] as { op: string }[]).map((o) => o.op);
const alertBody = () => (db.alert.create.mock.calls[0][0] as { data: { body: string } }).data.body;

describe("removeDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.device.findFirst.mockResolvedValue({ id: "d1", familyId: "fam1", name: "Old phone", kind: "PHONE", childId: "c1", child: { name: "Mia" } });
    db.device.deleteMany.mockImplementation(op("device"));
    db.screenTimeDaily.deleteMany.mockImplementation(op("screenTime"));
    db.appUsageDaily.deleteMany.mockImplementation(op("appUsage"));
    db.locationVisit.deleteMany.mockImplementation(op("visits"));
    db.alert.updateMany.mockImplementation(op("alerts"));
  });

  it("keeps the device's history by default", async () => {
    await removeDevice(actor, "d1", confirm);
    expect(ops()).toEqual(["device", "alerts"]);
    expect(alertBody()).toContain("stay in Mia's reports and history");
    expect(audit).toHaveBeenCalledWith("fam1", "Ana", "device.removed", "Mia's Old phone");
  });

  it("deletes the history first when asked, while the rows still carry the device's id", async () => {
    await removeDevice(actor, "d1", confirm, { deleteHistory: true });
    // Deleting the device sets deviceId to null on its rows, so a delete by deviceId after it would match nothing
    expect(ops()).toEqual(["screenTime", "appUsage", "visits", "device", "alerts"]);
    expect(db.screenTimeDaily.deleteMany).toHaveBeenCalledWith({ where: { deviceId: "d1", childId: "c1" } });
    expect(alertBody()).toContain("were deleted");
    expect(audit).toHaveBeenCalledWith("fam1", "Ana", "device.removed_with_history", "Mia's Old phone");
  });

  it("is a 404 when another parent removed it first", async () => {
    db.device.deleteMany.mockImplementation(op("device", 0));
    await expect(removeDevice(actor, "d1", confirm, { deleteHistory: true })).rejects.toMatchObject({ status: 404 });
    expect(db.alert.create).not.toHaveBeenCalled();
    expect(ensurePrimary).not.toHaveBeenCalled();
  });

  it("hands primary on to the child's oldest remaining device when the primary is removed", async () => {
    db.device.findFirst.mockResolvedValue({ id: "d1", familyId: "fam1", name: "Old phone", kind: "PHONE", childId: "c1", isPrimary: true, child: { name: "Mia" } });
    await removeDevice(actor, "d1", confirm);
    expect(ensurePrimary).toHaveBeenCalledWith("fam1", "c1");
  });

  it("leaves primary alone when another device is removed", async () => {
    await removeDevice(actor, "d1", confirm);
    expect(ensurePrimary).not.toHaveBeenCalled();
  });
});

describe("removeDevice on a computer", () => {
  const pc = { id: "d1", familyId: "fam1", name: "Gaming PC", kind: "COMPUTER", childId: "c1", child: { name: "Mia" }, removalRequestedAt: null };
  beforeEach(() => {
    vi.clearAllMocks();
    db.device.findFirst.mockResolvedValue(pc);
    db.device.deleteMany.mockImplementation(op("device"));
    db.device.updateMany.mockResolvedValue({ count: 1 });
    db.alert.updateMany.mockImplementation(op("alerts"));
  });

  it("waits for the computer to uninstall eGuard instead of deleting it, and wakes it", async () => {
    expect(await removeDevice(actor, "d1", confirm, { deleteHistory: true })).toMatchObject({ pending: true });
    expect(confirmDestructive).toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    // Only starts a removal that isn't waiting already
    expect(db.device.updateMany).toHaveBeenCalledWith({ where: { id: "d1", removalRequestedAt: null }, data: expect.objectContaining({ removalRequestedBy: "Ana", removalDeletesHistory: true }) });
    expect(push.wakeDevices).toHaveBeenCalledWith(["d1"], "remove");
    expect((db.alert.create.mock.calls[0][0] as { data: { title: string } }).data.title).toBe("Removing a computer");
  });

  it("asking again while it waits (or two parents at once) only wakes it again", async () => {
    db.device.findFirst.mockResolvedValue({ ...pc, removalRequestedAt: new Date() });
    db.device.updateMany.mockResolvedValue({ count: 0 });
    expect(await removeDevice(actor, "d1", confirm)).toMatchObject({ pending: true });
    expect(audit).not.toHaveBeenCalled();
    expect(db.alert.create).not.toHaveBeenCalled();
    expect(push.wakeDevices).toHaveBeenCalled();
  });

  it("`now` removes it without waiting, with the history choice made when the removal started", async () => {
    db.device.findFirst.mockResolvedValue({ ...pc, removalRequestedAt: new Date(), removalDeletesHistory: true });
    db.screenTimeDaily.deleteMany.mockImplementation(op("screenTime"));
    db.appUsageDaily.deleteMany.mockImplementation(op("appUsage"));
    db.locationVisit.deleteMany.mockImplementation(op("visits"));
    expect(await removeDevice(actor, "d1", confirm, { now: true })).toMatchObject({ pending: false });
    expect(ops()).toEqual(["screenTime", "appUsage", "visits", "device", "alerts"]);
    expect(alertBody()).toContain("until a removal code from the device page is typed into it");
  });

  it("can be kept while it waits", async () => {
    db.device.findFirst.mockResolvedValue({ ...pc, removalRequestedAt: new Date() });
    await cancelDeviceRemoval(actor, "d1");
    expect(db.device.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: { removalRequestedAt: null, removalRequestedBy: null, removalDeletesHistory: false } });
    expect(audit).toHaveBeenCalledWith("fam1", "Ana", "device.removal_cancelled", "Mia's Gaming PC");
  });
});

describe("renameDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.device.findFirst.mockResolvedValue({ id: "d1", name: "Galaxy A54", childId: "c1", child: { name: "Mia" } });
    db.device.updateMany.mockResolvedValue({ count: 1 });
  });

  it("renames within the family and records it in the audit log", async () => {
    await renameDevice(actor, "d1", "Mia's phone");
    expect(db.device.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "d1", familyId: "fam1" } }));
    expect(db.device.updateMany).toHaveBeenCalledWith({ where: { id: "d1", familyId: "fam1" }, data: { name: "Mia's phone" } });
    expect(audit).toHaveBeenCalledWith("fam1", "Ana", "device.renamed", "Mia's Galaxy A54 → Mia's phone");
  });

  it("does nothing when the name hasn't changed", async () => {
    await renameDevice(actor, "d1", "Galaxy A54");
    expect(db.device.updateMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("is a 404 for another family's device, or one removed meanwhile", async () => {
    db.device.findFirst.mockResolvedValue(null);
    await expect(renameDevice(actor, "d1", "x")).rejects.toMatchObject({ status: 404 });
    db.device.findFirst.mockResolvedValue({ id: "d1", name: "Galaxy A54", childId: "c1", child: { name: "Mia" } });
    db.device.updateMany.mockResolvedValue({ count: 0 });
    await expect(renameDevice(actor, "d1", "x")).rejects.toMatchObject({ status: 404 });
    expect(audit).not.toHaveBeenCalled();
  });

  it("names are trimmed, 1 to 60 characters (shared by web and app)", () => {
    expect(DeviceName.parse("  Tab  ")).toBe("Tab");
    expect(DeviceName.safeParse("   ").success).toBe(false);
    expect(DeviceName.safeParse("x".repeat(61)).success).toBe(false);
  });
});

describe("setPrimaryDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.device.findFirst.mockResolvedValue({ id: "d2", name: "Tablet", childId: "c1", isPrimary: false, child: { name: "Mia" } });
    slots.makePrimary.mockResolvedValue(true);
  });

  it("makes it the child's primary, under the lock, and audits it", async () => {
    await setPrimaryDevice(actor, "d2");
    expect(db.device.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "d2", familyId: "fam1" } }));
    expect(slots.makePrimary).toHaveBeenCalledWith("fam1", "c1", "d2");
    expect(audit).toHaveBeenCalledWith("fam1", "Ana", "device.primary", "Mia's Tablet");
  });

  it("does nothing when it already is", async () => {
    db.device.findFirst.mockResolvedValue({ id: "d2", name: "Tablet", childId: "c1", isPrimary: true, child: { name: "Mia" } });
    await setPrimaryDevice(actor, "d2");
    expect(slots.makePrimary).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("is a 404 for another family's device, or one moved or removed meanwhile", async () => {
    slots.makePrimary.mockResolvedValue(false);
    await expect(setPrimaryDevice(actor, "d2")).rejects.toMatchObject({ status: 404 });
    db.device.findFirst.mockResolvedValue(null);
    await expect(setPrimaryDevice(actor, "d2")).rejects.toMatchObject({ status: 404 });
    expect(audit).not.toHaveBeenCalled();
  });
});

describe("moveDevice", () => {
  const phone = { id: "d1", name: "Galaxy A54", childId: "c1", isPrimary: true, child: { name: "Mia" } };
  beforeEach(() => {
    vi.clearAllMocks();
    db.device.findFirst.mockResolvedValue(phone);
    db.child.findFirst.mockResolvedValue({ id: "c2", name: "Leo" });
    db.browserInstallation.findMany.mockResolvedValue([]);
    tx.device.findFirst.mockResolvedValue({ childId: "c1", isPrimary: true });
    tx.device.count.mockResolvedValue(0);
  });

  it("a computer's browsers come along: the new child's browser policy moves past the version they enforced", async () => {
    db.browserInstallation.findMany.mockResolvedValue([{ appliedPolicyVersion: 7 }, { appliedPolicyVersion: null }]);
    db.browserPolicy.findUnique.mockResolvedValue({ version: 5 });
    await moveDevice(actor, "d1", "c2", confirm);
    expect(db.browserPolicy.findUnique).toHaveBeenCalledWith({ where: { childId: "c1" }, select: { version: true } });
    expect(policy.advancePolicyPast).toHaveBeenCalledWith("c2", 7, "Ana");
  });

  it("a phone (no browsers) leaves browser policies alone", async () => {
    await moveDevice(actor, "d1", "c2", confirm);
    expect(policy.advancePolicyPast).not.toHaveBeenCalled();
  });

  it("gives the device to the new child, keeping what it recorded with the old one", async () => {
    const moved = await moveDevice(actor, "d1", "c2", confirm);
    expect(db.child.findFirst).toHaveBeenCalledWith({ where: { id: "c2", familyId: "fam1" } });
    expect(slots.withDeviceLock).toHaveBeenCalledWith("fam1", expect.any(Function));
    // History is detached from the device, so the device's next usage starts new rows under the new child
    for (const t of [tx.screenTimeDaily, tx.appUsageDaily, tx.locationVisit]) expect(t.updateMany).toHaveBeenCalledWith({ where: { deviceId: "d1" }, data: { deviceId: null } });
    // Checked against the old child's settings: cleared, so it reads "Waiting for first check"
    expect(tx.deviceProtection.deleteMany).toHaveBeenCalledWith({ where: { deviceId: "d1" } });
    expect(tx.deviceLocation.updateMany).toHaveBeenCalledWith({ where: { deviceId: "d1" }, data: expect.objectContaining({ lat: null, lng: null, locatedAt: null }) });
    expect(tx.configRequest.updateMany).toHaveBeenCalledWith({ where: { deviceId: "d1", status: { in: ["PENDING", "AWAITING_PARENT", "DELIVERED"] } }, data: { status: "CANCELLED" } });
    expect(tx.alert.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { familyId: "fam1", deviceId: "d1", resolvedAt: null } }));
    expect(tx.device.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: { childId: "c2", isPrimary: true, checkRequestedAt: expect.any(Date) } });
    // A computer's browsers are part of it (lib/browser-link), so they go to the new child too
    expect(tx.browserInstallation.updateMany).toHaveBeenCalledWith({ where: { deviceId: "d1" }, data: { childId: "c2" } });
    expect(moved.child.name).toBe("Leo");
    expect(audit).toHaveBeenCalledWith("fam1", "Ana", "device.moved", "Galaxy A54: Mia → Leo");
    const alert = (db.alert.create.mock.calls[0][0] as { data: { childId: string; title: string; body: string } }).data;
    expect(alert).toMatchObject({ childId: "c2", title: "Device moved" });
    expect(alert.body).toContain("stays in Mia's reports and history");
  });

  it("hands the old child's primary on, and isn't primary where the new child already has one", async () => {
    tx.device.count.mockResolvedValue(1);
    await moveDevice(actor, "d1", "c2", confirm);
    expect(tx.device.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: expect.objectContaining({ isPrimary: false }) });
    expect(slots.promoteOldest).toHaveBeenCalledWith(tx, "c1");
  });

  it("leaves the old child's primary alone when moving another device", async () => {
    tx.device.findFirst.mockResolvedValue({ childId: "c1", isPrimary: false });
    await moveDevice(actor, "d1", "c2", confirm);
    expect(slots.promoteOldest).not.toHaveBeenCalled();
  });

  it("needs the password or DELETE before changing anything", async () => {
    confirmDestructive.mockRejectedValueOnce(Object.assign(new Error("wrong"), { status: 403 }));
    await expect(moveDevice(actor, "d1", "c2", confirm)).rejects.toMatchObject({ status: 403 });
    expect(confirmDestructive).toHaveBeenCalledWith("u1", confirm);
    expect(slots.withDeviceLock).not.toHaveBeenCalled();
  });

  it("refuses the child it already belongs to, and children or devices of other families", async () => {
    db.child.findFirst.mockResolvedValue({ id: "c1", name: "Mia" });
    await expect(moveDevice(actor, "d1", "c1", confirm)).rejects.toMatchObject({ status: 400 });
    db.child.findFirst.mockResolvedValue(null);
    await expect(moveDevice(actor, "d1", "cX", confirm)).rejects.toMatchObject({ status: 404, message: "Child not found." });
    db.device.findFirst.mockResolvedValue(null);
    await expect(moveDevice(actor, "dX", "c2", confirm)).rejects.toMatchObject({ status: 404, message: "Device not found." });
    expect(slots.withDeviceLock).not.toHaveBeenCalled();
  });

  it("is a 404, changing nothing, when another parent moved or removed it meanwhile", async () => {
    tx.device.findFirst.mockResolvedValue({ childId: "c3", isPrimary: false });
    await expect(moveDevice(actor, "d1", "c2", confirm)).rejects.toMatchObject({ status: 404 });
    tx.device.findFirst.mockResolvedValue(null);
    await expect(moveDevice(actor, "d1", "c2", confirm)).rejects.toMatchObject({ status: 404 });
    expect(tx.device.update).not.toHaveBeenCalled();
    expect(tx.screenTimeDaily.updateMany).not.toHaveBeenCalled();
    expect(db.alert.create).not.toHaveBeenCalled();
  });
});
