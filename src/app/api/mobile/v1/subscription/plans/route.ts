import { NextResponse } from "next/server";
import { getFamily } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";
import { PLANS, planFeatures } from "@/lib/plans";
import { googlePlayConfig, obfuscatedAccountId } from "@/lib/google-play";

/**
 * Plans to show on the upgrade screen. Prices come from the store (Play Billing ProductDetails), not from
 * eGuard. Pass `googlePlay.obfuscatedAccountId` to BillingFlowParams.setObfuscatedAccountId().
 */
export const GET = authed(async ({ user }) => {
  const family = await getFamily(user.familyId);
  const cfg = googlePlayConfig();
  return NextResponse.json({
    plans: PLANS.map((p) => ({
      id: p.id, name: p.name, deviceLimit: p.deviceLimit, current: p.name === family.plan,
      features: planFeatures(p.name, p.deviceLimit),
      googlePlayProductId: p.googlePlayProductId,
    })),
    googlePlay: cfg ? { packageName: cfg.packageName, obfuscatedAccountId: obfuscatedAccountId(user.familyId) } : null,
    canManage: user.role === "FAMILY_ADMIN",
  });
});
