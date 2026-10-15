import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { db } from "./db";
import { hashPassword, hostCookie, isPendingInvite, newToken, sha256 } from "./auth";
import { assertNotBreached } from "./breached-password";
import { appUrl } from "./email-verification";
import { ServiceError } from "./errors";
import { createFamily, userIdForMailbox } from "./family-service";
import { escapeHtml, sendMail } from "./mail";
import { LIMITS, enforce, hit, ipKey } from "./rate-limit";

/**
 * Creating an account takes two steps: the form, then a 6-digit code emailed to the address. The family and its admin
 * only exist once the code checks out, so:
 * - the form answers the same whether or not the email already has an account. That email gets "You already have an
 *   eGuard account" instead of a code, and no code works for the sign-up. Whether someone uses eGuard stays private.
 * - every account made with a password has a proven email, and nobody can hold an address they don't own.
 * The code only works with the ticket the browser (a cookie) or the app got from the form, so someone who was sent a
 * code they didn't ask for can't finish another person's sign-up. Sign-up with Google / Apple / LinkedIn skips this:
 * the provider has verified the email.
 */

/** On the web, the sign-up waiting for its code: httpOnly, and only as long as the sign-up itself. */
export const SIGNUP_COOKIE = hostCookie("eg_signup");

const CODE_MINUTES = 15;
const CODE_ATTEMPTS = 5;
const RESEND_SECONDS = 60;
/** Emails per sign-up (the first and resends) */
const MAX_SENDS = 5;

export type SignupInput = { name: string; familyName: string; email: string; password: string };

export const SIGNUP_EXPIRED = "This sign-up has expired. Fill in the form again to get a new code.";
const WRONG_CODE = "That code isn't right. Check the newest email from eGuard and try again.";

const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
/** Keyed with the ticket, so the stored hash alone can't be matched against all million codes. */
const codeHash = (ticket: string, code: string) => sha256(`${ticket}:${code}`);
const normalizeCode = (code: string) => code.replace(/\D/g, "");

/** The account already using this mailbox, unless it's an invitation nobody accepted (createFamily replaces those). */
async function existingAccount(email: string) {
  const id = await userIdForMailbox(email);
  const u = id ? await db.user.findUnique({ where: { id }, select: { role: true, passwordSet: true, emailVerifiedAt: true } }) : null;
  return u && !isPendingInvite(u) ? u : null;
}

/**
 * The form's step: stores the sign-up and emails its code (or, for an email with an account, the "you already have
 * one" note). Same answer, and about the same time, either way. Returns the ticket that goes with the code.
 */
export async function startSignup(input: SignupInput, ip: string | null) {
  await enforce(ipKey("signup", ip), LIMITS.signupIp);
  // Says nothing about the account: it's about the password alone
  await assertNotBreached(input.password);
  const existing = await existingAccount(input.email);
  const ticket = newToken();
  const code = existing ? null : newCode();
  const expiresAt = new Date(Date.now() + CODE_MINUTES * 60_000);
  await db.signupRequest.create({
    data: {
      tokenHash: sha256(ticket), email: input.email, name: input.name, familyName: input.familyName,
      passwordHash: await hashPassword(input.password), codeHash: code ? codeHash(ticket, code) : null, expiresAt,
    },
  });
  sendLater(input.email, input.name, code, existing ? { hasPassword: existing.passwordSet } : null);
  return { ticket, expiresAt, email: input.email };
}

/** "Send a new code". A sign-up for an email with an account sends its note again instead, so it looks the same. */
export async function resendSignupCode(ticket: string) {
  const r = await liveRequest(ticket);
  if (Date.now() - r.sentAt.getTime() < RESEND_SECONDS * 1000) {
    throw new ServiceError(429, "We just sent a code. Check your inbox, or try again in a minute.", "rate_limited");
  }
  if (r.sends >= MAX_SENDS) throw new ServiceError(429, "That's the most codes we can send for one sign-up. Fill in the form again.", "rate_limited");
  const code = r.codeHash ? newCode() : null;
  const expiresAt = new Date(Date.now() + CODE_MINUTES * 60_000);
  // A new code starts with fresh attempts; the old one stops working
  await db.signupRequest.update({
    where: { id: r.id },
    data: { codeHash: code ? codeHash(ticket, code) : null, attempts: 0, sends: { increment: 1 }, sentAt: new Date(), expiresAt },
  });
  const existing = code ? null : await existingAccount(r.email);
  sendLater(r.email, r.name, code, code ? null : { hasPassword: existing?.passwordSet ?? true });
  return { expiresAt, email: r.email };
}

