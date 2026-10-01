import "server-only";
import { db } from "./db";
import { ServiceError, conflict, forbidden, invalid } from "./errors";
import { audit } from "./audit";
import type { Actor } from "./config-service";
import { planByGoogleProduct } from "./plans";
import { acknowledge, getSubscription, googlePlayConfig, obfuscatedAccountId, summarize, type GooglePlayConfig } from "./google-play";
import { CLOSED_STATES, applyEntitlement, openPurchases } from "./entitlement";
import { STORE as PAYMONGO, syncWebPurchase, type WebBillingOpts } from "./web-billing";

export { currentPurchase, familiesWithPurchases } from "./entitlement";

/**
 * Store subscriptions. The app completes the purchase with Google Play Billing, then hands the
 * purchase token to eGuard, which verifies it with Google before changing the family's plan.
 * Web purchases (PayMongo) are in web-billing.ts; refreshPurchases re-checks both.
 */

type Fetch = typeof fetch;

function requireConfig(cfg: GooglePlayConfig | null): GooglePlayConfig {
  if (!cfg) throw new ServiceError(501, "Google Play billing isn't set up on this server.", "billing_not_configured");
  return cfg;
}

/** Verifies a Google Play subscription purchase and upgrades the family. Idempotent: safe to retry with the same token. */
export async function redeemGooglePlay(actor: Actor, productId: string, purchaseToken: string, opts: { cfg?: GooglePlayConfig | null; fetch?: Fetch } = {}) {
  if (actor.role !== "FAMILY_ADMIN") throw forbidden("Only the family admin can change the plan.");
  const cfg = requireConfig(opts.cfg !== undefined ? opts.cfg : googlePlayConfig());
  const plan = planByGoogleProduct(productId);
  if (!plan) throw invalid("Unknown subscription product.");

  const existing = await db.storePurchase.findUnique({ where: { purchaseToken } });
  if (existing && existing.familyId !== actor.familyId) throw conflict("This purchase is already linked to another eGuard family.");
  if (existing?.state === "VOIDED") throw conflict("This purchase was refunded. Buy the plan again to upgrade.");

  const s = summarize(await getSubscription(cfg, purchaseToken, opts.fetch), productId);
  if (!s.productMatches) throw invalid("This purchase is for a different product.");
  if (s.accountId !== obfuscatedAccountId(actor.familyId)) throw new ServiceError(403, "This purchase was made for a different eGuard family.", "account_mismatch");
  if (s.state === "SUBSCRIPTION_STATE_PENDING") throw new ServiceError(409, "Your payment is still pending. We'll upgrade your plan once Google Play confirms it.", "purchase_pending");
  if (!s.entitled) throw new ServiceError(409, "This subscription isn't active.", "not_active");

  const data = { familyId: actor.familyId, store: "GOOGLE_PLAY", productId, state: s.state, autoRenewing: s.autoRenewing, expiresAt: s.expiresAt, checkedAt: new Date() };
  await db.storePurchase.upsert({ where: { purchaseToken }, create: { ...data, purchaseToken }, update: data });
  // An upgrade, downgrade or resubscribe replaces the previous token
  if (s.linkedPurchaseToken) await db.storePurchase.updateMany({ where: { purchaseToken: s.linkedPurchaseToken, familyId: actor.familyId }, data: { state: "REPLACED" } });
  await applyEntitlement(actor.familyId);
  if (s.needsAcknowledge) await acknowledge(cfg, productId, purchaseToken, opts.fetch);
  if (!existing) await audit(actor.familyId, actor.name, "purchase.verified", `${productId}${s.test ? " (test)" : ""}`);
  return { plan: plan.name, expiresAt: s.expiresAt, autoRenewing: s.autoRenewing, test: s.test };
}

/** An active purchase is re-checked this often even before it expires, to catch refunds and revocations. */
export const RECHECK_ACTIVE_MS = 24 * 3600_000;

/**
 * Re-checks purchases whose paid period has passed (renewed? cancelled? in grace?) and unfinished web
 * checkouts at most every 10 minutes, and active ones once a day (refunded? revoked?), then updates the
 * family's plan. Paid passes don't change, so they aren't re-checked. Store errors keep the last known state.
 */
export async function refreshPurchases(familyId: string, opts: { cfg?: GooglePlayConfig | null; fetch?: Fetch; web?: WebBillingOpts } = {}) {
  const now = new Date();
  const due = await db.storePurchase.findMany({
    where: {
      familyId, AND: [openPurchases(now), { state: { not: "PAID" } }],
      OR: [
        { OR: [{ expiresAt: { lt: now } }, { expiresAt: null }], checkedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
        { checkedAt: { lt: new Date(now.getTime() - RECHECK_ACTIVE_MS) } },
      ],
    },
  });
  const cfg = opts.cfg !== undefined ? opts.cfg : googlePlayConfig();
  for (const p of due) {
    try {
      if (p.store === "VOUCHER") {
        continue; // a redeemed sponsor code: paid in full, nothing to re-check with a store
      } else if (p.store === PAYMONGO) {
        await syncWebPurchase(p, opts.web);
      } else if (cfg) {
        const s = summarize(await getSubscription(cfg, p.purchaseToken, opts.fetch), p.productId);
        await db.storePurchase.update({ where: { id: p.id }, data: { state: s.state, expiresAt: s.expiresAt, autoRenewing: s.autoRenewing, checkedAt: now } });
      }
    } catch (e) {
      if (!(e instanceof ServiceError)) throw e;
      await db.storePurchase.update({ where: { id: p.id }, data: { checkedAt: now } });
    }
  }
  await applyEntitlement(familyId);
}

/**
 * Google Play Real-time Developer Notification for one purchase token: renewals, cancellations,
 * expiry, revocations and refunds. Re-checks the purchase with Google (or, for a refund, closes it)
 * and updates the family's plan. Tokens eGuard hasn't seen yet are ignored; the app redeems them.
 */
export async function handlePlayNotification(
  n: { purchaseToken: string; voided?: boolean },
  opts: { cfg?: GooglePlayConfig | null; fetch?: Fetch } = {},
) {
  const p = await db.storePurchase.findUnique({ where: { purchaseToken: n.purchaseToken } });
  if (!p) return { handled: false };
  if (n.voided) {
    await db.storePurchase.update({ where: { id: p.id }, data: { state: "VOIDED", autoRenewing: false, checkedAt: new Date() } });
    await audit(p.familyId, "Google Play", "purchase.voided", p.productId);
  } else if (!CLOSED_STATES.includes(p.state)) {
    const cfg = requireConfig(opts.cfg !== undefined ? opts.cfg : googlePlayConfig());
    const s = summarize(await getSubscription(cfg, p.purchaseToken, opts.fetch), p.productId);
    await db.storePurchase.update({ where: { id: p.id }, data: { state: s.state, expiresAt: s.expiresAt, autoRenewing: s.autoRenewing, checkedAt: new Date() } });
  }
  await applyEntitlement(p.familyId);
  return { handled: true };
}
