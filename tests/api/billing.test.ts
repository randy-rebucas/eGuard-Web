import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { RECHECK_ACTIVE_MS, handlePlayNotification, redeemGooglePlay, refreshPurchases } from "@/lib/billing";
import { accessToken, googlePlayConfig, obfuscatedAccountId, summarize } from "@/lib/google-play";
import type { Actor } from "@/lib/config-service";
import { fakeGooglePlay, playSub } from "../fake-google-play";

/** Google Play subscriptions ("Upgrade to Family" on Android), against a fake Play API and the real database. */

const db = new PrismaClient();
const RUN = `b${Date.now().toString(36)}`;
const play = fakeGooglePlay();
const opts = { cfg: play.cfg, fetch: play.fetch };
let admin: Actor, parent: Actor, other: Actor;

async function family(name: string) {
  const f = await db.family.create({
    data: {
      name, plan: "eGuard Plus", deviceLimit: 8,
      users: { create: [
        { name: `${name} Admin`, email: `admin.${name.toLowerCase()}.${RUN}@billing-test.example`, passwordHash: "x", role: "FAMILY_ADMIN" },
        { name: `${name} Parent`, email: `parent.${name.toLowerCase()}.${RUN}@billing-test.example`, passwordHash: "x", role: "PARENT" },
      ] },
    },
    include: { users: true },
  });
  const [a, p] = ["FAMILY_ADMIN", "PARENT"].map((r) => f.users.find((u) => u.role === r)!);
  return [a, p].map((u) => ({ id: u.id, name: u.name, familyId: f.id, role: u.role })) as [Actor, Actor];
}

beforeAll(async () => {
  [admin, parent] = await family("Cruz");
  [other] = await family("Eve");
});
afterAll(async () => {
  await db.family.deleteMany({ where: { users: { some: { email: { endsWith: `.${RUN}@billing-test.example` } } } } });
  await db.$disconnect();
});

const acct = () => obfuscatedAccountId(admin.familyId);
const fam = () => db.family.findUniqueOrThrow({ where: { id: admin.familyId } });

describe("google play helpers", () => {
  it("reads config only when both env vars are valid", () => {
    expect(googlePlayConfig({})).toBeNull();
    expect(googlePlayConfig({ GOOGLE_PLAY_PACKAGE_NAME: "a.b", GOOGLE_PLAY_SERVICE_ACCOUNT: "{not json" })).toBeNull();
    expect(googlePlayConfig({ GOOGLE_PLAY_PACKAGE_NAME: "a.b", GOOGLE_PLAY_SERVICE_ACCOUNT: JSON.stringify(play.cfg.account) })?.packageName).toBe("a.b");
  });

  it("signs a service-account JWT that Google accepts, and caches the token", async () => {
    const before = play.calls.length;
    expect(await accessToken(play.cfg.account, play.fetch)).toBe("ya29.fake");
    expect(await accessToken(play.cfg.account, play.fetch)).toBe("ya29.fake");
    expect(play.calls.length - before).toBe(1);
  });

  it("gives access while active, in grace, or cancelled until expiry", () => {
    for (const state of ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"]) {
      expect(summarize(playSub({ state }), "eguard_family").entitled).toBe(true);
    }
    for (const state of ["SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED", "SUBSCRIPTION_STATE_EXPIRED", "SUBSCRIPTION_STATE_PENDING"]) {
      expect(summarize(playSub({ state }), "eguard_family").entitled).toBe(false);
    }
    expect(summarize(playSub({ state: "SUBSCRIPTION_STATE_CANCELED", expiresInMs: -1000 }), "eguard_family").entitled).toBe(false);
    expect(summarize(playSub({}), "other_product").entitled).toBe(false);
  });

  it("uses a stable, family-specific account id", () => {
    expect(obfuscatedAccountId("f1")).toBe(obfuscatedAccountId("f1"));
    expect(obfuscatedAccountId("f1")).not.toBe(obfuscatedAccountId("f2"));
    expect(obfuscatedAccountId("f1")).toHaveLength(64); // Play's limit
  });
});

