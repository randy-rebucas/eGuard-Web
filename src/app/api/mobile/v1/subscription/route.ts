import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usedDeviceSlots } from "@/lib/device-slots";
import { getFamily } from "@/lib/queries";
import { shortDate } from "@/lib/format";
import { authed, clientLabel } from "@/lib/mobile-api";
import { nextPlan, planByName, planFeatures } from "@/lib/plans";
import { currentPurchase, refreshPurchases } from "@/lib/billing";
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
    status: !family.renewsAt || family.renewsAt > new Date() ? "ACTIVE" : "EXPIRED",
    renewsAt: family.renewsAt,
    renewsLabel: family.renewsAt ? `${purchase && !purchase.autoRenewing ? "Ends" : "Renews"} on ${shortDate(family.renewsAt, family.timezone)}` : null,
    features: planFeatures(family.plan),
    entitlements: current.entitlements,
    usage: { devicesUsed: devices, deviceLimit: family.deviceLimit, children, childLimit: current.entitlements.childLimit },
    canManage: user.role === "FAMILY_ADMIN",
    /** true when this app can buy or manage the plan in its store (Google Play on Android) */
    billingAvailable: android && !!googlePlayConfig(),
    store: purchase ? { name: purchase.store, productId: purchase.productId, autoRenewing: purchase.autoRenewing, expiresAt: purchase.expiresAt } : null,
    upgrade: upgrade ? { planId: upgrade.id, name: upgrade.name, googlePlayProductId: upgrade.googlePlayProductId } : null,
  });
});
