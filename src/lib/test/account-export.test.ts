import { beforeEach, describe, expect, it, vi } from "vitest";

/** The family export: tips and reminders are the exporting parent's own, never another parent's. */

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  family: { findUniqueOrThrow: vi.fn() },
  user: { findUniqueOrThrow: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock("../db", () => ({ db }));

const { exportFamily } = await import("../account-export");

describe("exportFamily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.family.findUniqueOrThrow.mockResolvedValue({ id: "f1", users: [] });
    db.user.findUniqueOrThrow.mockResolvedValue({ carePreference: null, careMessages: [] });
  });

  it("adds the exporting parent's own tips and reminders, and logs the export", async () => {
    const out = await exportFamily({ id: "u1", familyId: "f1", name: "Ana" });
    expect(db.user.findUniqueOrThrow).toHaveBeenCalledOnce();
    expect(db.user.findUniqueOrThrow.mock.calls[0][0].where).toEqual({ id: "u1" });
    expect(out.tipsAndReminders).toEqual({ carePreference: null, careMessages: [] });
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: { familyId: "f1", actor: "Ana", action: "data.exported" } });
  });

  it("doesn't put any parent's care data inside the family's parents list", async () => {
    await exportFamily({ id: "u1", familyId: "f1", name: "Ana" });
    const users = db.family.findUniqueOrThrow.mock.calls[0][0].include.users.select;
    expect(Object.keys(users).some((k) => k.startsWith("care"))).toBe(false);
  });

  it("never exports a message's unsubscribe token", async () => {
    await exportFamily({ id: "u1", familyId: "f1", name: "Ana" });
    expect(db.user.findUniqueOrThrow.mock.calls[0][0].select.careMessages.select).not.toHaveProperty("token");
  });
});
