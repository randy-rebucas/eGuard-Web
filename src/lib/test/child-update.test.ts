import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  child: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  childCategoryLimit: { findUnique: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  configChange: { create: vi.fn() },
}));
vi.mock("../db", () => ({ db }));
vi.mock("../auth", () => ({ PASSWORD_TOO_LONG: "", passwordTooLong: () => false }));
vi.mock("../billing", () => ({}));
vi.mock("../web-billing", () => ({}));
vi.mock("../organizations", () => ({}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock("../audit", () => audit);
vi.mock("../email-verification", () => ({}));
vi.mock("../rate-limit", () => ({}));
vi.mock("../device-slots", () => ({}));

const { setCategoryLimit, updateChild } = await import("../family-service");

const actor = { id: "u1", familyId: "fam1", name: "Ana", role: "FAMILY_ADMIN" } as Parameters<typeof updateChild>[0];
const year = new Date().getFullYear();
const mia = (age: number) => ({ id: "c1", familyId: "fam1", name: "Mia", birthYear: year - age, policies: [] });

beforeEach(() => {
  vi.resetAllMocks();
  db.child.updateMany.mockResolvedValue({ count: 1 });
  db.child.findMany.mockResolvedValue([{ name: "Leo" }]);
});

describe("updateChild", () => {
  it("only edits children in the actor's family", async () => {
    db.child.findFirst.mockResolvedValue(null);
    await expect(updateChild(actor, "other", { name: "X" })).rejects.toMatchObject({ status: 404 });
    expect(db.child.findFirst.mock.calls[0][0].where).toMatchObject({ id: "other", familyId: "fam1" });
  });
  it("changes only the fields given, so a rename elsewhere isn't undone by a new birth year", async () => {
    // Another parent renamed Mia to "Mimi" after this form loaded; this save only sends the year
    db.child.findFirst.mockResolvedValue({ ...mia(9), name: "Mimi" });
    await updateChild(actor, "c1", { birthYear: year - 10 });
    expect(db.child.updateMany.mock.calls[0][0].data).toEqual({ name: "Mimi", birthYear: year - 10 });
  });
  it("checks a new name against the other children, any case", async () => {
    db.child.findFirst.mockResolvedValue(mia(9));
    await expect(updateChild(actor, "c1", { name: "leo" })).rejects.toMatchObject({ status: 409 });
    expect(db.child.updateMany).not.toHaveBeenCalled();
  });
  it("renames a child who has grown past 17, keeping their saved year", async () => {
    db.child.findFirst.mockResolvedValue(mia(19));
    await updateChild(actor, "c1", { name: "Mia R." });
    expect(db.child.updateMany.mock.calls[0][0].data).toEqual({ name: "Mia R.", birthYear: year - 19 });
  });
  it("refuses a new birth year past the age range", async () => {
    db.child.findFirst.mockResolvedValue(mia(9));
    await expect(updateChild(actor, "c1", { birthYear: year - 19 })).rejects.toThrow("eGuard is for children under 18.");
  });
  it("audits only a real change", async () => {
    db.child.findFirst.mockResolvedValue(mia(9));
    await updateChild(actor, "c1", { name: "Mia" });
    expect(audit.audit).not.toHaveBeenCalled();
    await updateChild(actor, "c1", { name: "Mia R." });
    expect(audit.audit).toHaveBeenCalledWith("fam1", "Ana", "child.updated", "Mia → Mia R.");
  });
});

describe("setCategoryLimit", () => {
  it("removing a limit that's already gone (two removes at once) is a no-op, not an error", async () => {
    db.child.findFirst.mockResolvedValue({ id: "c1", family: { plan: "Family Pro" } });
    db.childCategoryLimit.findUnique.mockResolvedValue({ dailyLimitMinutes: 60 });
    db.childCategoryLimit.deleteMany.mockResolvedValue({ count: 0 });
    await expect(setCategoryLimit(actor, "c1", "GAMES", null, "web")).resolves.toEqual({ category: "GAMES", dailyLimitMinutes: null });
    expect(db.childCategoryLimit.deleteMany).toHaveBeenCalledWith({ where: { childId: "c1", category: "GAMES" } });
  });
  it("removing works on a plan without category limits; setting one doesn't", async () => {
    db.child.findFirst.mockResolvedValue({ id: "c1", family: { plan: "Free" } });
    db.childCategoryLimit.findUnique.mockResolvedValue({ dailyLimitMinutes: 60 });
    db.childCategoryLimit.deleteMany.mockResolvedValue({ count: 1 });
    await expect(setCategoryLimit(actor, "c1", "GAMES", null, "web")).resolves.toMatchObject({ dailyLimitMinutes: null });
    await expect(setCategoryLimit(actor, "c1", "GAMES", 30, "web")).rejects.toMatchObject({ status: 403 });
  });
});
