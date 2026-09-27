import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, newToken } from "@/lib/auth";
import { createFamily } from "@/lib/family-service";
import { defaultFamilyName, sessionResponse } from "@/lib/mobile-account";
import { apiError, body, open } from "@/lib/mobile-api";
import { verifyIdToken } from "@/lib/social-auth";

const Body = z.object({
  provider: z.enum(["apple", "google"]),
  idToken: z.string().min(20),
  /** Apple only sends the name to the app on the first sign-in, so the app forwards it */
  name: z.string().trim().min(1).max(80).optional(),
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
  const existing = await db.user.findUnique({ where: { email: id.email } });
  if (existing) {
    await db.oAuthIdentity.create({ data: { userId: existing.id, provider: id.provider, subject: id.subject, email: id.email } });
    return sessionResponse(req, existing.id, 200, { isNew: false });
  }

  const name = b.name ?? id.name ?? id.email.split("@")[0];
  // Social accounts have no password: store a hash of a random secret nobody knows
  const user = await createFamily({ name, email: id.email, familyName: defaultFamilyName(name), passwordHash: await hashPassword(newToken()) });
  await db.oAuthIdentity.create({ data: { userId: user.id, provider: id.provider, subject: id.subject, email: id.email } });
  return sessionResponse(req, user.id, 201, { isNew: true });
});
