import "server-only";
import { after } from "next/server";
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

/** The site's public URL for emailed links. Production refuses to fall back to localhost, which would email dead links. */
export const appUrl = () => {
  const url = process.env.APP_URL;
  if (!url && process.env.NODE_ENV === "production") throw new Error("APP_URL is not set, so eGuard can't build email links.");
  return (url || "http://localhost:3000").replace(/\/+$/, "");
};

/** `what` names the action that's waiting: pairing, creating an organization, paying for a plan or codes. */
export const unverifiedMessage = (what = "pair a device") => `Verify your email to ${what}. We sent you a link. Check your inbox, or send a new one.`;
export const EMAIL_UNVERIFIED = unverifiedMessage();

/**
 * Whether the parent has a live link waiting in their inbox. A failed send leaves none, so the banner
 * can say so instead of claiming we sent one.
 */
export async function hasPendingVerification(userId: string, email: string) {
  return !!(await db.emailVerification.findFirst({ where: { userId, email, expiresAt: { gt: new Date() } }, select: { id: true } }));
}

/** Throws 403 `email_unverified` unless the parent has verified their email. */
export async function requireVerifiedEmail(userId: string, what?: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!u.emailVerifiedAt) throw new ServiceError(403, unverifiedMessage(what), "email_unverified");
}

/**
 * Emails a fresh link, replacing earlier ones. `throttle` (parent-requested resends) allows one a minute.
 * Returns false if the email is already verified. Throws 503 `mail_failed` if SMTP rejects the send.
 */
export async function sendVerificationEmail(userId: string, { throttle = false } = {}) {
  const send = await issueVerificationLink(userId, { throttle });
  if (!send) return false;
  await send();
  return true;
}

/**
 * Stores a new link now and returns the function that emails it (null if already verified). Callers
 * pass that to after(), so the link exists before the page renders and the banner can tell it's on its way.
 */
async function issueVerificationLink(userId: string, { throttle = false } = {}) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) return null;
  if (throttle) {
    const last = await db.emailVerification.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_SECONDS * 1000) {
      throw new ServiceError(429, "We just sent you a link. Check your inbox, or try again in a minute.", "rate_limited");
    }
  }
  const token = newToken();
  const link = `${appUrl()}/verify-email?token=${token}`;
  const created = await db.emailVerification.create({
    data: { userId, email: user.email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + LINK_HOURS * 36e5) },
  });
  const first = user.name.split(/\s+/)[0];
  return async () => {
    try {
      await sendMail({
        to: user.email,
        subject: "Verify your eGuard email",
        text: `Hi ${first},\n\nConfirm this is your email so you can pair your children's devices with eGuard:\n\n${link}\n\nThe link works once and expires in ${LINK_HOURS} hours. If you didn't create an eGuard account, you can ignore this email.\n\n— eGuard`,
        html: `<p>Hi ${escapeHtml(first)},</p><p>Confirm this is your email so you can pair your children's devices with eGuard.</p>`
          + `<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">Verify my email</a></p>`
          + `<p style="color:#555;font-size:13px">Or paste this link into your browser:<br>${link}</p>`
          + `<p style="color:#555;font-size:13px">The link works once and expires in ${LINK_HOURS} hours. If you didn't create an eGuard account, you can ignore this email.</p>`,
      });
    } catch (e) {
      // Drop the unsent link so it doesn't trip the resend throttle or the banner, and keep any earlier link working
      await db.emailVerification.delete({ where: { id: created.id } }).catch(() => {});
      console.error("[mail] verification email failed", e);
      throw new ServiceError(503, "We couldn't send the email right now. Please try again in a few minutes.", "mail_failed");
    }
    // Only the newest link works once it has actually been sent
    await db.emailVerification.deleteMany({ where: { userId, id: { not: created.id } } });
  };
}

/**
 * For sign-up, email changes and new parents: stores the link now, sends it after the response.
 * A failed send mustn't fail the request (it's logged), since the parent can ask for a new link.
 */
export async function sendVerificationEmailLater(userId: string) {
  try {
    const send = await issueVerificationLink(userId);
    if (send) after(() => send().catch(() => {}));
  } catch (e) {
    console.error("[mail] verification email failed", e);
  }
}

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
