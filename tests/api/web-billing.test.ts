import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { refreshPurchases } from "@/lib/billing";
import {
  addInterval, buyPass, cancelAutoRenew, confirmReturn, handlePaymongoEvent, paidTimeName, sendPassReminders, startAutoRenew,
} from "@/lib/web-billing";
import { renewalWord } from "@/lib/entitlement";
import { endOfBillingDay, parseWebhookEvent, paymongoConfig, verifyWebhookSignature } from "@/lib/paymongo";
import { webPrice } from "@/lib/plans";
import type { Actor } from "@/lib/config-service";
import { fakePaymongo } from "../fake-paymongo";

/** Web payments through PayMongo (passes and auto-renew), against a fake PayMongo API and the real database. */

const db = new PrismaClient();
const RUN = `w${Date.now().toString(36)}`;
const pm = fakePaymongo();
const opts = { cfg: pm.cfg, fetch: pm.fetch };
let admin: Actor, parent: Actor, other: Actor, played: Actor;

async function family(name: string) {
  const f = await db.family.create({
    data: {
      name, plan: "Free", deviceLimit: 2,
      users: { create: [
        { name: `${name} Admin`, email: `admin.${name.toLowerCase()}.${RUN}@web-billing-test.example`, passwordHash: "x", role: "FAMILY_ADMIN", emailVerifiedAt: new Date() },
        { name: `${name} Parent`, email: `parent.${name.toLowerCase()}.${RUN}@web-billing-test.example`, passwordHash: "x", role: "PARENT" },
      ] },
    },
    include: { users: true },
  });
  const [a, p] = ["FAMILY_ADMIN", "PARENT"].map((r) => f.users.find((u) => u.role === r)!);
  return [a, p].map((u) => ({ id: u.id, name: u.name, familyId: f.id, role: u.role })) as [Actor, Actor];
}

beforeAll(async () => {
  [admin, parent] = await family("Reyes");
  [other] = await family("Santos");
  [played] = await family("Lim");
});
afterAll(async () => {
  await db.family.deleteMany({ where: { users: { some: { email: { endsWith: `.${RUN}@web-billing-test.example` } } } } });
  await db.$disconnect();
});

const fam = (a: Actor = admin) => db.family.findUniqueOrThrow({ where: { id: a.familyId } });
const row = (purchaseToken: string) => db.storePurchase.findUniqueOrThrow({ where: { purchaseToken } });
const event = (type: string, resource: { id: string; type: string; attributes?: object }) => {
  const w = pm.webhook(type, resource);
  return parseWebhookEvent(w.raw)!;
};
const DAY = 864e5;

