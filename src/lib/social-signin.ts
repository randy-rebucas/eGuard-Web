import "server-only";
import { db } from "./db";
import { hashPassword, newToken } from "./auth";
import { audit } from "./audit";
import { ServiceError, conflict } from "./errors";
import { GUARDIAN_REQUIRED, createFamily, userIdForMailbox } from "./family-service";
import { defaultFamilyName } from "./mobile-account";
import type { Identity } from "./social-auth";

/**
 * Continue with Apple / Google, once the provider's ID token is verified. Signs in a linked account,
 * links an existing account with exactly the same email, or creates a new family.
 */
export async function signInWithIdentity(id: Identity, opts: { name?: string; guardian?: boolean } = {}) {
  const linked = await db.oAuthIdentity.findUnique({ where: { provider_subject: { provider: id.provider, subject: id.subject } } });
  if (linked) return { userId: linked.userId, isNew: false };

  if (!id.email || !id.emailVerified) {
    throw new ServiceError(400, "Your account needs a verified email address to use eGuard.", "email_required");
  }
  // Emails are stored lowercase; a provider's "Randy@Gmail.com" must match (not duplicate) randy@gmail.com
  const email = id.email.trim().toLowerCase();

  // Link only on the exact address. An alias (randy+x@…, r.andy@gmail.com) can be a different person's
  // mailbox at some providers, so it never gets into this account.
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.emailVerifiedAt) {
      // Whoever registered this address never proved they own it; the provider just proved this person does.
      // Lock the registrant out: their password and sessions stop working before we hand over the account.
      await db.$transaction([
        db.user.update({ where: { id: existing.id }, data: { passwordHash: await hashPassword(newToken()), passwordSet: false, emailVerifiedAt: new Date() } }),
        db.session.deleteMany({ where: { userId: existing.id } }),
        db.passwordReset.deleteMany({ where: { userId: existing.id } }),
      ]);
      await audit(existing.familyId, existing.name, "account.claimed", `Unverified account claimed with ${id.provider} sign-in; earlier password and sessions revoked`);
    }
    await db.oAuthIdentity.create({ data: { userId: existing.id, provider: id.provider, subject: id.subject, email } });
    await audit(existing.familyId, existing.name, "identity.linked", id.provider);
    return { userId: existing.id, isNew: false };
  }
  if (await userIdForMailbox(email)) {
    throw conflict("An eGuard account already uses another spelling of this email. Sign in with your password instead.");
  }

  if (opts.guardian !== true) throw new ServiceError(400, GUARDIAN_REQUIRED, "guardian_required");
  const name = opts.name ?? id.name ?? email.split("@")[0];
  // Social accounts have no password: store a hash of a random secret nobody knows
  const user = await createFamily({ name, email, familyName: defaultFamilyName(name), passwordHash: await hashPassword(newToken()), emailVerified: true, passwordSet: false });
  await db.oAuthIdentity.create({ data: { userId: user.id, provider: id.provider, subject: id.subject, email } });
  return { userId: user.id, isNew: true };
}
