import "server-only";
import { db } from "./db";
import { hashPassword, newToken } from "./auth";
import { audit } from "./audit";
import { ServiceError, conflict, isUniqueViolation } from "./errors";
import { GUARDIAN_REQUIRED, createFamily, isPendingInvite, userIdForMailbox } from "./family-service";
import { defaultFamilyName } from "./mobile-account";
import type { Identity } from "./social-auth";

/**
 * Continue with Apple / Google, once the provider's ID token is verified. Signs in a linked account,
 * links an existing account with exactly the same email, or creates a new family.
 */
export async function signInWithIdentity(id: Identity, opts: { name?: string; guardian?: boolean } = {}) {
  const linkedUser = async () => (await db.oAuthIdentity.findUnique({ where: { provider_subject: { provider: id.provider, subject: id.subject } } }))?.userId;
  try {
    return await signIn(id, opts, await linkedUser());
  } catch (e) {
    // A double tap: the other request linked this identity (or created its family) first. Sign in to that
    // account instead of showing "already exists" for an account the parent just made.
    if (isUniqueViolation(e) || (e instanceof ServiceError && e.status === 409)) {
      // The winner creates the family a moment before linking the identity, so look again briefly
      for (let i = 0; i < 4; i++) {
        const userId = await linkedUser();
        if (userId) return { userId, isNew: false };
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    throw e;
  }
}

async function signIn(id: Identity, opts: { name?: string; guardian?: boolean }, linked: string | undefined) {
  if (linked) return { userId: linked, isNew: false };

  if (!id.email || !id.emailVerified) {
    throw new ServiceError(400, "Your account needs a verified email address to use eGuard.", "email_required");
  }
  // Emails are stored lowercase; a provider's "Randy@Gmail.com" must match (not duplicate) randy@gmail.com
  const email = id.email.trim().toLowerCase();

  // Link only on the exact address. An alias (randy+x@…, r.andy@gmail.com) can be a different person's
  // mailbox at some providers, so it never gets into this account.
  // An invitation they haven't accepted isn't their account: signing in with Apple/Google never quietly puts them
  // in the family that invited them (they accept from the emailed link). Creating their own family below drops it.
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && !isPendingInvite(existing)) {
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
  const other = await userIdForMailbox(email);
  const otherUser = other ? await db.user.findUnique({ where: { id: other } }) : null;
  if (otherUser && !isPendingInvite(otherUser)) {
    throw conflict("An eGuard account already uses another spelling of this email. Sign in with your password instead.");
  }

  if (opts.guardian !== true) throw new ServiceError(400, GUARDIAN_REQUIRED, "guardian_required");
  const name = opts.name ?? id.name ?? email.split("@")[0];
  // Social accounts have no password: store a hash of a random secret nobody knows
  const user = await createFamily({ name, email, familyName: defaultFamilyName(name), passwordHash: await hashPassword(newToken()), emailVerified: true, passwordSet: false });
  await db.oAuthIdentity.create({ data: { userId: user.id, provider: id.provider, subject: id.subject, email } });
  return { userId: user.id, isNew: true };
}
