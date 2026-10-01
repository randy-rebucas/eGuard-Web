import "server-only";
import { db } from "./db";
import { MIN_PASSWORD, PASSWORD_TOO_LONG, hashPassword, newToken, passwordTooLong, sha256 } from "./auth";
import { audit } from "./audit";
import { appUrl } from "./email-verification";
import { ServiceError, conflict, forbidden, invalid, isUniqueViolation, notFound } from "./errors";
import { escapeHtml, sendMail } from "./mail";
import { LIMITS, enforce } from "./rate-limit";
import { InviteSchema, isPendingInvite, userIdForMailbox } from "./family-service";
import type { Actor } from "./config-service";
import type { z } from "zod";

/**
 * Adding another parent: the family admin invites them by email. Until they open the link, see which family it
 * is and choose a password, the account is a pending invitation (isPendingInvite): it can't sign in, and it never
 * blocks the person from making their own eGuard account instead. Replaces temporary passwords, which let anyone's
 * address be put in a family they never agreed to join.
 *
 * The link's token is stored like a password-reset link (PasswordReset, SHA-256 only), valid for INVITE_DAYS.
 */

export const INVITE_DAYS = 7;

const invalidLink = () => new ServiceError(400, "This invitation has already been used or isn't valid. Ask the family admin to send a new one.", "link_invalid");

/** Emails a fresh invitation link (replacing earlier ones). Returns false if the email couldn't be sent. */
export async function sendInvite(userId: string, inviterName?: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { family: true } });
  if (!isPendingInvite(user)) return false;
  const token = newToken();
  await db.$transaction([
    db.passwordReset.deleteMany({ where: { userId } }),
    db.passwordReset.create({ data: { userId, email: user.email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5) } }),
  ]);
  const link = `${appUrl()}/accept-invite?token=${token}`;
  const first = user.name.split(/\s+/)[0];
  const who = inviterName ? `${inviterName} invited you` : "You're invited";
  try {
    await sendMail({
      to: user.email,
      subject: `${inviterName ?? "A parent"} invited you to ${user.family.name} on eGuard`,
      text: `Hi ${first},\n\n${who} to join ${user.family.name} on eGuard as a parent, to help look after the children's devices.\n\nAccept or decline here:\n${link}\n\nThe link works once and expires in ${INVITE_DAYS} days. If you don't know this family, you can ignore this email or decline; nothing is set up until you accept.\n\n— eGuard`,
      html: `<p>Hi ${escapeHtml(first)},</p><p>${escapeHtml(who)} to join <b>${escapeHtml(user.family.name)}</b> on eGuard as a parent, to help look after the children's devices.</p>`
        + `<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">See the invitation</a></p>`
        + `<p style="color:#555;font-size:13px">The link works once and expires in ${INVITE_DAYS} days. If you don't know this family, you can ignore this email or decline; nothing is set up until you accept.</p>`,
    });
    return true;
  } catch (e) {
    console.error("[mail] invitation email failed", userId, e);
    return false;
  }
}

/** Family admin invites another parent. They join only once they accept the emailed invitation. */
export async function inviteParent(actor: Actor, input: z.infer<typeof InviteSchema>) {
  if (actor.role !== "FAMILY_ADMIN") throw forbidden();
  const { name, email } = InviteSchema.parse(input);
  await enforce(`invite:${actor.id}`, LIMITS.inviteUser, "You've sent several invitations. Wait a while before sending more.");
  const taken = () => conflict("This email already has an eGuard account. A parent can be in one family at a time; they'd need to delete that account first.");
  if (await userIdForMailbox(email)) throw taken();
  const user = await db.user.create({
    // An unusable password until they accept and choose their own
    data: { familyId: actor.familyId, name, email, passwordHash: await hashPassword(newToken()), passwordSet: false, role: "PARENT" },
  }).catch((e) => { throw isUniqueViolation(e) ? taken() : e; });
  await audit(actor.familyId, actor.name, "member.invited", email);
  const sent = await sendInvite(user.id, actor.name);
  return { user, sent };
}

