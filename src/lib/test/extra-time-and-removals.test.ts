import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  child: { findFirst: vi.fn(), update: vi.fn() },
  alert: { updateMany: vi.fn(), create: vi.fn() },
  rateLimit: { findUnique: vi.fn(), upsert: vi.fn() },
  configChange: { create: vi.fn() },
  device: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  screenTimeDaily: { deleteMany: vi.fn() },
  appUsageDaily: { deleteMany: vi.fn() },
  locationVisit: { deleteMany: vi.fn() },
}));
vi.mock("../db", () => ({ db }));
vi.mock("../auth", () => ({ PASSWORD_TOO_LONG: "", passwordTooLong: () => false }));
vi.mock("../billing", () => ({}));
vi.mock("../web-billing", () => ({}));
vi.mock("../organizations", () => ({}));
vi.mock("../audit", () => ({ audit: vi.fn() }));
vi.mock("../email-verification", () => ({}));
vi.mock("../rate-limit", () => ({}));
vi.mock("../device-slots", () => ({ ensurePrimary: vi.fn() }));
vi.mock("../push", () => ({ wakeChildDevices: vi.fn(), wakeDevices: vi.fn() }));
vi.mock("../parent-care/hooks", () => ({ noteActivitySafely: vi.fn() }));

const { finishQuietRemovals, grantExtraTime } = await import("../family-service");

const actor = { id: "u1", familyId: "fam1", name: "Ana", role: "FAMILY_ADMIN" } as Parameters<typeof grantExtraTime>[0];

beforeEach(() => {
  vi.resetAllMocks();
  // Interactive transactions run against the same mock
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  db.child.findFirst.mockResolvedValue({ id: "c1", name: "Mia", extraTimeUntil: null });
});

describe("grantExtraTime requestId", () => {
  it("grants and remembers the id the first time", async () => {
    db.rateLimit.findUnique.mockResolvedValue(null);
    const r = await grantExtraTime(actor, "c1", 30, "app", "req-12345678");
    expect(r).toMatchObject({ addedMinutes: 30, replayed: false });
    expect(db.child.update).toHaveBeenCalledTimes(1);
    expect(db.rateLimit.upsert.mock.calls[0][0]).toMatchObject({ where: { key: "extratime-req:c1:req-12345678" }, create: { count: 30 } });
  });

  it("a retry with the same id adds nothing and answers the first grant", async () => {
    const until = new Date(Date.now() + 25 * 60_000);
    db.child.findFirst.mockResolvedValue({ id: "c1", name: "Mia", extraTimeUntil: until });
    db.rateLimit.findUnique.mockResolvedValue({ key: "extratime-req:c1:req-12345678", count: 30, resetAt: new Date(Date.now() + 3600_000) });
    const r = await grantExtraTime(actor, "c1", 30, "app", "req-12345678");
    expect(r).toEqual({ extraTimeUntil: until, addedMinutes: 30, replayed: true });
    expect(db.child.update).not.toHaveBeenCalled();
    expect(db.configChange.create).not.toHaveBeenCalled();
  });

  it("without an id, every request grants", async () => {
    await grantExtraTime(actor, "c1", 15, "app");
    expect(db.rateLimit.findUnique).not.toHaveBeenCalled();
    expect(db.child.update).toHaveBeenCalledTimes(1);
  });
});

describe("finishQuietRemovals", () => {
  const asked = new Date(Date.now() - 10 * 864e5);
  const seen = new Date(Date.now() - 12 * 864e5);
  const pc = { id: "d1", familyId: "fam1", childId: "c1", name: "PC", isPrimary: false, child: { name: "Mia" }, removalRequestedAt: asked, removalRequestedBy: "Ana", removalDeletesHistory: false, lastSeenAt: seen };

  it("deletes only while lastSeenAt is still what it read", async () => {
    db.device.findMany.mockResolvedValue([pc]);
    db.device.updateMany.mockResolvedValue({ count: 1 });
    db.device.deleteMany.mockResolvedValue({ count: 1 });
    expect(await finishQuietRemovals()).toBe(1);
    expect(db.device.updateMany.mock.calls[0][0].where).toEqual({ id: "d1", lastSeenAt: seen });
  });

  it("leaves a computer that checked in meanwhile", async () => {
    db.device.findMany.mockResolvedValue([pc]);
    db.device.updateMany.mockResolvedValue({ count: 0 });
    expect(await finishQuietRemovals()).toBe(0);
    expect(db.device.deleteMany).not.toHaveBeenCalled();
  });
});
