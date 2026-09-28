import "server-only";
import { randomUUID } from "node:crypto";
import type { StorePurchase } from "@prisma/client";
import { db } from "./db";
import { ServiceError, conflict, forbidden } from "./errors";
import { audit } from "./audit";
import type { Actor } from "./config-service";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";
import { shortDate } from "./format";
import { BASE_PLAN, type Interval, type PaidPlanId, planById, planByName, planByProduct, webPrice, webProduct, webProductFor } from "./plans";
import { applyEntitlement, currentPurchase, isEntitled } from "./entitlement";
import {
  type PaymongoConfig, type WebhookEvent, cancelSubscription, createCheckoutSession, createSubscription, customerFor, endOfBillingDay,
  getCheckoutSession, getPaymentIntent, getSubscription, paidPayment, paymongoConfig, planFor,
} from "./paymongo";

/**
 * Web payments through PayMongo, the only way to buy a plan for now (the apps show the plan but don't sell it).
 *
 * Plans are eGuard Plus and Family Pro, monthly.
 *
 * - Pass: one payment through PayMongo's hosted Checkout, any method (GCash, Maya, QR Ph, card, …).
 *   Adds a month; buying another of the same plan while one runs extends it. Reminded by email before it ends.
 * - Auto-renew: a PayMongo Subscription, card or Maya only. PayMongo charges every month; the first
 *   payment is made in the browser, which sends the card straight to PayMongo with the public key.
 *
 * Every change is re-read from PayMongo (after checkout, from webhooks, and by the maintenance job)
 * rather than trusted from the browser or the webhook body.
 */

type Fetch = typeof fetch;
export type WebBillingOpts = { cfg?: PaymongoConfig | null; fetch?: Fetch; now?: Date };

export const STORE = "PAYMONGO";

/** A checkout nobody paid within a day is abandoned (PayMongo's e-wallet and QR windows are far shorter). */
const ABANDONED_MS = 24 * 3600_000;
/** An auto-renew whose first payment is older than this can't be finished; PayMongo cancels it at 24 hours. */
const RESUMABLE_MS = 23 * 3600_000;
/** Passes get a reminder this long before they end. */
const REMIND_BEFORE_MS = 3 * 864e5;

const FREE_LIMITS = `${planByName(BASE_PLAN).entitlements.childLimit} child, no location sharing`;

/** Payment methods offered for passes. Each must be activated on the PayMongo account. */
export const passMethods = (env: Record<string, string | undefined> = process.env) =>
  (env.PAYMONGO_PASS_METHODS?.trim() || "gcash,paymaya,card,qrph").split(",").map((m) => m.trim()).filter(Boolean);

const cfgOf = (o: WebBillingOpts) => (o.cfg !== undefined ? o.cfg : paymongoConfig());

function requireConfig(o: WebBillingOpts): PaymongoConfig {
  const cfg = cfgOf(o);
  if (!cfg) throw new ServiceError(501, "Online payment isn't set up on this server yet.", "billing_not_configured");
  return cfg;
}

function requireAdmin(actor: Actor) {
  if (actor.role !== "FAMILY_ADMIN") throw forbidden("Only the family admin can change the plan.");
}

export const webBillingAvailable = () => !!paymongoConfig();

