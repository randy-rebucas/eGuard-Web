import "server-only";
import { db } from "./db";
import { MIN_PASSWORD, PASSWORD_TOO_LONG, hashPassword, isPendingInvite, loginKeys, newToken, passwordTooLong, sha256 } from "./auth";
import { acceptInvite, sendInvite } from "./invitations";
import { audit } from "./audit";
import { appUrl } from "./email-verification";
import { ServiceError, invalid } from "./errors";
import { escapeHtml, sendMail } from "./mail";
import { LIMITS, enforce, hit, ipKey } from "./rate-limit";

/**
 * "Forgot password": emails a single-use link (1 hour) that sets a new password. Also how parents
 * who signed up with Apple/Google set their first password.
 */

const LINK_MINUTES = 60;
export { MIN_PASSWORD };

/**
 * Sends a reset link if an account uses this email. Always looks the same to the caller, whether or not
 * the account exists, so it can't be used to find out who has an eGuard account.
 */
export async function requestPasswordReset(email: string, ip: string | null) {
  await enforce(ipKey("reset", ip), LIMITS.resetIp);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return;
  // Per-account cap, applied silently: an error here would reveal that the account exists
  if ((await hit(`reset:acct:${user.id}`, LIMITS.resetEmail)).limited) return;
  // Not accepted yet: a reset link would put them in the family without seeing which one. Send the invitation
  // again instead; it names the family and lets them decline.
  if (isPendingInvite(user)) return void (await sendInvite(user.id));

  const token = newToken();
  await db.$transaction([
    db.passwordReset.deleteMany({ where: { userId: user.id } }),
    db.passwordReset.create({ data: { userId: user.id, email: user.email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000) } }),
  ]);
  const link = `${appUrl()}/reset-password?token=${token}`;
  const first = user.name.split(/\s+/)[0];
  const action = user.passwordSet ? "reset your eGuard password" : "set a password for your eGuard account";
  await sendMail({
    to: user.email,
    subject: user.passwordSet ? "Reset your eGuard password" : "Set your eGuard password",
    text: `Hi ${first},\n\nUse this link to ${action}:\n\n${link}\n\nThe link works once and expires in ${LINK_MINUTES} minutes. If you didn't ask for this, you can ignore this email; your password stays the same.\n\n— eGuard`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Use this link to ${action}.</p>`
      + `<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">Choose a new password</a></p>`
      + `<p style="color:#555;font-size:13px">Or paste this link into your browser:<br>${link}</p>`
      + `<p style="color:#555;font-size:13px">The link works once and expires in ${LINK_MINUTES} minutes. If you didn't ask for this, you can ignore this email; your password stays the same.</p>`,
  });
}

/** For after(): a failed send mustn't change the response (that would reveal the account exists). */
export const requestPasswordResetQuietly = (email: string, ip: string | null) =>
  requestPasswordReset(email, ip).catch((e) => { if (!(e instanceof ServiceError)) console.error("[mail] password reset email failed", e); });

/**
 * Uses a reset link: sets the new password and signs out every session, including any an attacker
 * holds. Opening the link proves the parent owns the mailbox, so it also verifies their email.
 */
export async function resetPassword(token: string, password: string, ip: string | null) {
  await enforce(ipKey("token", ip), LIMITS.tokenIp);
  if (password.length < MIN_PASSWORD) throw invalid(`Use at least ${MIN_PASSWORD} characters for your password.`);
  if (passwordTooLong(password)) throw invalid(PASSWORD_TOO_LONG);
  const r = token ? await db.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } }) : null;
  if (!r || r.email !== r.user.email) throw new ServiceError(400, "This link has already been used or isn't valid. Ask for a new one.", "link_invalid");
  // An invitation link opened on the reset page (an older app): accepting it is what setting a password means here
  if (isPendingInvite(r.user)) return acceptInvite(token, password);
  if (r.expiresAt < new Date()) throw new ServiceError(400, "This link has expired. Ask for a new one.", "link_expired");
  await db.$transaction([
    db.user.update({
      where: { id: r.userId },
      data: { passwordHash: await hashPassword(password), passwordSet: true, passwordChangedAt: new Date(), emailVerifiedAt: r.user.emailVerifiedAt ?? new Date() },
    }),
    db.passwordReset.deleteMany({ where: { userId: r.userId } }),
    db.session.deleteMany({ where: { userId: r.userId } }),
    // Every failed-sign-in count for the account (from each address, and overall): the mailbox owner is back in
    db.rateLimit.deleteMany({ where: { OR: [{ key: loginKeys(r.user.email, null).account }, { key: { startsWith: `${loginKeys(r.user.email, null).account}:ip:` } }] } }),
  ]);
  await audit(r.user.familyId, r.user.name, "password.reset", "All sessions signed out");
  return r.user;
}