describe("paymongo helpers", () => {
  it("reads config only with both keys of the same mode", () => {
    expect(paymongoConfig({})).toBeNull();
    expect(paymongoConfig({ PAYMONGO_SECRET_KEY: "sk_test_a" })).toBeNull();
    expect(paymongoConfig({ PAYMONGO_SECRET_KEY: "sk_live_a", PAYMONGO_PUBLIC_KEY: "pk_test_a" })).toBeNull();
    expect(paymongoConfig({ PAYMONGO_SECRET_KEY: "sk_live_a", PAYMONGO_PUBLIC_KEY: "pk_live_a", PAYMONGO_WEBHOOK_SECRET: "whsk" }))
      .toMatchObject({ livemode: true, webhookSecret: "whsk" });
    expect(paymongoConfig({ PAYMONGO_SECRET_KEY: "sk_test_a", PAYMONGO_PUBLIC_KEY: "pk_test_a" })).toMatchObject({ livemode: false, webhookSecret: null });
  });

  it("verifies webhook signatures for the key's mode only", () => {
    const w = pm.webhook("checkout_session.payment.paid", { id: "cs_x", type: "checkout_session" });
    expect(verifyWebhookSignature(w.header, w.raw, "whsk_fake", false)).toBe(true);
    expect(verifyWebhookSignature(w.header, w.raw, "whsk_fake", true)).toBe(false); // a test event can't pass as live
    expect(verifyWebhookSignature(w.header, w.raw.replace("cs_x", "cs_y"), "whsk_fake", false)).toBe(false);
    expect(verifyWebhookSignature(w.header, w.raw, "other_secret", false)).toBe(false);
    expect(verifyWebhookSignature(null, w.raw, "whsk_fake", false)).toBe(false);
    const live = pm.webhook("checkout_session.payment.paid", { id: "cs_x", type: "checkout_session" }, { livemode: true });
    expect(verifyWebhookSignature(live.header, live.raw, "whsk_fake", true)).toBe(true);
    expect(parseWebhookEvent(w.raw)).toMatchObject({ type: "checkout_session.payment.paid", livemode: false, resource: { id: "cs_x" } });
    expect(parseWebhookEvent("not json")).toBeNull();
  });

  it("adds a period, keeping the day of month where it exists", () => {
    expect(addInterval(new Date("2026-01-31T10:00:00Z"), "month").toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addInterval(new Date("2028-01-31T10:00:00Z"), "month").toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addInterval(new Date("2026-03-15T10:00:00Z"), "month").toISOString()).toBe("2026-04-15T10:00:00.000Z");
    expect(addInterval(new Date("2028-02-29T10:00:00Z"), "year").toISOString()).toBe("2029-02-28T10:00:00.000Z");
  });

  it("reads monthly prices from env, in centavos, defaulting to the listed prices", () => {
    expect(webPrice("PLUS", {})).toBe(14900);
    expect(webPrice("PRO", {})).toBe(24900);
    expect(webPrice("PLUS", { PRICE_PLUS_MONTHLY: "159.50" })).toBe(15950);
    expect(() => webPrice("PRO", { PRICE_PRO_MONTHLY: "free" })).toThrow();
  });

  it("reads yearly prices from env too: ten months for twelve by default", () => {
    expect(webPrice("PLUS", {}, "year")).toBe(149000);
    expect(webPrice("PRO", {}, "year")).toBe(249000);
    expect(webPrice("PLUS", { PRICE_PLUS_YEARLY: "1790" }, "year")).toBe(179000);
    // A monthly override doesn't move the yearly price, and a bad yearly one fails loudly
    expect(webPrice("PRO", { PRICE_PRO_MONTHLY: "299" }, "year")).toBe(249000);
    expect(() => webPrice("PRO", { PRICE_PRO_YEARLY: "0" }, "year")).toThrow();
  });
});