/** Adds one billing period, keeping the day of month where it exists (Jan 31 + 1 month = Feb 28). */
export function addInterval(from: Date, interval: Interval) {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  if (interval === "month") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * One way of paying at a time: nothing over a Google Play plan or an auto-renew that's on, and
 * auto-renew only once any paid time has run out (it charges straight away). A pass over a pass of the
 * same plan extends it; another plan waits until the paid time ends, so no paid days are lost.
 */
async function assertCanBuy(familyId: string, plan: PaidPlanId, autoRenew: boolean) {
  const current = await currentPurchase(familyId);
  if (!current) return;
  if (current.store === "GOOGLE_PLAY") throw conflict("Your plan is billed through Google Play. Change it in the Play Store app.");
  if (current.autoRenewing) throw conflict("Auto-renew is already on. Turn it off first to switch to a pass or another plan.");
  const family = await db.family.findUniqueOrThrow({ where: { id: familyId } });
  const until = shortDate(current.expiresAt!, family.timezone);
  if (autoRenew) throw conflict(`Your plan is paid until ${until}. Turn on auto-renew after that, or buy a pass to extend it.`);
  const now = planByProduct(current.productId);
  if (now && now.id !== plan) throw conflict(`Your ${now.name} pass runs until ${until}. Switch to ${planById(plan).name} after that, or buy another ${now.name} month to extend it.`);
}

/* ---------- Pass (Checkout) ---------- */

export async function buyPass(actor: Actor, planId: PaidPlanId, o: WebBillingOpts = {}) {
  requireAdmin(actor);
  const cfg = requireConfig(o);
  await assertCanBuy(actor.familyId, planId, false);
  const product = webProductFor(planId, false);
  const plan = planById(planId);
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  const id = randomUUID();
  const cs = await createCheckoutSession(cfg, {
    name: `${plan.name}: 1 month`,
    description: `Up to ${plan.entitlements.childLimit} children for one month. Doesn't renew automatically.`,
    amount: webPrice(planId),
    methods: passMethods(),
    email: user.email,
    reference: id,
    successUrl: `${appUrl()}/settings/subscription?ref=${id}`,
    cancelUrl: `${appUrl()}/settings/subscription`,
    metadata: { familyId: actor.familyId, purchaseId: id },
  }, o.fetch);
  await db.storePurchase.create({
    data: { id, familyId: actor.familyId, store: STORE, productId: product.id, purchaseToken: cs.id, state: "PENDING" },
  });
  return { purchaseId: id, checkoutUrl: cs.attributes.checkout_url };
}

async function syncPass(p: StorePurchase, cfg: PaymongoConfig, f: Fetch | undefined, now: Date) {
  if (p.state !== "PENDING") return;
  const cs = (await getCheckoutSession(cfg, p.purchaseToken, f)).attributes;
  const pay = paidPayment(cs);
  if (pay) {
    // Starts when the family's current paid time ends, so an early renewal loses nothing
    // Only time on the same plan counts; another plan over paid time is refused (assertCanBuy)
    const plan = planByProduct(p.productId);
    const others = (await db.storePurchase.findMany({ where: { familyId: p.familyId, id: { not: p.id } } })).filter((x) => planByProduct(x.productId) === plan);
    const paidUntil = Math.max(now.getTime(), ...others.filter((x) => isEntitled(x, now.getTime())).map((x) => x.expiresAt!.getTime()));
    const expiresAt = addInterval(new Date(paidUntil), webProduct(p.productId)!.interval);
    // Conditional, so the webhook and the parent's return from checkout can't both extend the plan
    const won = await db.storePurchase.updateMany({ where: { id: p.id, state: "PENDING" }, data: { state: "PAID", paymentId: pay.id, expiresAt, checkedAt: now } });
    if (won.count) await audit(p.familyId, "PayMongo", "purchase.paid", `${p.productId} ${(pay.attributes.amount / 100).toFixed(2)} PHP`);
  } else if (cs.status === "expired" || now.getTime() - p.createdAt.getTime() > ABANDONED_MS) {
    await db.storePurchase.updateMany({ where: { id: p.id, state: "PENDING" }, data: { state: "EXPIRED", checkedAt: now } });
  } else {
    await db.storePurchase.update({ where: { id: p.id }, data: { checkedAt: now } });
  }
}

/* ---------- Auto-renew (Subscriptions) ---------- */

export type FirstPayment = { purchaseId: string; paymentIntentId: string; clientKey: string; publicKey: string; amount: number; returnUrl: string };

async function firstPayment(cfg: PaymongoConfig, p: StorePurchase, paymentIntentId: string, f?: Fetch): Promise<FirstPayment> {
  const pi = (await getPaymentIntent(cfg, paymentIntentId, f)).attributes;
  return {
    purchaseId: p.id, paymentIntentId, clientKey: pi.client_key, publicKey: cfg.publicKey, amount: pi.amount,
    returnUrl: `${appUrl()}/settings/subscription?ref=${p.id}`,
  };
}

/**
 * Starts auto-renew and returns what the browser needs to make the first payment. Retrying picks up the
 * unfinished one instead of creating another; one for a different period is cancelled.
 */
export async function startAutoRenew(actor: Actor, planId: PaidPlanId, o: WebBillingOpts = {}): Promise<FirstPayment> {
  requireAdmin(actor);
  const cfg = requireConfig(o);
  const now = o.now ?? new Date();
  await assertCanBuy(actor.familyId, planId, true);
  const product = webProductFor(planId, true);

  // An old subscription whose renewals went unpaid would keep its open invoice collectible: close it
  for (const p of await db.storePurchase.findMany({ where: { familyId: actor.familyId, store: STORE, state: "unpaid" } })) {
    await cancelSubscription(cfg, p.purchaseToken, o.fetch).catch(() => {});
    await db.storePurchase.update({ where: { id: p.id }, data: { state: "cancelled", autoRenewing: false, checkedAt: now } });
  }
  const unfinished = await db.storePurchase.findMany({ where: { familyId: actor.familyId, store: STORE, state: "incomplete" } });
  for (const p of unfinished) {
    if (p.productId === product.id && now.getTime() - p.createdAt.getTime() < RESUMABLE_MS) {
      const s = (await getSubscription(cfg, p.purchaseToken, o.fetch)).attributes;
      const pi = s.latest_invoice?.payment_intent;
      if (s.status === "incomplete" && pi) return firstPayment(cfg, p, pi.id, o.fetch);
    }
    await cancelSubscription(cfg, p.purchaseToken, o.fetch).catch(() => {});
    await db.storePurchase.update({ where: { id: p.id }, data: { state: "incomplete_cancelled", checkedAt: now } });
  }

  const family = await db.family.findUniqueOrThrow({ where: { id: actor.familyId } });
  let customerId = family.paymongoCustomerId;
  if (!customerId) {
    const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
    customerId = await customerFor(cfg, { name: user.name, email: user.email }, o.fetch);
    await db.family.update({ where: { id: family.id }, data: { paymongoCustomerId: customerId } });
  }
  const paymongoPlan = await planFor(cfg, planById(planId).name, webPrice(planId), o.fetch);
  const sub = await createSubscription(cfg, customerId, paymongoPlan, o.fetch);
  const p = await db.storePurchase.create({
    data: { familyId: actor.familyId, store: STORE, productId: product.id, purchaseToken: sub.id, state: sub.attributes.status, checkedAt: now },
  });
  const pi = sub.attributes.latest_invoice?.payment_intent;
  if (!pi) throw new ServiceError(502, "PayMongo didn't create the first payment. Try again.", "payment_unavailable");
  return firstPayment(cfg, p, pi.id, o.fetch);
}

async function syncSubscription(p: StorePurchase, cfg: PaymongoConfig, f: Fetch | undefined, now: Date) {
  const s = (await getSubscription(cfg, p.purchaseToken, f)).attributes;
  const data: { state: string; autoRenewing: boolean; checkedAt: Date; expiresAt?: Date } = {
    state: s.status, autoRenewing: s.status === "active" || s.status === "past_due", checkedAt: now,
  };
  // Paid-through moves only when the latest invoice is paid, so a failed renewal never adds time
  if ((s.status === "active" || s.status === "cancelled") && s.latest_invoice?.status === "paid" && s.next_billing_schedule) {
    const end = endOfBillingDay(s.next_billing_schedule);
    if (!p.expiresAt || end > p.expiresAt) data.expiresAt = end;
  }
  await db.storePurchase.update({ where: { id: p.id }, data });
  if (p.state === "incomplete" && s.status === "active") await audit(p.familyId, "PayMongo", "purchase.verified", p.productId);
}

/** Turns auto-renew off. The family keeps the plan until the end of the period already paid for. */
export async function cancelAutoRenew(actor: Actor, o: WebBillingOpts = {}) {
  requireAdmin(actor);
  const cfg = requireConfig(o);
  const p = await db.storePurchase.findFirst({ where: { familyId: actor.familyId, store: STORE, autoRenewing: true } });
  if (!p) throw conflict("Auto-renew isn't on.");
  await cancelSubscription(cfg, p.purchaseToken, o.fetch);
  await db.storePurchase.update({ where: { id: p.id }, data: { state: "cancelled", autoRenewing: false, checkedAt: o.now ?? new Date() } });
  await audit(actor.familyId, actor.name, "autorenew.cancelled", p.productId);
  await applyEntitlement(actor.familyId);
  return { endsAt: p.expiresAt };
}

/** PayMongo subscription states that can still charge. */
const LIVE_SUBSCRIPTION = ["incomplete", "active", "past_due", "unpaid"];

/**
 * Cancels every PayMongo auto-renew the family still has, before the family is deleted: nothing may keep
 * charging an account that no longer exists. Throws if one can't be cancelled, so the deletion stops.
 */
export async function cancelSubscriptionsBeforeDeletion(familyId: string, o: WebBillingOpts = {}) {
  const subs = await db.storePurchase.findMany({ where: { familyId, store: STORE, purchaseToken: { startsWith: "subs_" }, state: { in: LIVE_SUBSCRIPTION } } });
  if (!subs.length) return;
  const stuck = () => conflict("We couldn't cancel your auto-renew with PayMongo, so your account wasn't deleted. Try again, or contact support.");
  const cfg = cfgOf(o);
  if (!cfg) throw stuck();
  for (const p of subs) {
    try {
      await cancelSubscription(cfg, p.purchaseToken, o.fetch);
    } catch {
      // Already cancelled on PayMongo's side is fine; anything else stops the deletion
      const s = (await getSubscription(cfg, p.purchaseToken, o.fetch).catch(() => null))?.attributes;
      if (!s || LIVE_SUBSCRIPTION.includes(s.status)) throw stuck();
    }
  }
}

/* ---------- Sync, webhooks ---------- */

/** Re-reads one PayMongo purchase (pass or auto-renew). The caller applies the entitlement. */
export async function syncWebPurchase(p: StorePurchase, o: WebBillingOpts = {}) {
  const cfg = requireConfig(o);
  const now = o.now ?? new Date();
  if (webProduct(p.productId)?.autoRenew) await syncSubscription(p, cfg, o.fetch, now);
  else await syncPass(p, cfg, o.fetch, now);
}

/**
 * The parent is back from checkout or card authentication (…/settings/subscription?ref=<id>). Checks the
 * payment right away rather than waiting for the webhook. Returns how it went, for the page to say.
 */
export async function confirmReturn(familyId: string, purchaseId: string, o: WebBillingOpts = {}) {
  const p = await db.storePurchase.findFirst({ where: { id: purchaseId, familyId, store: STORE } });
  if (!p) return null;
  if (p.state === "PENDING" || p.state === "incomplete") {
    try {
      await syncWebPurchase(p, o);
      await applyEntitlement(familyId);
    } catch (e) {
      if (!(e instanceof ServiceError)) throw e;
    }
  }
  const latest = await db.storePurchase.findUniqueOrThrow({ where: { id: p.id } });
  const kind = webProduct(latest.productId)?.autoRenew ? "autorenew" : "pass";
  const status = isEntitled(latest) ? "paid" : latest.state === "PENDING" || latest.state === "incomplete" ? "pending" : "failed";
  return { kind, status, expiresAt: latest.expiresAt } as const;
}

/**
 * A verified PayMongo webhook. The payload only says what changed; the purchase is re-read from PayMongo.
 * Refunds end a pass right away.
 */
export async function handlePaymongoEvent(e: WebhookEvent, o: WebBillingOpts = {}) {
  const r = e.resource;
  if (!r) return { handled: false };
  const a = r.attributes as Record<string, unknown>;
  let rows: StorePurchase[] = [];

  if (e.type === "refund.succeeded" || e.type === "refund.updated") {
    if (e.type === "refund.updated" && a.status !== "succeeded") return { handled: false };
    const paymentId = typeof a.payment_id === "string" ? a.payment_id : null;
    const hits = paymentId ? await db.storePurchase.findMany({ where: { paymentId, store: STORE, state: { not: "VOIDED" } } }) : [];
    for (const p of hits) {
      await db.storePurchase.update({ where: { id: p.id }, data: { state: "VOIDED", autoRenewing: false, checkedAt: new Date() } });
      await audit(p.familyId, "PayMongo", "purchase.voided", p.productId);
      await applyEntitlement(p.familyId);
    }
    return { handled: hits.length > 0 };
  }

  if (e.type.startsWith("checkout_session.")) {
    rows = await db.storePurchase.findMany({ where: { purchaseToken: r.id, store: STORE } });
  } else if (e.type.startsWith("subscription.")) {
    // subscription.* carry the subscription; subscription.invoice.* carry the invoice
    const nested = a.subscription as { id?: unknown } | undefined;
    const subId = r.type === "subscription" ? r.id : typeof a.subscription_id === "string" ? a.subscription_id : typeof nested?.id === "string" ? nested.id : null;
    if (subId) rows = await db.storePurchase.findMany({ where: { purchaseToken: subId, store: STORE } });
    else if (typeof a.customer_id === "string") {
      rows = await db.storePurchase.findMany({
        where: { store: STORE, family: { paymongoCustomerId: a.customer_id }, state: { in: ["incomplete", "active", "past_due", "unpaid"] } },
      });
    }
  } else return { handled: false };

  for (const p of rows) {
    await syncWebPurchase(p, o);
    await applyEntitlement(p.familyId);
  }
  return { handled: rows.length > 0 };
}

/* ---------- Pass reminders ---------- */

/**
 * Emails the family admin (and shows an alert) a few days before a pass ends, unless the family has
 * already extended it. Each pass is reminded once.
 */
export async function sendPassReminders(now = new Date()) {
  const due = await db.storePurchase.findMany({
    where: { store: STORE, state: "PAID", remindedAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + REMIND_BEFORE_MS) } },
  });
  let sent = 0;
  for (const p of due) {
    const later = await db.storePurchase.findMany({ where: { familyId: p.familyId, id: { not: p.id }, expiresAt: { gt: p.expiresAt! } } });
    if (later.some((x) => isEntitled(x, now.getTime()))) continue;
    const claimed = await db.storePurchase.updateMany({ where: { id: p.id, remindedAt: null }, data: { remindedAt: now } });
    if (!claimed.count) continue;
    const family = await db.family.findUniqueOrThrow({ where: { id: p.familyId }, include: { users: { where: { role: "FAMILY_ADMIN", emailVerifiedAt: { not: null } } } } });
    const ends = shortDate(p.expiresAt!, family.timezone);
    const plan = planByProduct(p.productId)?.name ?? family.plan;
    const link = `${appUrl()}/settings/subscription`;
    await db.alert.create({
      data: {
        familyId: p.familyId, severity: "INFO", category: "SYSTEM", icon: "crown", subject: "Subscription",
        title: `${family.plan} ends on ${ends}`, body: "Buy another pass or turn on auto-renew in Settings › Subscription to keep it.",
      },
    });
    for (const u of family.users) {
      try {
        await sendMail({
          to: u.email,
          subject: `Your ${plan} pass ends on ${ends}`,
          text: `Hi ${u.name.split(/\s+/)[0]},\n\nYour ${plan} pass ends on ${ends}. After that your family goes back to ${BASE_PLAN} (${FREE_LIMITS}). Children and devices already added stay protected.\n\nTo keep ${plan}, buy another pass or turn on auto-renew:\n${link}\n\n— eGuard`,
          html: `<p>Hi ${escapeHtml(u.name.split(/\s+/)[0])},</p><p>Your ${escapeHtml(plan)} pass ends on <b>${escapeHtml(ends)}</b>. After that your family goes back to ${BASE_PLAN} (${FREE_LIMITS}). Children and devices already added stay protected.</p>`
            + `<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">Keep ${escapeHtml(plan)}</a></p>`,
        });
        sent++;
      } catch (err) {
        console.error("[billing] pass reminder failed", p.id, err);
      }
    }
  }
  return { due: due.length, sent };
}