/** The sign-up a ticket belongs to, while it can still be finished. Where the code page gets the email to show. */
export async function pendingSignup(ticket: string | undefined | null) {
  if (!ticket) return null;
  const r = await db.signupRequest.findUnique({ where: { tokenHash: sha256(ticket) }, select: { email: true, expiresAt: true } });
  return r && r.expiresAt > new Date() ? r : null;
}

/** The code step: creates the family and its admin (email verified) and returns the new user. */
export async function finishSignup(ticket: string, code: string, ip: string | null) {
  await enforce(ipKey("token", ip), LIMITS.tokenIp);
  const r = await liveRequest(ticket);
  // Counted before checking, so parallel guesses can't share one attempt
  const counted = await db.signupRequest.updateMany({ where: { id: r.id, attempts: { lt: CODE_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
  if (!counted.count) {
    await db.signupRequest.deleteMany({ where: { id: r.id } });
    throw new ServiceError(400, "Too many wrong codes. Fill in the form again to get a new one.", "signup_expired");
  }
  const given = normalizeCode(code);
  const ok = !!r.codeHash && given.length === 6 && timingSafeEqual(Buffer.from(codeHash(ticket, given)), Buffer.from(r.codeHash));
  if (!ok) throw new ServiceError(400, WRONG_CODE, "wrong_code");
  // The mailbox is proven: every other sign-up waiting for it goes too
  await db.signupRequest.deleteMany({ where: { email: r.email } });
  return createFamily({ name: r.name, familyName: r.familyName, email: r.email, passwordHash: r.passwordHash, emailVerified: true });
}

async function liveRequest(ticket: string) {
  const r = ticket ? await db.signupRequest.findUnique({ where: { tokenHash: sha256(ticket) } }) : null;
  if (!r || r.expiresAt < new Date()) throw new ServiceError(400, SIGNUP_EXPIRED, "signup_expired");
  return r;
}

/**
 * After the response, so its timing doesn't depend on which email goes out. At most a few an hour reach one
 * address, whatever the form is sent with, so it can't be used to flood someone's inbox; the cap is silent.
 */
function sendLater(to: string, name: string, code: string | null, existing: { hasPassword: boolean } | null) {
  const send = async () => {
    try {
      if ((await hit(`signup:mail:${to}`, LIMITS.signupMail)).limited) return;
      await sendMail({ to, ...(code ? codeEmail(name, code) : existingAccountEmail(name, existing?.hasPassword ?? true)) });
    } catch (e) {
      console.error("[mail] sign-up email failed", e);
    }
  };
  try { after(send); } catch { void send(); }
}

export function codeEmail(name: string, code: string) {
  const first = name.split(/\s+/)[0];
  const note = `It expires in ${CODE_MINUTES} minutes. If you didn't try to create an eGuard account, ignore this email: nothing is set up without the code.`;
  return {
    subject: `${code} is your eGuard sign-up code`,
    text: `Hi ${first},\n\nEnter this code to finish creating your eGuard account:\n\n${code}\n\n${note}\n\n— eGuard`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Enter this code to finish creating your eGuard account:</p>`
      + `<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>`
      + `<p style="color:#555;font-size:13px">${escapeHtml(note)}</p>`,
  };
}

/** `name` is what the form was filled in with, which may not be the account owner's: it isn't used. */
export function existingAccountEmail(_name: string, hasPassword: boolean) {
  const login = `${appUrl()}/login`, reset = `${appUrl()}/forgot-password`;
  const how = hasPassword
    ? `Sign in at ${login}. Forgot your password? Choose a new one at ${reset}.`
    : `You signed up with Google, Apple or LinkedIn: sign in with it at ${login}, or set a password at ${reset}.`;
  const lead = "Someone, hopefully you, tried to create a new eGuard account with this email. It already has one, so nothing new was set up.";
  const ignore = "If this wasn't you, ignore this email. Your account hasn't changed.";
  return {
    subject: "You already have an eGuard account",
    text: `Hi,\n\n${lead}\n\n${how}\n\n${ignore}\n\n— eGuard`,
    html: `<p>Hi,</p><p>${escapeHtml(lead)}</p>`
      + `<p><a href="${login}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">Sign in</a></p>`
      + `<p>${hasPassword ? `Forgot your password? <a href="${reset}">Choose a new one</a>.` : `You signed up with Google, Apple or LinkedIn: sign in with it, or <a href="${reset}">set a password</a>.`}</p>`
      + `<p style="color:#555;font-size:13px">${escapeHtml(ignore)}</p>`,
  };
}