describe("passes (pay once)", () => {
  let first: string, second: string;

  it("is admin only, and 501 when PayMongo isn't configured", async () => {
    await expect(buyPass(parent, "PRO", opts)).rejects.toMatchObject({ status: 403 });
    await expect(buyPass(admin, "PRO", { cfg: null })).rejects.toMatchObject({ status: 501, code: "billing_not_configured" });
  });

  it("needs a verified email, since PayMongo sends the receipt there", async () => {
    const [unverified] = await family("Ocampo");
    await db.user.update({ where: { id: unverified.id }, data: { emailVerifiedAt: null } });
    const refused = { status: 403, code: "email_unverified", message: expect.stringContaining("pay for a plan") };
    await expect(buyPass(unverified, "PRO", opts)).rejects.toMatchObject(refused);
    await expect(startAutoRenew(unverified, "PRO", opts)).rejects.toMatchObject(refused);
    expect(await db.storePurchase.count({ where: { familyId: unverified.familyId } })).toBe(0);
  });

  it("opens a checkout and waits for the payment", async () => {
    const r = await buyPass(admin, "PRO", opts);
    expect(r.checkoutUrl).toMatch(/^https:\/\/checkout\.paymongo\.test\/cs_/);
    first = r.checkoutUrl.split("/").pop()!;
    expect(await row(first)).toMatchObject({ store: "PAYMONGO", productId: "pro_pass_month", state: "PENDING" });
    expect(pm.sessions.get(first)!.amount).toBe(24900);
    // Back from checkout without paying
    expect(await confirmReturn(admin.familyId, r.purchaseId, opts)).toMatchObject({ status: "pending" });
    expect((await fam()).plan).toBe("Free");
  });

  it("upgrades once paid, a month from now, and a repeated webhook adds nothing", async () => {
    const paymentId = pm.pay(first);
    expect(await handlePaymongoEvent(event("checkout_session.payment.paid", { id: first, type: "checkout_session" }), opts)).toEqual({ handled: true });
    const p = await row(first);
    expect(p).toMatchObject({ state: "PAID", paymentId, autoRenewing: false });
    expect(Math.abs(p.expiresAt!.getTime() - addInterval(p.checkedAt, "month").getTime())).toBeLessThan(5000);
    expect(await fam()).toMatchObject({ plan: "eGuard Family", childLimit: 6, deviceLimit: 12 });
    expect((await fam()).renewsAt!.getTime()).toBe(p.expiresAt!.getTime());
    await handlePaymongoEvent(event("checkout_session.payment.paid", { id: first, type: "checkout_session" }), opts);
    expect((await row(first)).expiresAt!.getTime()).toBe(p.expiresAt!.getTime());
    expect(await db.alert.count({ where: { familyId: admin.familyId, title: "Welcome to eGuard Family" } })).toBe(1);
    expect(await confirmReturn(admin.familyId, p.id, opts)).toMatchObject({ status: "paid", kind: "pass" });
  });

  it("another pass of the same plan extends from the end of the current one", async () => {
    const r = await buyPass(admin, "PRO", opts);
    second = r.checkoutUrl.split("/").pop()!;
    pm.pay(second);
    expect(await confirmReturn(admin.familyId, r.purchaseId, opts)).toMatchObject({ status: "paid" });
    const [a, b] = [await row(first), await row(second)];
    expect(b.expiresAt!.getTime()).toBe(addInterval(a.expiresAt!, "month").getTime());
    expect((await fam()).renewsAt!.getTime()).toBe(b.expiresAt!.getTime());
  });

  it("won't start auto-renew, or sell another plan, while paid time is left", async () => {
    await expect(startAutoRenew(admin, "PRO", opts)).rejects.toMatchObject({ status: 409 });
    await expect(buyPass(admin, "PLUS", opts)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("eGuard Family pass runs until") });
  });

  it("a partial refund leaves the pass running; once refunds add up to the payment, it ends", async () => {
    const b = await row(second);
    // A goodwill credit of ₱50 out of ₱249
    expect(await handlePaymongoEvent(event("refund.succeeded", pm.refund(b.paymentId!, 5000)), opts)).toEqual({ handled: true, partial: true });
    expect((await row(second)).state).toBe("PAID");
    expect((await fam()).plan).toBe("eGuard Family");
    // The rest refunded later: together that's the whole payment
    expect(await handlePaymongoEvent(event("refund.succeeded", pm.refund(b.paymentId!, 24900 - 5000)), opts)).toEqual({ handled: true });
    expect((await row(second)).state).toBe("VOIDED");
  });

  it("a full refund ends that pass right away", async () => {
    expect((await fam()).renewsAt!.getTime()).toBe((await row(first)).expiresAt!.getTime());
    expect(await handlePaymongoEvent(event("refund.succeeded", pm.refund((await row(first)).paymentId!)), opts)).toEqual({ handled: true });
    expect(await fam()).toMatchObject({ plan: "Free", childLimit: 1, deviceLimit: 1, renewsAt: null });
  });

  it("a Plus pass gives eGuard Plus", async () => {
    const r = await buyPass(other, "PLUS", opts);
    const cs = r.checkoutUrl.split("/").pop()!;
    expect(pm.sessions.get(cs)!.amount).toBe(14900);
    pm.pay(cs);
    await confirmReturn(other.familyId, r.purchaseId, opts);
    expect(await fam(other)).toMatchObject({ plan: "eGuard Plus", childLimit: 3, deviceLimit: 5 });
    // Refunded again, so the auto-renew tests below start from Free
    await handlePaymongoEvent(event("refund.succeeded", pm.refund((await row(cs)).paymentId!)), opts);
    expect((await fam(other)).plan).toBe("Free");
  });

  it("gives up on a checkout nobody paid within a day", async () => {
    const r = await buyPass(admin, "PRO", opts);
    const cs = r.checkoutUrl.split("/").pop()!;
    await db.storePurchase.update({ where: { purchaseToken: cs }, data: { createdAt: new Date(Date.now() - 2 * DAY), checkedAt: new Date(Date.now() - DAY) } });
    await refreshPurchases(admin.familyId, { web: opts });
    expect((await row(cs)).state).toBe("EXPIRED");
  });

  it("a checkout for another plan, paid after a plan was bought, waits for that plan's time instead of overlapping it", async () => {
    const [cruz] = await family("Cruz");
    const plus = (await buyPass(cruz, "PLUS", opts)).checkoutUrl.split("/").pop()!;
    const pro = (await buyPass(cruz, "PRO", opts)).checkoutUrl.split("/").pop()!; // both open before either is paid
    pm.pay(pro);
    await handlePaymongoEvent(event("checkout_session.payment.paid", { id: pro, type: "checkout_session" }), opts);
    pm.pay(plus);
    await handlePaymongoEvent(event("checkout_session.payment.paid", { id: plus, type: "checkout_session" }), opts);
    const [a, b] = [await row(pro), await row(plus)];
    expect(b.expiresAt!.getTime()).toBe(addInterval(a.expiresAt!, "month").getTime());
    expect((await fam(cruz)).plan).toBe("eGuard Family");
  });

  it("doesn't sell over a Google Play plan", async () => {
    await db.storePurchase.create({
      data: { familyId: played.familyId, store: "GOOGLE_PLAY", productId: "eguard_family", purchaseToken: `play-${RUN}`, state: "SUBSCRIPTION_STATE_ACTIVE", autoRenewing: true, expiresAt: new Date(Date.now() + 20 * DAY) },
    });
    await expect(buyPass(played, "PRO", opts)).rejects.toMatchObject({ status: 409 });
    await expect(startAutoRenew(played, "PRO", opts)).rejects.toMatchObject({ status: 409 });
  });
});

