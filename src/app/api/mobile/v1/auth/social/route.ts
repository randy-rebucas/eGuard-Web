import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, newToken } from "@/lib/auth";
import { GUARDIAN_REQUIRED, createFamily, userIdForMailbox } from "@/lib/family-service";
import { defaultFamilyName, sessionResponse } from "@/lib/mobile-account";
import { apiError, body, open } from "@/lib/mobile-api";
import { verifyIdToken } from "@/lib/social-auth";

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
 * the same verified email, or creates a new family.
 */
export const POST = open(async ({ req }) => {
  const b = await body(req, Body);
  const id = await verifyIdToken(b.provider, b.idToken);

  const linked = await db.oAuthIdentity.findUnique({ where: { provider_subject: { provider: id.provider, subject: id.subject } } });
  if (linked) return sessionResponse(req, linked.userId, 200, { isNew: false });

  if (!id.email || !id.emailVerified) {
    return apiError(400, "Your account needs a verified email address to use eGuard.", "email_required");
  }
  // Emails are stored lowercase; a provider's "Randy@Gmail.com" must match (not duplicate) randy@gmail.com
  const email = id.email.trim().toLowerCase();
  // Same mailbox under another spelling (r.andy@gmail.com vs randy@gmail.com) is the same parent
  const existingId = await userIdForMailbox(email);
  if (existingId) {
    await db.oAuthIdentity.create({ data: { userId: existingId, provider: id.provider, subject: id.subject, email } });
    // The provider has verified this mailbox, which is what our email link would prove
    await db.user.updateMany({ where: { id: existingId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    return sessionResponse(req, existingId, 200, { isNew: false });
  }

  if (b.guardian !== true) return apiError(400, GUARDIAN_REQUIRED, "guardian_required");
  const name = b.name ?? id.name ?? email.split("@")[0];
  // Social accounts have no password: store a hash of a random secret nobody knows
  const user = await createFamily({ name, email, familyName: defaultFamilyName(name), passwordHash: await hashPassword(newToken()), emailVerified: true });
  await db.oAuthIdentity.create({ data: { userId: user.id, provider: id.provider, subject: id.subject, email } });
  return sessionResponse(req, user.id, 201, { isNew: true });
});
