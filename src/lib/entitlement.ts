import "server-only";
import { db } from "./db";
import { audit } from "./audit";
import { BASE_PLAN, PLANS, entitlementsFor, planByName, planByProduct } from "./plans";
import { clearCurrentLocations } from "./plan-access";
import { ENTITLED_STATES as PLAY_ENTITLED } from "./google-play";

/**
 * Which plan a family has, derived from its purchases in every store. Google Play and PayMongo
 * (web) purchases are StorePurchase rows; this is the only place that turns them into Family.plan.
 */

/** PayMongo states that keep access until expiresAt: a paid pass, and subscriptions that were paid for the period. */
const PAYMONGO_ENTITLED = ["PAID", "active", "past_due", "cancelled"];
const ENTITLED_STATES = [...PLAY_ENTITLED, ...PAYMONGO_ENTITLED];

/** PayMongo retries a failed renewal once a day, 3 times; the family keeps access meanwhile. */
export const PAST_DUE_GRACE_MS = 3 * 864e5;

/**
 * States eGuard never re-checks: superseded by a newer purchase, refunded (voided), a checkout that
 * was never paid, or a subscription whose first payment never came.
 */
export const CLOSED_STATES = ["REPLACED", "VOIDED", "EXPIRED", "incomplete_cancelled"];

/** How long after its paid period a lapsed purchase is still re-checked by the maintenance job. */
const RECHECK_LAPSED_FOR_MS = 30 * 864e5;

export function isEntitled(p: { state: string; expiresAt: Date | null }, now = Date.now()) {
  if (!ENTITLED_STATES.includes(p.state) || !p.expiresAt) return false;
  return p.expiresAt.getTime() + (p.state === "past_due" ? PAST_DUE_GRACE_MS : 0) > now;
}

/** Sets the family's plan from its purchases; back to the base plan when none is active. */
export async function applyEntitlement(familyId: string) {
  const purchases = await db.storePurchase.findMany({ where: { familyId, state: { not: "REPLACED" } }, orderBy: { expiresAt: "desc" } });
  if (!purchases.length) return;
  const active = bestPurchase(purchases);
  const plan = active ? planByProduct(active.productId) : null;
  const family = await db.family.findUniqueOrThrow({ where: { id: familyId } });
  const next = plan
    ? { plan: plan.name, deviceLimit: plan.entitlements.deviceLimit, renewsAt: active!.expiresAt }
    : { plan: BASE_PLAN, deviceLimit: planByName(BASE_PLAN).entitlements.deviceLimit, renewsAt: null };
  if (family.plan === next.plan && family.deviceLimit === next.deviceLimit && family.renewsAt?.getTime() === next.renewsAt?.getTime()) return;
  await db.family.update({ where: { id: familyId }, data: next });
  if (entitlementsFor(family.plan).locationSharing && !entitlementsFor(next.plan).locationSharing) await clearCurrentLocations(familyId);
  if (family.plan !== next.plan) {
    await audit(familyId, active?.store === "GOOGLE_PLAY" ? "Google Play" : active ? "PayMongo" : "eGuard", "plan.changed", `${family.plan} → ${next.plan}`);
    await db.alert.create({
      data: {
        familyId, severity: "INFO", category: "SYSTEM", icon: "crown",
        title: plan ? `Welcome to ${next.plan}` : `${family.plan} ended`,
        body: plan
          ? `Your family can now protect up to ${plan.entitlements.childLimit} children on ${plan.entitlements.deviceLimit} devices.`
          : `Your family is back on ${next.plan}. Children and devices already added stay protected.`,
        subject: "Subscription",
      },
    });
  }
}

/** Purchases that may still change: not closed, and not long past their paid period. */
export const openPurchases = (now = new Date()) => ({
  state: { notIn: CLOSED_STATES },
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date(now.getTime() - RECHECK_LAPSED_FOR_MS) } }],
});

/** Families with purchases that may need re-checking or have just lapsed (for the maintenance job). */
export async function familiesWithPurchases() {
  const rows = await db.storePurchase.findMany({ where: openPurchases(), distinct: ["familyId"], select: { familyId: true } });
  return rows.map((r) => r.familyId);
}

/** Of the purchases active now, the one for the highest plan (then the one lasting longest). Rows come latest-ending first. */
function bestPurchase<P extends { productId: string; state: string; expiresAt: Date | null }>(rows: P[]) {
  const rank = (p: P) => { const plan = planByProduct(p.productId); return plan ? PLANS.indexOf(plan) : -1; };
  return rows.filter((p) => isEntitled(p)).reduce<P | null>((best, p) => (!best || rank(p) > rank(best) ? p : best), null);
}

/** The purchase the family's plan currently comes from, if any. */
export async function currentPurchase(familyId: string) {
  const rows = await db.storePurchase.findMany({ where: { familyId, state: { not: "REPLACED" } }, orderBy: { expiresAt: "desc" } });
  return bestPurchase(rows);
}

/** "Renews on …" for an auto-renewing purchase, "Ends on …" for one that won't (a pass, or auto-renew turned off). */
export function renewalWord(purchase: { autoRenewing: boolean } | null) {
  return purchase && !purchase.autoRenewing ? "Ends" : "Renews";
}
