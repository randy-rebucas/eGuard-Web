import "server-only";
import { db } from "./db";
import { newToken, sha256 } from "./auth";
import { ServiceError } from "./errors";
import { escapeHtml, sendMail } from "./mail";

/**
 * "Verify your email": proves a parent owns the mailbox they signed up with. Links are single-use,
 * last 24 hours, and die if the parent changes their email. Unverified parents can't pair a device.
 */

const LINK_HOURS = 24;
const RESEND_SECONDS = 60;

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export const EMAIL_UNVERIFIED = "Verify your email to pair a device. We sent you a link. Check your inbox, or send a new one.";

/** Throws 403 `email_unverified` unless the parent has verified their email. */
export async function requireVerifiedEmail(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!u.emailVerifiedAt) throw new ServiceError(403, EMAIL_UNVERIFIED, "email_unverified");
}

/**
 * Emails a fresh link, replacing earlier ones. `throttle` (parent-requested resends) allows one a minute.
 * Returns false if the email is already verified.
 */
export async function sendVerificationEmail(userId: string, { throttle = false } = {}) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) return false;
  if (throttle) {
    const last = await db.emailVerification.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_SECONDS * 1000) {
      throw new ServiceError(429, "We just sent you a link. Check your inbox, or try again in a minute.", "rate_limited");
    }
  }
  const token = newToken();
  await db.$transaction([
    db.emailVerification.deleteMany({ where: { userId } }),
    db.emailVerification.create({ data: { userId, email: user.email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + LINK_HOURS * 36e5) } }),
  ]);
  const link = `${appUrl()}/verify-email?token=${token}`;
  const first = user.name.split(/\s+/)[0];
  await sendMail({
    to: user.email,
    subject: "Verify your eGuard email",
    text: `Hi ${first},\n\nConfirm this is your email so you can pair your children's devices with eGuard:\n\n${link}\n\nThe link works once and expires in ${LINK_HOURS} hours. If you didn't create an eGuard account, you can ignore this email.\n\n— eGuard`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Confirm this is your email so you can pair your children's devices with eGuard.</p>`
      + `<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">Verify my email</a></p>`
      + `<p style="color:#555;font-size:13px">Or paste this link into your browser:<br>${link}</p>`
      + `<p style="color:#555;font-size:13px">The link works once and expires in ${LINK_HOURS} hours. If you didn't create an eGuard account, you can ignore this email.</p>`,
  });
  return true;
}

/** For after(): a failed send mustn't fail sign-up, since the parent can ask for a new link. */
export const sendVerificationEmailQuietly = (userId: string) =>
  sendVerificationEmail(userId).catch((e) => console.error("[mail] verification email failed", e));

export type VerifyResult = "verified" | "expired" | "invalid";

/** Uses a link's token. Invalid covers unknown, already used, and sent to an email the parent has since changed. */
export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  if (!token) return "invalid";
  const v = await db.emailVerification.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!v || v.email !== v.user.email) return "invalid";
  if (v.expiresAt < new Date()) return "expired";
  await db.$transaction([
    db.user.update({ where: { id: v.userId }, data: { emailVerifiedAt: new Date() } }),
    db.emailVerification.deleteMany({ where: { userId: v.userId } }),
    db.auditLog.create({ data: { familyId: v.user.familyId, actor: v.user.name, action: "email.verified", detail: v.email } }),
  ]);
  return "verified";
}
