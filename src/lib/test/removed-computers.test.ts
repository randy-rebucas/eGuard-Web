import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  removedComputer: { upsert: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("../db", () => ({ db }));

const { REMOVED_COMPUTER_DAYS, rememberRemovedComputer, rememberRemovedPhone, removedComputerFor, removedComputers, forgetExpiredRemovedComputers } = await import("../removed-computers");
const { sha256 } = await import("../auth");
const { removalCode } = await import("../device-removal");

const now = new Date("2026-11-16T12:00:00Z");
// Only the delegate methods the module uses are mocked
const tx = db as unknown as Parameters<typeof rememberRemovedComputer>[0];
const req = (token?: string) => new Request("http://x/api/device/v1/sync", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });

beforeEach(() => vi.resetAllMocks());

describe("rememberRemovedComputer", () => {
  it("keeps the token and secret for REMOVED_COMPUTER_DAYS", async () => {
    await rememberRemovedComputer(tx, { id: "d1", familyId: "fam1", tokenHash: "h", removalSecret: "s" }, "Mia's PC", now);
    const arg = db.removedComputer.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ deviceId: "d1" });
    expect(arg.create).toMatchObject({ deviceId: "d1", familyId: "fam1", label: "Mia's PC", tokenHash: "h", removalSecret: "s", removedAt: now });
    expect(arg.create.expiresAt.getTime() - now.getTime()).toBe(REMOVED_COMPUTER_DAYS * 864e5);
  });

  it("keeps nothing for a computer without a token or a secret (nothing could use it)", async () => {
    await rememberRemovedComputer(tx, { id: "d1", familyId: "fam1", tokenHash: null, removalSecret: "s" }, "PC", now);
    await rememberRemovedComputer(tx, { id: "d1", familyId: "fam1", tokenHash: "h", removalSecret: null }, "PC", now);
    expect(db.removedComputer.upsert).not.toHaveBeenCalled();
  });
});

describe("rememberRemovedPhone", () => {
  it("keeps a phone's token without a removal secret, so its 401 can carry the signed uninstall", async () => {
    await rememberRemovedPhone(tx, { id: "p1", familyId: "fam1", tokenHash: "h" }, "Mia's iPhone", now);
    const arg = db.removedComputer.upsert.mock.calls[0][0];
    expect(arg.create).toMatchObject({ deviceId: "p1", familyId: "fam1", label: "Mia's iPhone", tokenHash: "h", removalSecret: null });
    expect(arg.create.expiresAt.getTime() - now.getTime()).toBe(REMOVED_COMPUTER_DAYS * 864e5);
  });

  it("keeps nothing for a phone without a token", async () => {
    await rememberRemovedPhone(tx, { id: "p1", familyId: "fam1", tokenHash: null }, "iPhone", now);
    expect(db.removedComputer.upsert).not.toHaveBeenCalled();
  });
});

describe("removedComputerFor", () => {
  it("finds it by the token's hash, only while it's kept", async () => {
    const row = { id: "r1", deviceId: "d1", expiresAt: new Date(now.getTime() + 1000) };
    db.removedComputer.findUnique.mockResolvedValue(row);
    expect(await removedComputerFor(req("tok"), now)).toBe(row);
    expect(db.removedComputer.findUnique).toHaveBeenCalledWith({ where: { tokenHash: sha256("tok") } });
    db.removedComputer.findUnique.mockResolvedValue({ ...row, expiresAt: now });
    expect(await removedComputerFor(req("tok"), now)).toBeNull();
  });

  it("asks nothing without a token", async () => {
    expect(await removedComputerFor(req(), now)).toBeNull();
    expect(db.removedComputer.findUnique).not.toHaveBeenCalled();
  });
});

describe("removedComputers", () => {
  it("lists the family's unexpired ones with the code the agent accepts now", async () => {
    const secret = Buffer.alloc(32, 7).toString("base64url");
    db.removedComputer.findMany.mockResolvedValue([{ id: "r1", deviceId: "d1", label: "Mia's PC", removalSecret: secret, removedAt: now, expiresAt: now }]);
    const [r] = await removedComputers("fam1", now);
    // Removed phones have no code to show: only computers are listed
    expect(db.removedComputer.findMany.mock.calls[0][0].where).toEqual({ familyId: "fam1", expiresAt: { gt: now }, removalSecret: { not: null } });
    expect(r.removal).toEqual(removalCode(secret, "d1", now.getTime()));
    expect(r).not.toHaveProperty("removalSecret");
  });

  it("forgets the expired ones", async () => {
    db.removedComputer.deleteMany.mockResolvedValue({ count: 2 });
    expect(await forgetExpiredRemovedComputers(now)).toBe(2);
    expect(db.removedComputer.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } });
  });
});
