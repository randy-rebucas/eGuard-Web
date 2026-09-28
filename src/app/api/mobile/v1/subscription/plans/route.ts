import { NextResponse } from "next/server";
import { getFamily } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";
import { PLANS } from "@/lib/plans";
import { googlePlayConfig, obfuscatedAccountId } from "@/lib/google-play";

/**
 * Plans to show on the upgrade screen: Free, eGuard Plus and Family Pro. Store prices come from Play Billing
 * ProductDetails; `monthlyPesos` is the web price, for display where the store has none. Pass
 * `googlePlay.obfuscatedAccountId` to BillingFlowParams.setObfuscatedAccountId().
 */
export const GET = authed(async ({ user }) => {
  const family = await getFamily(user.familyId);
  const cfg = googlePlayConfig();
  return NextResponse.json({
    plans: PLANS.map((p) => ({
      id: p.id, name: p.name, blurb: p.blurb, monthlyPesos: p.monthlyPesos, current: p.name === family.plan,
      childLimit: p.entitlements.childLimit, deviceLimit: p.entitlements.deviceLimit,
      entitlements: p.entitlements,
      features: p.features,
      googlePlayProductId: p.googlePlayProductId,
    })),
    googlePlay: cfg ? { packageName: cfg.packageName, obfuscatedAccountId: obfuscatedAccountId(user.familyId) } : null,
    canManage: user.role === "FAMILY_ADMIN",
  });
});
