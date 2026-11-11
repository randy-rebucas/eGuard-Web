import { beforeEach, describe, expect, it, vi } from "vitest";

/** Console › Security and Feature flags actions: host check, compare-and-swap, and one audit entry per change. */

vi.mock("server-only", () => ({}));
const host = vi.hoisted(() => ({ value: "console.localhost:3000" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: host.value }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const db = vi.hoisted(() => ({
  staffSession: { findUnique: vi.fn(), deleteMany: vi.fn() },
  featureFlag: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
const staff = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ id: "s1", sessionId: "mine" })), logStaff: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ ...staff, authenticateStaff: vi.fn(), endStaffSession: vi.fn(), startStaffSession: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ clientIpFrom: () => null }));

const { deleteFlag, endStaffSessionById, saveFlag, setFlag } = await import("./console");
const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };

beforeEach(() => {
  vi.clearAllMocks();
  host.value = "console.localhost:3000";
});

describe("endStaffSessionById", () => {
  it("ends another staff browser's session and logs whose", async () => {
    db.staffSession.findUnique.mockResolvedValue({ staff: { email: "ana@eguard.family" } });
    db.staffSession.deleteMany.mockResolvedValue({ count: 1 });
    await endStaffSessionById(form({ id: "other" }));
    expect(db.staffSession.deleteMany).toHaveBeenCalledWith({ where: { id: "other" } });
    expect(staff.logStaff).toHaveBeenCalledWith("s1", "security.session_end", "staff-session:other", "ana@eguard.family");
  });

  it("won't end this browser's own session (that's Sign out), nor run off the console host", async () => {
    await expect(endStaffSessionById(form({ id: "mine" }))).rejects.toMatchObject({ status: 400 });
    host.value = "www.eguard.family";
    await expect(endStaffSessionById(form({ id: "other" }))).rejects.toMatchObject({ status: 404 });
    expect(db.staffSession.deleteMany).not.toHaveBeenCalled();
  });

  it("logs nothing when the session was already gone", async () => {
    db.staffSession.findUnique.mockResolvedValue(null);
    await endStaffSessionById(form({ id: "other" }));
    expect(staff.logStaff).not.toHaveBeenCalled();
  });
});

describe("saveFlag", () => {
  it("creates a flag switched off", async () => {
    db.featureFlag.findUnique.mockResolvedValue(null);
    const r = await saveFlag(undefined, form({ key: "ios_launch", description: "iPhone app links", rollout: "25" }));
    expect(r?.ok).toMatch(/Created/);
    expect(db.featureFlag.create).toHaveBeenCalledWith({ data: { key: "ios_launch", description: "iPhone app links", rollout: 25, enabled: false, updatedById: "s1" } });
    expect(staff.logStaff).toHaveBeenCalledWith("s1", "flag.create", "flag:ios_launch", "25%");
  });

  it("refuses a bad key or rollout, and an existing key", async () => {
    expect((await saveFlag(undefined, form({ key: "Bad Key", description: "x", rollout: "100" })))?.error).toBeTruthy();
    expect((await saveFlag(undefined, form({ key: "ok_key", description: "x", rollout: "150" })))?.error).toBeTruthy();
    db.featureFlag.findUnique.mockResolvedValue({ key: "ok_key" });
    expect((await saveFlag(undefined, form({ key: "ok_key", description: "x", rollout: "100" })))?.error).toMatch(/already exists/);
    expect(db.featureFlag.create).not.toHaveBeenCalled();
  });

  it("edits only the version the page showed", async () => {
    const version = "2026-11-11T00:00:00.000Z";
    db.featureFlag.findUnique.mockResolvedValue({ rollout: 100 });
    db.featureFlag.updateMany.mockResolvedValue({ count: 0 });
    const stale = await saveFlag(undefined, form({ key: "ios_launch", description: "x", rollout: "50", version }));
    expect(stale?.error).toMatch(/changed since/);
    expect(db.featureFlag.updateMany).toHaveBeenCalledWith({ where: { key: "ios_launch", updatedAt: new Date(version) }, data: { description: "x", rollout: 50, updatedById: "s1" } });
    expect(staff.logStaff).not.toHaveBeenCalled();

    db.featureFlag.updateMany.mockResolvedValue({ count: 1 });
    await saveFlag(undefined, form({ key: "ios_launch", description: "x", rollout: "50", version }));
    expect(staff.logStaff).toHaveBeenCalledWith("s1", "flag.edit", "flag:ios_launch", "rollout 100% → 50%");
  });
});

describe("setFlag", () => {
  it("switches only from the state the page showed, so a double click logs once", async () => {
    db.featureFlag.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await setFlag(form({ key: "ios_launch", enabled: "true" }));
    await setFlag(form({ key: "ios_launch", enabled: "true" }));
    expect(db.featureFlag.updateMany).toHaveBeenCalledWith({ where: { key: "ios_launch", enabled: false }, data: { enabled: true, updatedById: "s1" } });
    expect(staff.logStaff).toHaveBeenCalledTimes(1);
    expect(staff.logStaff).toHaveBeenCalledWith("s1", "flag.set", "flag:ios_launch", "off → on");
  });
});

describe("deleteFlag", () => {
  it("needs the confirmation box", async () => {
    expect((await deleteFlag(undefined, form({ key: "ios_launch" })))?.error).toMatch(/Tick the box/);
    expect(db.featureFlag.deleteMany).not.toHaveBeenCalled();
    db.featureFlag.deleteMany.mockResolvedValue({ count: 1 });
    await deleteFlag(undefined, form({ key: "ios_launch", confirm: "on" }));
    expect(staff.logStaff).toHaveBeenCalledWith("s1", "flag.delete", "flag:ios_launch");
  });
});
