import "server-only";
import { db } from "./db";
import { audit } from "./audit";
import { shortDate } from "./format";
import { applyEntitlement, currentPurchase } from "./entitlement";
import { addInterval, lockPaidTime } from "./web-billing";
import { planById, webProductFor } from "./plans";

/**
 * The Windows launch offer (docs/pricing-desktop.md section 5): a family on Free that pairs its first computer gets
 * one month of eGuard Plus, once ever, so it can try "Gaming time" across the phone and the PC. Paid time from eGuard
 * itself: a StorePurchase with store PROMO, which ends like a pass (reminder, then back to Free).
 *
 * On only while PC_LAUNCH_OFFER_UNTIL (an ISO date) is in the future; unset, there's no offer. Set it when eGuard for
 * Windows ships.
 */
export const PROMO_STORE = "PROMO";
const OFFER = "pc-launch";

export function launchOfferOn(env: Record<string, string | undefined> = process.env, now = Date.now()) {
  const until = Date.parse(env.PC_LAUNCH_OFFER_UNTIL?.trim() ?? "");
  return Number.isFinite(until) && until > now;
}

/**
 * Grants the offer if the family qualifies: the offer is on, nothing paid is running (Free, no pass, code or store
 * plan), and the family never had it. Returns when the month ends, or null. Never throws: pairing mustn't fail for it.
 */
export async function grantComputerLaunchOffer(familyId: string, now = new Date()) {
  try {
    if (!launchOfferOn(process.env, now.getTime())) return null;
    if (await currentPurchase(familyId)) return null;
    const plan = planById("PLUS");
    const expiresAt = await db.$transaction(async (tx) => {
      // Same lock as passes and sponsor codes, so a payment confirmed at this moment can't overlap it
      await lockPaidTime(tx, familyId);
      const token = `promo:${OFFER}:${familyId}`;
      if (await tx.storePurchase.findUnique({ where: { purchaseToken: token } })) return null;
      const end = addInterval(now, "month");
      await tx.storePurchase.create({
        data: { familyId, store: PROMO_STORE, productId: webProductFor("PLUS", false).id, purchaseToken: token, state: "PAID", expiresAt: end, checkedAt: now },
      });
      return end;
    });
    if (!expiresAt) return null;
    await applyEntitlement(familyId);
    const family = await db.family.findUniqueOrThrow({ where: { id: familyId }, select: { timezone: true } });
    await audit(familyId, "eGuard", "promo.granted", `${plan.name}, 1 month, Windows launch offer`);
    await db.alert.create({
      data: {
        familyId, severity: "INFO", category: "SYSTEM", icon: "crown", subject: "Subscription",
        title: `A month of ${plan.name}, on us`,
        body: `Thanks for adding your first computer. Until ${shortDate(expiresAt, family.timezone)} you have ${plan.name}: one gaming limit across phones and the computer, push alerts and location. After that your family goes back to Free unless you choose a plan.`,
      },
    });
    return expiresAt;
  } catch (e) {
    console.error("[launch offer] couldn't grant", familyId, e);
    return null;
  }
}