describe("redeemGooglePlay", () => {
  it("upgrades the family, stores the purchase and acknowledges it", async () => {
    play.subs.set("tok-1", playSub({ accountId: acct() }));
    const r = await redeemGooglePlay(admin, "eguard_family", "tok-1", opts);
    expect(r).toMatchObject({ plan: "eGuard Family", autoRenewing: true });
    expect(await fam()).toMatchObject({ plan: "eGuard Family", deviceLimit: 15 });
    expect((await fam()).renewsAt?.getTime()).toBe(r.expiresAt?.getTime());
    expect(play.acknowledged).toEqual(["tok-1"]);
    expect(await db.alert.count({ where: { familyId: admin.familyId, title: "Welcome to eGuard Family" } })).toBe(1);
  });

  it("is safe to retry (restore purchases): no second acknowledgement or alert", async () => {
    await redeemGooglePlay(admin, "eguard_family", "tok-1", opts);
    expect(play.acknowledged).toEqual(["tok-1"]);
    expect(await db.alert.count({ where: { familyId: admin.familyId, title: "Welcome to eGuard Family" } })).toBe(1);
    expect(await db.storePurchase.count({ where: { familyId: admin.familyId } })).toBe(1);
  });

  it("refuses a token another family already redeemed", async () => {
    await expect(redeemGooglePlay(other, "eguard_family", "tok-1", opts)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a purchase made for a different family account", async () => {
    play.subs.set("tok-other", playSub({ accountId: obfuscatedAccountId(other.familyId) }));
    await expect(redeemGooglePlay(admin, "eguard_family", "tok-other", opts)).rejects.toMatchObject({ status: 403, code: "account_mismatch" });
    play.subs.set("tok-noacct", playSub({}));
    await expect(redeemGooglePlay(admin, "eguard_family", "tok-noacct", opts)).rejects.toMatchObject({ code: "account_mismatch" });
  });

  it("explains pending, inactive, unknown and wrong-product purchases", async () => {
    play.subs.set("tok-pending", playSub({ accountId: acct(), state: "SUBSCRIPTION_STATE_PENDING" }));
    await expect(redeemGooglePlay(admin, "eguard_family", "tok-pending", opts)).rejects.toMatchObject({ status: 409, code: "purchase_pending" });
    play.subs.set("tok-expired", playSub({ accountId: acct(), state: "SUBSCRIPTION_STATE_EXPIRED", expiresInMs: -864e5 }));
    await expect(redeemGooglePlay(admin, "eguard_family", "tok-expired", opts)).rejects.toMatchObject({ code: "not_active" });
    await expect(redeemGooglePlay(admin, "eguard_family", "tok-missing", opts)).rejects.toMatchObject({ status: 400, code: "invalid_purchase" });
    await expect(redeemGooglePlay(admin, "eguard_unknown", "tok-1", opts)).rejects.toMatchObject({ status: 400 });
    play.subs.set("tok-wrongprod", playSub({ accountId: acct(), productId: "something_else" }));
    await expect(redeemGooglePlay(admin, "eguard_family", "tok-wrongprod", opts)).rejects.toMatchObject({ status: 400 });
    expect(await db.storePurchase.count({ where: { familyId: admin.familyId } })).toBe(1);
  });

  it("is admin only, and 501 when Google Play isn't configured", async () => {
    await expect(redeemGooglePlay(parent, "eguard_family", "tok-1", opts)).rejects.toMatchObject({ status: 403 });
    await expect(redeemGooglePlay(admin, "eguard_family", "tok-1", { cfg: null })).rejects.toMatchObject({ status: 501, code: "billing_not_configured" });
  });

  it("marks the previous token replaced when Google links a new one", async () => {
    play.subs.set("tok-2", playSub({ accountId: acct(), linked: "tok-1", ack: true }));
    await redeemGooglePlay(admin, "eguard_family", "tok-2", opts);
    const rows = await db.storePurchase.findMany({ where: { familyId: admin.familyId }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => [r.purchaseToken, r.state])).toEqual([["tok-1", "REPLACED"], ["tok-2", "SUBSCRIPTION_STATE_ACTIVE"]]);
    expect(play.acknowledged).toEqual(["tok-1"]); // already acknowledged by the app flow → not again
  });
});

describe("refreshPurchases", () => {
  const lapse = () => db.storePurchase.updateMany({
    where: { purchaseToken: "tok-2" }, data: { expiresAt: new Date(Date.now() - 1000), checkedAt: new Date(Date.now() - 3600_000) },
  });

  it("does nothing while the paid period hasn't ended", async () => {
    const before = play.calls.length;
    await refreshPurchases(admin.familyId, opts);
    expect(play.calls.length).toBe(before);
  });

  it("keeps the plan when Google reports a renewal", async () => {
    await lapse();
    play.subs.set("tok-2", playSub({ accountId: acct(), ack: true, expiresInMs: 60 * 864e5 }));
    await refreshPurchases(admin.familyId, opts);
    const f = await fam();
    expect(f.plan).toBe("eGuard Family");
    expect(f.renewsAt!.getTime()).toBeGreaterThan(Date.now() + 50 * 864e5);
  });

  it("goes back to the base plan when the subscription expired", async () => {
    await lapse();
    play.subs.set("tok-2", playSub({ accountId: acct(), ack: true, state: "SUBSCRIPTION_STATE_EXPIRED", expiresInMs: -1000 }));
    await refreshPurchases(admin.familyId, opts);
    expect(await fam()).toMatchObject({ plan: "eGuard Plus", deviceLimit: 8, renewsAt: null });
    expect(await db.alert.count({ where: { familyId: admin.familyId, title: "eGuard Family ended" } })).toBe(1);
  });

  it("checks a lapsed purchase at most every 10 minutes", async () => {
    const before = play.calls.length;
    await refreshPurchases(admin.familyId, opts);
    expect(play.calls.length).toBe(before);
  });

  it("leaves families without store purchases alone", async () => {
    await refreshPurchases(other.familyId, opts);
    expect(await db.family.findUniqueOrThrow({ where: { id: other.familyId } })).toMatchObject({ plan: "eGuard Plus", deviceLimit: 8 });
  });
});

describe("refunds and Real-time Developer Notifications", () => {
  const redeem = async (token: string) => {
    play.subs.set(token, playSub({ accountId: acct(), ack: true }));
    await redeemGooglePlay(admin, "eguard_family", token, opts);
    expect((await fam()).plan).toBe("eGuard Family");
  };

  it("re-checks an active purchase once a day, so a revoked one ends before its paid period", async () => {
    await redeem("tok-3");
    play.subs.set("tok-3", playSub({ accountId: acct(), ack: true, state: "SUBSCRIPTION_STATE_EXPIRED", expiresInMs: -1000 }));
    // Checked recently: nothing happens yet
    await refreshPurchases(admin.familyId, opts);
    expect((await fam()).plan).toBe("eGuard Family");
    await db.storePurchase.updateMany({ where: { purchaseToken: "tok-3" }, data: { checkedAt: new Date(Date.now() - RECHECK_ACTIVE_MS - 1000) } });
    await refreshPurchases(admin.familyId, opts);
    expect(await fam()).toMatchObject({ plan: "eGuard Plus", deviceLimit: 8 });
  });

  it("a refund notification ends the plan right away, and the token can't be redeemed again", async () => {
    await redeem("tok-4");
    expect(await handlePlayNotification({ purchaseToken: "tok-4", voided: true }, opts)).toEqual({ handled: true });
    expect(await fam()).toMatchObject({ plan: "eGuard Plus", deviceLimit: 8 });
    expect((await db.storePurchase.findUniqueOrThrow({ where: { purchaseToken: "tok-4" } })).state).toBe("VOIDED");
    await expect(redeemGooglePlay(admin, "eguard_family", "tok-4", opts)).rejects.toMatchObject({ status: 409 });
    // A later routine refresh doesn't bring it back
    await db.storePurchase.updateMany({ where: { purchaseToken: "tok-4" }, data: { checkedAt: new Date(0) } });
    await refreshPurchases(admin.familyId, opts);
    expect((await fam()).plan).toBe("eGuard Plus");
  });

  it("a renewal notification moves the renewal date", async () => {
    await redeem("tok-5");
    play.subs.set("tok-5", playSub({ accountId: acct(), ack: true, expiresInMs: 90 * 864e5 }));
    await handlePlayNotification({ purchaseToken: "tok-5" }, opts);
    expect((await fam()).renewsAt!.getTime()).toBeGreaterThan(Date.now() + 80 * 864e5);
  });

  it("ignores tokens eGuard hasn't seen (the app redeems those)", async () => {
    expect(await handlePlayNotification({ purchaseToken: "tok-unknown" }, opts)).toEqual({ handled: false });
  });
});
