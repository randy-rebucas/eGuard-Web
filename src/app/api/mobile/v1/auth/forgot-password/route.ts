import { NextResponse, after } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { requestPasswordResetQuietly } from "@/lib/password-reset";
import { LIMITS, enforce, ipKey } from "@/lib/rate-limit";

const Body = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") });

/**
 * "Forgot password": emails a reset link if an account uses this address. The response is the same
 * either way. Apple/Google parents use this to set their first password.
 */
export const POST = open(async ({ req }) => {
  const { email } = await body(req, Body);
  const ip = clientIp(req);
  await enforce(ipKey("reset", ip), LIMITS.resetIp);
  after(() => requestPasswordResetQuietly(email, null));
  return NextResponse.json({ ok: true, message: `If an eGuard account uses ${email}, we sent it a link to reset the password.` }, { status: 202 });
});
