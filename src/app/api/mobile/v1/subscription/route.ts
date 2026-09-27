import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFamily } from "@/lib/queries";
import { shortDate } from "@/lib/format";
import { authed, clientLabel } from "@/lib/mobile-api";
import { PLANS, planByName, planFeatures } from "@/lib/plans";
import { currentPurchase, refreshPurchases } from "@/lib/billing";
import { googlePlayConfig } from "@/lib/google-play";

/** Settings › Subscription: plan, renewal, features, plan usage, and whether the app can sell an upgrade. */
export const GET = authed(async ({ req, user }) => {
  await refreshPurchases(user.familyId);
  const [family, devices, children, purchase] = await Promise.all([
    getFamily(user.familyId),
    db.device.count({ where: { familyId: user.familyId } }),
    db.child.count({ where: { familyId: user.familyId } }),
    currentPurchase(user.familyId),
  ]);
  const current = planByName(family.plan);
  const upgrade = PLANS.find((p) => p.deviceLimit > current.deviceLimit && p.googlePlayProductId) ?? null;
  const android = clientLabel(req) === "Android app";
  return NextResponse.json({
    plan: family.plan,
    status: !family.renewsAt || family.renewsAt > new Date() ? "ACTIVE" : "EXPIRED",
    renewsAt: family.renewsAt,
    renewsLabel: family.renewsAt ? `${purchase && !purchase.autoRenewing ? "Ends" : "Renews"} on ${shortDate(family.renewsAt, family.timezone)}` : null,
    features: planFeatures(family.plan, family.deviceLimit),
    usage: { devicesUsed: devices, deviceLimit: family.deviceLimit, children },
    canManage: user.role === "FAMILY_ADMIN",
    /** true when this app can buy or manage the plan in its store (Google Play on Android) */
    billingAvailable: android && !!googlePlayConfig(),
    store: purchase ? { name: purchase.store, productId: purchase.productId, autoRenewing: purchase.autoRenewing, expiresAt: purchase.expiresAt } : null,
    upgrade: upgrade ? { planId: upgrade.id, name: upgrade.name, googlePlayProductId: upgrade.googlePlayProductId } : null,
  });
});
