import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  storePurchase: { findMany: vi.fn() },
  family: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  alert: { create: vi.fn() },
}));
vi.mock("../db", () => ({ db }));
vi.mock("../audit", () => ({ audit: vi.fn() }));
vi.mock("../plan-access", () => ({ clearCurrentLocations: vi.fn() }));
vi.mock("../google-play", () => ({ ENTITLED_STATES: ["ACTIVE"] }));

const { applyEntitlement } = await import("../entitlement");

const later = new Date(Date.now() + 30 * 864e5);
const paid = (productId: string) => ({ productId, store: "PAYMONGO", state: "PAID", expiresAt: later });
const family = (f: Partial<{ plan: string; childLimit: number; deviceLimit: number; legacyLimits: boolean }>) =>
  db.family.findUniqueOrThrow.mockResolvedValue({ id: "f1", plan: "Free", childLimit: 1, deviceLimit: 1, legacyLimits: false, renewsAt: null, ...f });
const saved = () => db.family.update.mock.calls[0][0].data;

describe("applyEntitlement limits", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gives a new subscriber the current limits", async () => {
    family({});
    db.storePurchase.findMany.mockResolvedValue([paid("plus_pass_month")]);
    await applyEntitlement("f1");
    expect(saved()).toMatchObject({ plan: "eGuard Plus", childLimit: 3, deviceLimit: 5, legacyLimits: false });
  });

  it("keeps the old limits for a family subscribed before the change, also when it moves up", async () => {
    family({ plan: "eGuard Plus", childLimit: 5, deviceLimit: 10, legacyLimits: true });
    db.storePurchase.findMany.mockResolvedValue([paid("pro_pass_month")]);
    await applyEntitlement("f1");
    expect(saved()).toMatchObject({ plan: "eGuard Family", childLimit: 10, deviceLimit: 20, legacyLimits: true });
  });

  it("ends the old limits once the family is back on Free", async () => {
    family({ plan: "eGuard Plus", childLimit: 5, deviceLimit: 10, legacyLimits: true });
    db.storePurchase.findMany.mockResolvedValue([{ ...paid("plus_pass_month"), expiresAt: new Date(Date.now() - 864e5) }]);
    await applyEntitlement("f1");
    expect(saved()).toMatchObject({ plan: "Free", childLimit: 1, deviceLimit: 1, legacyLimits: false });
  });
});
