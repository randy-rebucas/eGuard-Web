import { NextResponse } from "next/server";
import { z } from "zod";
import { redeemGooglePlay } from "@/lib/billing";
import { authed, body } from "@/lib/mobile-api";

const Body = z.object({
  productId: z.string().trim().min(1).max(100),
  purchaseToken: z.string().trim().min(10).max(4096),
});

/**
 * "Upgrade to Family" on Android: after Play Billing reports the purchase, send its token here.
 * eGuard verifies it with Google, upgrades the family, and acknowledges it (don't acknowledge in the app).
 * Also use it to restore purchases: re-sending a token already linked to this family is safe.
 */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  return NextResponse.json(await redeemGooglePlay(user, b.productId, b.purchaseToken));
});
