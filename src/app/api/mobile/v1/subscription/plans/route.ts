import { NextResponse } from "next/server";
import { getFamily } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";
import { PLANS, webPrice } from "@/lib/plans";
import { googlePlayConfig, obfuscatedAccountId } from "@/lib/google-play";

/**
 * Plans to show on the upgrade screen: Free, eGuard Plus and Family Pro. Store prices come from Play Billing
 * ProductDetails (a monthly and a yearly base plan per product); `monthlyPesos` and `yearlyPesos` are the web prices,
 * for display where the store has none. Pass
 * `googlePlay.obfuscatedAccountId` to BillingFlowParams.setObfuscatedAccountId().
 */
export const GET = authed(async ({ user }) => {
  const family = await getFamily(user.familyId);
  const cfg = googlePlayConfig();
  return NextResponse.json({
    plans: PLANS.map((p) => ({
      // The prices the web charges now (env can change them), not the built-in defaults
      id: p.id, name: p.name, blurb: p.blurb, current: p.name === family.plan,
      monthlyPesos: p.id === "FREE" ? 0 : webPrice(p.id) / 100, yearlyPesos: p.id === "FREE" ? 0 : webPrice(p.id, process.env, "year") / 100,
      childLimit: p.entitlements.childLimit, deviceLimit: p.entitlements.deviceLimit,
      entitlements: p.entitlements,
      features: p.features,
      googlePlayProductId: p.googlePlayProductId,
    })),
    googlePlay: cfg ? { packageName: cfg.packageName, obfuscatedAccountId: obfuscatedAccountId(user.familyId) } : null,
    canManage: user.role === "FAMILY_ADMIN",
  });
});
