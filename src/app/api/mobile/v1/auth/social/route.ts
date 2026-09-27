import { z } from "zod";
import { clientIp, sessionResponse } from "@/lib/mobile-account";
import { body, open } from "@/lib/mobile-api";
import { LIMITS, enforce, ipKey } from "@/lib/rate-limit";
import { verifyIdToken } from "@/lib/social-auth";
import { signInWithIdentity } from "@/lib/social-signin";

const Body = z.object({
  provider: z.enum(["apple", "google"]),
  idToken: z.string().min(20),
  /** Apple only sends the name to the app on the first sign-in, so the app forwards it */
  name: z.string().trim().min(1).max(80).optional(),
  /** Required only when this creates a new account: the parent's "I'm a parent or guardian, 18+" confirmation */
  guardian: z.boolean().optional(),
});

/**
 * Continue with Apple / Google. Signs in a linked account, links an existing account with
 * exactly the same verified email, or creates a new family.
 */
export const POST = open(async ({ req }) => {
  await enforce(ipKey("social", clientIp(req)), LIMITS.socialIp);
  const b = await body(req, Body);
  const id = await verifyIdToken(b.provider, b.idToken);
  const r = await signInWithIdentity(id, { name: b.name, guardian: b.guardian });
  return sessionResponse(req, r.userId, r.isNew ? 201 : 200, { isNew: r.isNew });
});
