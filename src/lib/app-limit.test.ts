import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  childApp: { findFirst: vi.fn(), update: vi.fn() },
  configChange: { create: vi.fn() },
}));
vi.mock("./db", () => ({ db }));
vi.mock("./auth", () => ({ PASSWORD_TOO_LONG: "", passwordTooLong: () => false }));
vi.mock("./billing", () => ({}));
vi.mock("./web-billing", () => ({}));
vi.mock("./organizations", () => ({}));
vi.mock("./audit", () => ({}));
vi.mock("./email-verification", () => ({}));
vi.mock("./rate-limit", () => ({}));
vi.mock("./device-slots", () => ({}));

const { setAppLimit } = await import("./family-service");

const actor = { familyId: "fam1", name: "Ana", role: "FAMILY_ADMIN" } as Parameters<typeof setAppLimit>[0];

describe("app daily limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.childApp.findFirst.mockResolvedValue({ id: "app1", childId: "c1", name: "Roblox", dailyLimitMinutes: 60 });
    db.childApp.update.mockImplementation(({ data }) => ({ id: "app1", ...data }));
  });

  const saved = () => db.childApp.update.mock.calls[0][0].data.dailyLimitMinutes;

  it("treats a fraction that rounds to zero as no limit, never as 0 minutes", async () => {
    await setAppLimit(actor, "app1", 0.4, "web");
    expect(saved()).toBeNull();
  });

  it("treats 0 and null as no limit", async () => {
    await setAppLimit(actor, "app1", 0, "web");
    expect(saved()).toBeNull();
    vi.clearAllMocks();
    db.childApp.findFirst.mockResolvedValue({ id: "app1", childId: "c1", name: "Roblox", dailyLimitMinutes: 60 });
    await setAppLimit(actor, "app1", null, "web");
    expect(saved()).toBeNull();
  });

  it("keeps whole minutes, capped at a day", async () => {
    await setAppLimit(actor, "app1", 44.6, "web");
    expect(saved()).toBe(45);
    vi.clearAllMocks();
    db.childApp.findFirst.mockResolvedValue({ id: "app1", childId: "c1", name: "Roblox", dailyLimitMinutes: 60 });
    await setAppLimit(actor, "app1", 5000, "web");
    expect(saved()).toBe(1440);
  });

  it("writes nothing when the limit doesn't change", async () => {
    await setAppLimit(actor, "app1", 60.2, "web");
    expect(db.childApp.update).not.toHaveBeenCalled();
    expect(db.configChange.create).not.toHaveBeenCalled();
  });
});
