import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const tx = vi.hoisted(() => ({ storePurchase: { findUnique: vi.fn(), create: vi.fn() } }));
const db = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  family: { findUniqueOrThrow: vi.fn(async () => ({ timezone: "Asia/Manila" })) },
  alert: { create: vi.fn() },
}));
const ent = vi.hoisted(() => ({ applyEntitlement: vi.fn(), currentPurchase: vi.fn() }));
const audit = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ db }));
vi.mock("../audit", () => ({ audit }));
vi.mock("../entitlement", () => ent);
vi.mock("../web-billing", () => ({
  lockPaidTime: vi.fn(),
  addInterval: (d: Date) => new Date(d.getTime() + 30 * 864e5),
}));

const { grantComputerLaunchOffer, launchOfferOn } = await import("../launch-offer");

const now = new Date("2026-11-01T00:00:00Z");

describe("launchOfferOn", () => {
  it("is on only before PC_LAUNCH_OFFER_UNTIL, and off when it's unset or not a date", () => {
    expect(launchOfferOn({}, now.getTime())).toBe(false);
    expect(launchOfferOn({ PC_LAUNCH_OFFER_UNTIL: "soon" }, now.getTime())).toBe(false);
    expect(launchOfferOn({ PC_LAUNCH_OFFER_UNTIL: "2026-12-31" }, now.getTime())).toBe(true);
    expect(launchOfferOn({ PC_LAUNCH_OFFER_UNTIL: "2026-10-31" }, now.getTime())).toBe(false);
  });
});

describe("grantComputerLaunchOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PC_LAUNCH_OFFER_UNTIL", "2027-01-31");
    ent.currentPurchase.mockResolvedValue(null);
    tx.storePurchase.findUnique.mockResolvedValue(null);
  });

  it("gives a Free family one month of Plus as eGuard's own paid time, and tells them", async () => {
    const until = await grantComputerLaunchOffer("fam1", now);
    expect(until).toEqual(new Date(now.getTime() + 30 * 864e5));
    expect(tx.storePurchase.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      familyId: "fam1", store: "PROMO", productId: "plus_pass_month", purchaseToken: "promo:pc-launch:fam1", state: "PAID", expiresAt: until,
    }) });
    expect(ent.applyEntitlement).toHaveBeenCalledWith("fam1");
    expect((db.alert.create.mock.calls[0][0] as { data: { title: string } }).data.title).toBe("A month of eGuard Plus, on us");
  });

  it("only once per family", async () => {
    tx.storePurchase.findUnique.mockResolvedValue({ id: "earlier" });
    expect(await grantComputerLaunchOffer("fam1", now)).toBeNull();
    expect(tx.storePurchase.create).not.toHaveBeenCalled();
    expect(db.alert.create).not.toHaveBeenCalled();
  });

  it("not over paid time (a plan, a pass or a sponsor code) and not when the offer is off", async () => {
    ent.currentPurchase.mockResolvedValue({ store: "PAYMONGO" });
    expect(await grantComputerLaunchOffer("fam1", now)).toBeNull();
    ent.currentPurchase.mockResolvedValue(null);
    vi.stubEnv("PC_LAUNCH_OFFER_UNTIL", "");
    expect(await grantComputerLaunchOffer("fam1", now)).toBeNull();
    expect(tx.storePurchase.create).not.toHaveBeenCalled();
  });

  it("never fails the pairing that triggered it", async () => {
    tx.storePurchase.create.mockRejectedValue(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await grantComputerLaunchOffer("fam1", now)).toBeNull();
    err.mockRestore();
  });
});
