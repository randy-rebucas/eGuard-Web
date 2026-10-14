import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usedDeviceSlots } from "@/lib/device-slots";
import { getFamily } from "@/lib/queries";
import { shortDate } from "@/lib/format";
import { authed, clientLabel } from "@/lib/mobile-api";
import { nextPlan, planByName, planFeatures } from "@/lib/plans";
import { currentPurchase, refreshPurchases } from "@/lib/billing";
import { renewalWord } from "@/lib/entitlement";
import { sponsorOf } from "@/lib/organizations";
import { googlePlayConfig } from "@/lib/google-play";

/** Settings › Subscription: plan, renewal, what it includes, plan usage, and whether the app can sell an upgrade. */
export const GET = authed(async ({ req, user }) => {
  await refreshPurchases(user.familyId);
  const [family, devices, children, purchase] = await Promise.all([
    getFamily(user.familyId),
    usedDeviceSlots(user.familyId),
    db.child.count({ where: { familyId: user.familyId } }),
    currentPurchase(user.familyId),
  ]);
  const current = planByName(family.plan);
  const upgrade = nextPlan(family.plan);
  const android = clientLabel(req) === "Android app";
  return NextResponse.json({
    plan: family.plan,
    planId: current.id,
    // A failed renewal being retried is past renewsAt but still paid for (grace period)
    status: purchase || !family.renewsAt || family.renewsAt > new Date() ? "ACTIVE" : "EXPIRED",
    renewsAt: family.renewsAt,
    renewsLabel: family.renewsAt ? `${renewalWord(purchase)} on ${shortDate(family.renewsAt, family.timezone)}` : null,
    features: planFeatures(family.plan),
    entitlements: current.entitlements,
    usage: { devicesUsed: devices, deviceLimit: family.deviceLimit, children, childLimit: current.entitlements.childLimit },
    canManage: user.role === "FAMILY_ADMIN",
    /**
     * true when this app can buy or manage the plan in its store (Google Play on Android). Not while the plan is paid
     * another way (web pass or auto-renew, sponsor code): a Play subscription would charge on top of it.
     */
    billingAvailable: android && !!googlePlayConfig() && (!purchase || purchase.store === "GOOGLE_PLAY"),
    // `sponsor`: the organization that paid, for a plan from a sponsor code (as the web's "Sponsored by …")
    store: purchase ? { name: purchase.store, productId: purchase.productId, autoRenewing: purchase.autoRenewing, expiresAt: purchase.expiresAt, sponsor: await sponsorOf(purchase) } : null,
    // Not for the iPhone app, which sells nothing (App Store guideline 3.1.1)
    upgrade: upgrade && clientLabel(req) !== "iOS app" ? { planId: upgrade.id, name: upgrade.name, googlePlayProductId: upgrade.googlePlayProductId } : null,
  });
});
