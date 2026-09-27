import "server-only";
import { db } from "./db";
import { ServiceError, conflict, forbidden, invalid } from "./errors";
import { audit } from "./family-service";
import type { Actor } from "./config-service";
import { BASE_PLAN, planByGoogleProduct, planByName } from "./plans";
import {
  ENTITLED_STATES, acknowledge, getSubscription, googlePlayConfig, obfuscatedAccountId, summarize, type GooglePlayConfig,
} from "./google-play";

/**
 * Store subscriptions. The app completes the purchase with Google Play Billing, then hands the
 * purchase token to eGuard, which verifies it with Google before changing the family's plan.
 */

type Fetch = typeof fetch;

function requireConfig(cfg: GooglePlayConfig | null): GooglePlayConfig {
  if (!cfg) throw new ServiceError(501, "Google Play billing isn't set up on this server.", "billing_not_configured");
  return cfg;
}

const isEntitled = (p: { state: string; expiresAt: Date | null }, now = Date.now()) =>
  ENTITLED_STATES.includes(p.state) && !!p.expiresAt && p.expiresAt.getTime() > now;

/** Sets the family's plan from its store purchases; back to the base plan when none is active. */
async function applyEntitlement(familyId: string) {
  const purchases = await db.storePurchase.findMany({ where: { familyId, state: { not: "REPLACED" } }, orderBy: { expiresAt: "desc" } });
  if (!purchases.length) return;
  const active = purchases.find((p) => isEntitled(p));
  const plan = active ? planByGoogleProduct(active.productId) : null;
  const family = await db.family.findUniqueOrThrow({ where: { id: familyId } });
  const next = plan
    ? { plan: plan.name, deviceLimit: plan.deviceLimit, renewsAt: active!.expiresAt }
    : { plan: BASE_PLAN, deviceLimit: planByName(BASE_PLAN).deviceLimit, renewsAt: null };
  if (family.plan === next.plan && family.deviceLimit === next.deviceLimit && family.renewsAt?.getTime() === next.renewsAt?.getTime()) return;
  await db.family.update({ where: { id: familyId }, data: next });
  if (family.plan !== next.plan) {
    await audit(familyId, "Google Play", "plan.changed", `${family.plan} → ${next.plan}`);
    await db.alert.create({
      data: {
        familyId, severity: "INFO", category: "SYSTEM", icon: "crown",
        title: plan ? `Welcome to ${next.plan}` : `${family.plan} ended`,
        body: plan ? `Your family can now protect up to ${next.deviceLimit} devices.` : `Your family is back on ${next.plan}. Devices already added stay protected.`,
        subject: "Subscription",
      },
    });
  }
}

/** Verifies a Google Play subscription purchase and upgrades the family. Idempotent: safe to retry with the same token. */
export async function redeemGooglePlay(actor: Actor, productId: string, purchaseToken: string, opts: { cfg?: GooglePlayConfig | null; fetch?: Fetch } = {}) {
  if (actor.role !== "FAMILY_ADMIN") throw forbidden("Only the family admin can change the plan.");
  const cfg = requireConfig(opts.cfg !== undefined ? opts.cfg : googlePlayConfig());
  const plan = planByGoogleProduct(productId);
  if (!plan) throw invalid("Unknown subscription product.");

  const existing = await db.storePurchase.findUnique({ where: { purchaseToken } });
  if (existing && existing.familyId !== actor.familyId) throw conflict("This purchase is already linked to another eGuard family.");

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

/**
 * Re-checks purchases whose paid period has passed (renewed? cancelled? in grace?) at most every
 * 10 minutes, then updates the family's plan. Store errors keep the last known state.
 */
export async function refreshPurchases(familyId: string, opts: { cfg?: GooglePlayConfig | null; fetch?: Fetch } = {}) {
  const now = new Date();
  const due = await db.storePurchase.findMany({
    where: { familyId, store: "GOOGLE_PLAY", state: { not: "REPLACED" }, expiresAt: { lt: now }, checkedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
  });
  const cfg = opts.cfg !== undefined ? opts.cfg : googlePlayConfig();
  if (due.length && cfg) {
    for (const p of due) {
      try {
        const s = summarize(await getSubscription(cfg, p.purchaseToken, opts.fetch), p.productId);
        await db.storePurchase.update({ where: { id: p.id }, data: { state: s.state, expiresAt: s.expiresAt, autoRenewing: s.autoRenewing, checkedAt: now } });
      } catch (e) {
        if (!(e instanceof ServiceError)) throw e;
        await db.storePurchase.update({ where: { id: p.id }, data: { checkedAt: now } });
      }
    }
  }
  await applyEntitlement(familyId);
}

export async function currentPurchase(familyId: string) {
  const p = await db.storePurchase.findFirst({ where: { familyId, state: { not: "REPLACED" } }, orderBy: { expiresAt: "desc" } });
  return p && isEntitled(p) ? p : null;
}
