import { z } from "zod";
import { rememberAppleToken } from "@/lib/apple-tokens";
import { clientIp, signInResponse } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { LIMITS, enforce, ipKey } from "@/lib/rate-limit";
import { verifyIdToken } from "@/lib/social-auth";
import { signInWithIdentity } from "@/lib/social-signin";

const Body = z.object({
  provider: z.enum(["apple", "google"]),
  idToken: z.string().min(20),
  /**
   * Apple only sends the name to the app on the first sign-in, so the app forwards it. Older iOS builds send "" on a
   * repeat sign-in: blank counts as absent rather than failing the sign-in.
   */
  name: z.preprocess((v) => (typeof v === "string" && !v.trim() ? undefined : v), z.string().trim().min(1).max(80).optional()),
  /** Required only when this creates a new account: the parent's "I'm a parent or guardian, 18+" confirmation */
  guardian: z.boolean().optional(),
  /** The raw one-time nonce whose SHA-256 the app put in the Apple request (or the nonce given to Google) */
  nonce: z.string().min(16).max(128).optional(),
  /**
   * Apple only: the credential's one-time authorizationCode. Exchanged for a refresh token so deleting the account
   * (or unlinking Apple) can revoke eGuard at Apple. Optional for older builds; ignored for Google.
   */
  authorizationCode: z.string().min(1).max(4096).optional(),
});

/**
 * Continue with Apple / Google. Signs in a linked account, links an existing account with
 * exactly the same verified email, or creates a new family.
 */
export const POST = open(async ({ req }) => {
  await enforce(ipKey("social", clientIp(req)), LIMITS.socialIp);
  const b = await body(req, Body);
  const id = await verifyIdToken(b.provider, b.idToken, { nonce: b.nonce });
  const r = await signInWithIdentity(id, { name: b.name, guardian: b.guardian });
  // Best-effort: never fails the sign-in (logged instead)
  if (b.provider === "apple" && b.authorizationCode) {
    await rememberAppleToken({ subject: id.subject, idToken: b.idToken, authorizationCode: b.authorizationCode });
  }
  return signInResponse(req, r.userId, r.isNew ? 201 : 200, { isNew: r.isNew });
});