/** "Resend invitation" for one still pending. */
export async function resendInvite(actor: Actor, userId: string) {
  if (actor.role !== "FAMILY_ADMIN") throw forbidden();
  const u = await db.user.findFirst({ where: { id: userId, familyId: actor.familyId } });
  if (!u) throw notFound("Invitation");
  if (!isPendingInvite(u)) throw conflict(`${u.name} already accepted.`);
  await enforce(`invite:${actor.id}`, LIMITS.inviteUser, "You've sent several invitations. Wait a while before sending more.");
  if (!(await sendInvite(u.id, actor.name))) throw new ServiceError(503, "We couldn't send the email right now. Please try again in a few minutes.", "mail_failed");
  return u;
}

async function linkFor(token: string) {
  const r = token ? await db.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { include: { family: true } } } }) : null;
  if (!r || r.email !== r.user.email || !isPendingInvite(r.user)) return null;
  return r;
}

/** What the invitation page shows before the person decides. Doesn't use the link up. */
export async function invitation(token: string) {
  const r = await linkFor(token);
  if (!r) return null;
  const admin = await db.user.findFirst({ where: { familyId: r.user.familyId, role: "FAMILY_ADMIN" }, select: { name: true } });
  return { name: r.user.name, email: r.user.email, familyName: r.user.family.name, invitedBy: admin?.name ?? null, expired: r.expiresAt < new Date() };
}

/** Accepts with a password of their own: they become a parent in the family, signed in, with their email verified. */
export async function acceptInvite(token: string, password: string) {
  if (password.length < MIN_PASSWORD) throw invalid(`Use at least ${MIN_PASSWORD} characters for your password.`);
  if (passwordTooLong(password)) throw invalid(PASSWORD_TOO_LONG);
  const r = await linkFor(token);
  if (!r) throw invalidLink();
  if (r.expiresAt < new Date()) throw new ServiceError(400, "This invitation has expired. Ask the family admin to send a new one.", "link_expired");
  const now = new Date();
  const [accepted] = await db.$transaction([
    // Conditional, so the same link opened twice at once accepts once
    db.user.updateMany({
      where: { id: r.userId, passwordSet: false, emailVerifiedAt: null },
      data: { passwordHash: await hashPassword(password), passwordSet: true, passwordChangedAt: now, emailVerifiedAt: now },
    }),
    db.passwordReset.deleteMany({ where: { userId: r.userId } }),
  ]);
  if (!accepted.count) throw invalidLink();
  await audit(r.user.familyId, r.user.name, "member.joined", r.user.email);
  await db.alert.create({
    data: {
      familyId: r.user.familyId, severity: "INFO", category: "SYSTEM", icon: "user-plus", subject: r.user.name,
      title: "Parent joined", body: `${r.user.name} accepted the invitation and can now help manage your family's protections.`,
    },
  });
  return db.user.findUniqueOrThrow({ where: { id: r.userId } });
}

/** Declines: the pending account is deleted, so nothing about this person stays with the family. */
export async function declineInvite(token: string) {
  const r = await linkFor(token);
  if (!r) throw invalidLink();
  const gone = await db.user.deleteMany({ where: { id: r.userId, passwordSet: false, emailVerifiedAt: null } });
  if (gone.count) await audit(r.user.familyId, r.user.name, "member.invite_declined", r.user.email);
  return { familyName: r.user.family.name };
}

/** Pending invitations in a family and when their links expire (null when none is live), for the admin's list. */
export async function pendingInvites(familyId: string) {
  const users = await db.user.findMany({ where: { familyId, role: "PARENT", passwordSet: false, emailVerifiedAt: null }, include: { passwordResets: true } });
  return new Map(users.map((u) => [u.id, u.passwordResets.map((p) => p.expiresAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null]));
}
