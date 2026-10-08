import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  child: { findFirst: vi.fn() },
  childPolicy: { findUnique: vi.fn() },
  configRequest: { findFirst: vi.fn(), updateMany: vi.fn(), createMany: vi.fn() },
  device: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("../db", () => ({ db }));
vi.mock("../engine", () => ({ syncChildLimits: vi.fn() }));

const { configVersion, requestConfigs, versionOf } = await import("../config-service");

const actor = { id: "u1", name: "Ana", familyId: "fam1", role: "FAMILY_ADMIN" as const };
const bedtime = { key: "BEDTIME" as const, enabled: true, start: "21:00", end: "06:00", days: "EVERY_DAY" as const };
const saved = { ...bedtime, start: "22:00" };

beforeEach(() => {
  vi.resetAllMocks();
  db.child.findFirst.mockResolvedValue({ id: "c1", name: "Mia", familyId: "fam1" });
  db.childPolicy.findUnique.mockResolvedValue({ config: saved });
  db.configRequest.findFirst.mockResolvedValue(null);
  db.device.findMany.mockResolvedValue([{ id: "d1", platform: "ANDROID", protections: [] }]);
  // The transaction runs on the same mocked client
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
});

describe("protection versions", () => {
  it("changes with the saved setting and with a change waiting for devices", () => {
    const v = versionOf(saved, null);
    expect(versionOf(saved, null)).toBe(v);
    expect(versionOf(bedtime, null)).not.toBe(v);
    expect(versionOf(saved, "batch-2")).not.toBe(v);
    expect(versionOf(null, null)).not.toBe(v);
  });

  it("saves a change made from the current setting", async () => {
    const base = await configVersion("c1", "BEDTIME");
    await expect(requestConfigs(actor, "c1", [bedtime], "web", { strict: true, baseVersion: base })).resolves.toMatchObject({ requested: ["BEDTIME"] });
  });

  it("refuses one made before another parent's change, and touches nothing", async () => {
    const base = versionOf({ ...bedtime, start: "20:00" }, null);
    await expect(requestConfigs(actor, "c1", [bedtime], "web", { strict: true, baseVersion: base }))
      .rejects.toMatchObject({ status: 409, code: "stale" });
    expect(db.configRequest.updateMany).not.toHaveBeenCalled();
    expect(db.configRequest.createMany).not.toHaveBeenCalled();
  });

  it("refuses one that would cancel a change queued since", async () => {
    const base = await configVersion("c1", "BEDTIME");
    db.configRequest.findFirst.mockResolvedValue({ batchId: "b-other" });
    await expect(requestConfigs(actor, "c1", [bedtime], "web", { baseVersion: base })).rejects.toMatchObject({ code: "stale" });
  });

  it("checks the version under the child and protection's lock, before writing", async () => {
    const base = await configVersion("c1", "BEDTIME");
    await requestConfigs(actor, "c1", [bedtime], "web", { baseVersion: base });
    expect(db.$executeRaw.mock.calls[0].slice(1)).toEqual(["config:c1:BEDTIME"]);
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(db.configRequest.updateMany.mock.invocationCallOrder[0]);
  });

  it("without a base version, works as before (older apps)", async () => {
    db.configRequest.findFirst.mockResolvedValue({ batchId: "b-other" });
    await expect(requestConfigs(actor, "c1", [bedtime], "web")).resolves.toMatchObject({ requested: ["BEDTIME"] });
  });
});