describe("auto-renew", () => {
  let sub: string, purchaseId: string;

  it("starts a subscription and hands the browser the first payment", async () => {
    const p = await startAutoRenew(admin, "PRO", opts);
    expect(p).toMatchObject({ publicKey: "pk_test_fake", amount: 24900 });
    expect(p.clientKey).toMatch(/_client_/);
    expect(p.returnUrl).toContain(`/settings/subscription?ref=${p.purchaseId}`);
    purchaseId = p.purchaseId;
    const r = await db.storePurchase.findUniqueOrThrow({ where: { id: p.purchaseId } });
    sub = r.purchaseToken;
    expect(r).toMatchObject({ productId: "pro_monthly", state: "incomplete", autoRenewing: false });
    const f = await fam();
    expect(f.paymongoCustomerId).toMatch(/^cus_/);
    expect(pm.plans[0].attributes).toMatchObject({ name: "eGuard Family monthly 249.00 PHP", amount: 24900, interval: "monthly", interval_count: 1, currency: "PHP" });
  });

  it("retrying picks up the unfinished subscription instead of creating another", async () => {
    const before = pm.subs.size;
    const again = await startAutoRenew(admin, "PRO", opts);
    expect(again.purchaseId).toBe(purchaseId);
    expect(pm.subs.size).toBe(before);
    expect(pm.plans).toHaveLength(1);
  });

  it("paid at PayMongo before eGuard heard of it: starting again records it instead of cancelling it", async () => {
    pm.activate(sub, "2099-01-15"); // no webhook, no return from the payment page
    await expect(startAutoRenew(admin, "PLUS", opts)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Auto-renew is already on") });
    expect(pm.subs.get(sub)!.status).toBe("active");
    expect(await row(sub)).toMatchObject({ state: "active", autoRenewing: true });
    expect((await fam()).plan).toBe("eGuard Family");
    await expect(startAutoRenew(admin, "PRO", opts)).rejects.toMatchObject({ status: 409 });
  });

  it("two windows starting auto-renew at once create one subscription", async () => {
    const [ang] = await family("Ang");
    const before = pm.subs.size;
    const r = await Promise.allSettled([startAutoRenew(ang, "PLUS", opts), startAutoRenew(ang, "PLUS", opts), startAutoRenew(ang, "PLUS", opts)]);
    expect(pm.subs.size - before).toBe(1);
    expect(await db.storePurchase.count({ where: { familyId: ang.familyId } })).toBe(1);
    for (const x of r) if (x.status === "rejected") expect(x.reason).toMatchObject({ status: 429 });
    // Afterwards a retry resumes it
    expect(await startAutoRenew(ang, "PLUS", opts)).toMatchObject({ amount: 14900 });
    expect(pm.subs.size - before).toBe(1);
  });

  it("activates when the first invoice is paid", async () => {
    pm.activate(sub, "2099-01-15");
    await handlePaymongoEvent(event("subscription.activated", { id: sub, type: "subscription" }), opts);
    expect(await row(sub)).toMatchObject({ state: "active", autoRenewing: true });
    expect((await row(sub)).expiresAt!.toISOString()).toBe(endOfBillingDay("2099-01-15").toISOString());
    expect(await fam()).toMatchObject({ plan: "eGuard Family", childLimit: 6, deviceLimit: 12 });
    expect(await confirmReturn(admin.familyId, purchaseId, opts)).toMatchObject({ status: "paid", kind: "autorenew" });
  });

  it("doesn't sell a pass while auto-renew is on", async () => {
    await expect(buyPass(admin, "PRO", opts)).rejects.toMatchObject({ status: 409 });
  });

  it("moves the paid-through date on a renewal invoice", async () => {
    pm.activate(sub, "2099-02-15");
    await handlePaymongoEvent(event("subscription.invoice.paid", { id: "inv_x", type: "invoice", attributes: { subscription_id: sub } }), opts);
    expect((await row(sub)).expiresAt!.toISOString()).toBe(endOfBillingDay("2099-02-15").toISOString());
  });

  it("never adds time while a renewal is unpaid, and keeps a grace period", async () => {
    pm.setSub(sub, { status: "past_due", next_billing_schedule: "2099-03-15", latest_invoice: { id: "inv_2", status: "open", payment_intent: null } });
    await handlePaymongoEvent(event("subscription.past_due", { id: sub, type: "subscription" }), opts);
    const r = await row(sub);
    expect(r.state).toBe("past_due");
    expect(r.expiresAt!.toISOString()).toBe(endOfBillingDay("2099-02-15").toISOString());
    // Just past the paid-through date, still within the retry window
    await db.storePurchase.update({ where: { id: r.id }, data: { expiresAt: new Date(Date.now() - DAY) } });
    await handlePaymongoEvent(event("subscription.updated", { id: sub, type: "subscription" }), opts);
    expect((await fam()).plan).toBe("eGuard Family");
  });

  it("drops to the base plan when renewals stay unpaid", async () => {
    pm.setSub(sub, { status: "unpaid" });
    await handlePaymongoEvent(event("subscription.unpaid", { id: sub, type: "subscription" }), opts);
    expect(await fam()).toMatchObject({ plan: "Free", childLimit: 1, deviceLimit: 1 });
    expect(await db.alert.count({ where: { familyId: admin.familyId, title: "eGuard Family ended" } })).toBeGreaterThanOrEqual(1);
  });

  it("starting again closes the unpaid subscription at PayMongo", async () => {
    await startAutoRenew(admin, "PRO", opts);
    expect(pm.subs.get(sub)!.status).toBe("cancelled");
    expect((await row(sub)).state).toBe("cancelled");
  });

  it("turning auto-renew off keeps the plan until the paid period ends", async () => {
    const p = await startAutoRenew(other, "PLUS", opts);
    const token = (await db.storePurchase.findUniqueOrThrow({ where: { id: p.purchaseId } })).purchaseToken;
    pm.activate(token, "2099-06-01");
    await confirmReturn(other.familyId, p.purchaseId, opts);
    expect((await fam(other)).plan).toBe("eGuard Plus");
    await expect(cancelAutoRenew(parent, opts)).rejects.toMatchObject({ status: 403 });
    const r = await cancelAutoRenew(other, opts);
    expect(r.endsAt!.toISOString()).toBe(endOfBillingDay("2099-06-01").toISOString());
    expect(pm.subs.get(token)!.status).toBe("cancelled");
    expect(await row(token)).toMatchObject({ state: "cancelled", autoRenewing: false });
    expect(await fam(other)).toMatchObject({ plan: "eGuard Plus" });
    await expect(cancelAutoRenew(other, opts)).rejects.toMatchObject({ status: 409 });
  });
});

describe("pass reminders", () => {
  it("reminds once, a few days before a pass ends, unless it's been extended", async () => {
    const [tan] = await family("Tan");
    const soon = await db.storePurchase.create({
      data: { familyId: tan.familyId, store: "PAYMONGO", productId: "family_pass_month", purchaseToken: `cs_soon_${RUN}`, state: "PAID", expiresAt: new Date(Date.now() + 2 * DAY) },
    });
    const extended = await db.storePurchase.create({
      data: { familyId: other.familyId, store: "PAYMONGO", productId: "family_pass_month", purchaseToken: `cs_ext_${RUN}`, state: "PAID", expiresAt: new Date(Date.now() + 2 * DAY) },
    }); // "other" has auto-renew paid until 2099
    await sendPassReminders();
    expect((await db.storePurchase.findUniqueOrThrow({ where: { id: soon.id } })).remindedAt).not.toBeNull();
    expect((await db.storePurchase.findUniqueOrThrow({ where: { id: extended.id } })).remindedAt).toBeNull();
    const alerts = () => db.alert.count({ where: { familyId: tan.familyId, title: { contains: "ends on" } } });
    expect(await alerts()).toBe(1);
    await sendPassReminders();
    expect(await alerts()).toBe(1);
  });

  it("reminds about auto-renew that was turned off, as it ends the same way", async () => {
    const [go] = await family("Go");
    const off = await db.storePurchase.create({
      data: { familyId: go.familyId, store: "PAYMONGO", productId: "plus_monthly", purchaseToken: `subs_off_${RUN}`, state: "cancelled", expiresAt: new Date(Date.now() + 2 * DAY) },
    });
    await sendPassReminders();
    expect((await db.storePurchase.findUniqueOrThrow({ where: { id: off.id } })).remindedAt).not.toBeNull();
  });
});

describe("renewal wording", () => {
  it("says a failed renewal failed, not that it renews on a date that has passed", () => {
    expect(renewalWord({ autoRenewing: true, state: "past_due" })).toBe("Renewal failed");
    expect(renewalWord({ autoRenewing: true, state: "active" })).toBe("Renews");
    expect(renewalWord({ autoRenewing: false, state: "PAID" })).toBe("Ends");
    expect(renewalWord(null)).toBe("Renews");
  });
  it("names paid time by what it is", () => {
    expect(paidTimeName({ store: "PAYMONGO", productId: "plus_pass_month" })).toBe("eGuard Plus pass");
    expect(paidTimeName({ store: "PAYMONGO", productId: "plus_monthly" })).toBe("eGuard Plus");
    expect(paidTimeName({ store: "VOUCHER", productId: "pro_pass_month" })).toBe("sponsored eGuard Family");
  });
});

describe("yearly", () => {
  let yearPass: Actor, yearRenew: Actor;
  beforeAll(async () => {
    [yearPass] = await family("Annual");
    [yearRenew] = await family("Yearly");
  });

  it("a yearly pass charges the yearly price and lasts a year", async () => {
    const r = await buyPass(yearPass, "PLUS", { ...opts, interval: "year" });
    const cs = r.checkoutUrl.split("/").pop()!;
    expect(await row(cs)).toMatchObject({ productId: "plus_pass_year", state: "PENDING" });
    expect(pm.sessions.get(cs)!.amount).toBe(149000);
    pm.pay(cs);
    expect(await confirmReturn(yearPass.familyId, r.purchaseId, opts)).toMatchObject({ status: "paid" });
    const p = await row(cs);
    expect(Math.abs(p.expiresAt!.getTime() - addInterval(p.checkedAt, "year").getTime())).toBeLessThan(5000);
    expect(await fam(yearPass)).toMatchObject({ plan: "eGuard Plus", childLimit: 3, deviceLimit: 5 });
  });

  it("a month added to a yearly pass of the same plan starts when the year ends", async () => {
    const before = await db.storePurchase.findFirstOrThrow({ where: { familyId: yearPass.familyId, state: "PAID" } });
    const r = await buyPass(yearPass, "PLUS", opts);
    const cs = r.checkoutUrl.split("/").pop()!;
    pm.pay(cs);
    await confirmReturn(yearPass.familyId, r.purchaseId, opts);
    expect((await row(cs)).expiresAt!.getTime()).toBe(addInterval(before.expiresAt!, "month").getTime());
  });

  it("yearly auto-renew uses its own PayMongo plan, billed every year", async () => {
    const p = await startAutoRenew(yearRenew, "PRO", { ...opts, interval: "year" });
    expect(p.amount).toBe(249000);
    expect(await db.storePurchase.findUniqueOrThrow({ where: { id: p.purchaseId } })).toMatchObject({ productId: "pro_yearly", state: "incomplete" });
    expect(pm.plans.find((x) => x.attributes.name === "eGuard Family yearly 2490.00 PHP")?.attributes).toMatchObject({ amount: 249000, interval: "yearly", interval_count: 1 });
  });

  it("asking for monthly instead replaces the unfinished yearly one", async () => {
    const p = await startAutoRenew(yearRenew, "PRO", opts);
    expect(p.amount).toBe(24900);
    expect(await db.storePurchase.findUniqueOrThrow({ where: { id: p.purchaseId } })).toMatchObject({ productId: "pro_monthly" });
    expect(await db.storePurchase.count({ where: { familyId: yearRenew.familyId, productId: "pro_yearly", state: "incomplete_cancelled" } })).toBe(1);
  });
});
