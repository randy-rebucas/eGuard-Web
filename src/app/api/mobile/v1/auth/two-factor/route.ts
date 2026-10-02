import { z } from "zod";
import { clientIp, sessionResponse } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { LIMITS, enforce, ipKey } from "@/lib/rate-limit";
import { completeChallenge } from "@/lib/two-factor";

const Body = z.object({
  challenge: z.string().min(20).max(200),
  /** The 6-digit authenticator code, or a recovery code ("k3m9-x2qa-7fpd") */
  code: z.string().trim().min(6).max(40),
});

/**
 * The second step of signing in, after a sign-in endpoint answered `twoFactorRequired`. Returns a session like
 * /auth/login. A challenge lasts 10 minutes and allows 5 tries; then the parent signs in again.
 */
export const POST = open(async ({ req }) => {
  await enforce(ipKey("token", clientIp(req)), LIMITS.tokenIp);
  const b = await body(req, Body);
  const r = await completeChallenge(b.challenge, b.code);
  return sessionResponse(req, r.user.id, 200, r.usedRecoveryCode ? { usedRecoveryCode: true, recoveryCodesLeft: r.recoveryCodesLeft } : {});
});
