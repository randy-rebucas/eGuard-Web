import { NextResponse } from "next/server";
import { z } from "zod";
import { declineInvite } from "@/lib/invitations";
import { clientIp } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { LIMITS, enforce, ipKey } from "@/lib/rate-limit";

/** Declines an invitation: the pending account is deleted and the family can't add them without a new one. */
export const POST = open(async ({ req }) => {
  await enforce(ipKey("token", clientIp(req)), LIMITS.tokenIp);
  const { token } = await body(req, z.object({ token: z.string().min(1).max(200) }));
  return NextResponse.json({ ok: true, ...(await declineInvite(token)) });
});
