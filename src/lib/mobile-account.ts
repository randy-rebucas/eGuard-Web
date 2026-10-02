import "server-only";
import { NextResponse } from "next/server";
import { db } from "./db";
import { issueSession } from "./auth";
import { needsSecondStep, startChallenge } from "./two-factor";
import { clientIpFrom } from "./rate-limit";

/** The signed-in parent, as returned by /me and every sign-in endpoint. */
export async function meJson(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { family: true } });
  return {
    id: u.id, name: u.name, firstName: u.name.split(/\s+/)[0], email: u.email, role: u.role,
    /** false: show "Verify your email"; pairing a device returns 403 email_unverified until it's true */
    emailVerified: !!u.emailVerifiedAt,
    family: { id: u.family.id, name: u.family.name, timezone: u.family.timezone },
    notifications: { notifyPush: u.notifyPush, notifyEmail: u.notifyEmail, notifyApproval: u.notifyApproval, weeklySummary: u.weeklySummary },
    /** false for Apple/Google accounts until they set a password via /auth/forgot-password */
    hasPassword: u.passwordSet,
    /** Two-step verification is on: signing in returns `twoFactorRequired` before a session (see /auth/two-factor) */
    twoFactor: u.twoFactor,
    createdAt: u.createdAt,
  };
}

/** Issues a bearer session for the app. Store `token` in the Keychain; it lasts 30 days. */
export async function sessionResponse(req: Request, userId: string, status = 200, extra: Record<string, unknown> = {}) {
  const { token, expiresAt } = await issueSession(userId, req.headers.get("user-agent"));
  return NextResponse.json({ token, expiresAt, user: await meJson(userId), ...extra }, { status });
}

/**
 * The answer to a sign-in that got past its first step (password, Apple/Google, reset link). With two-step
 * verification on, no session yet: the app sends `challenge` and a code to /auth/two-factor.
 */
export async function signInResponse(req: Request, userId: string, status = 200, extra: Record<string, unknown> = {}) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { twoFactor: true } });
  if (!needsSecondStep(u)) return sessionResponse(req, userId, status, extra);
  const { challenge, expiresAt } = await startChallenge(userId);
  return NextResponse.json({ twoFactorRequired: true, challenge, expiresAt, ...extra }, { status: 200 });
}

/** "Randy Cruz" → "Cruz Family"; "Randy" → "Randy's Family". The app's sign-up form doesn't ask for it. */
export function defaultFamilyName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[parts.length - 1]} Family` : `${parts[0]}'s Family`;
}

export const clientIp = (req: Request) => clientIpFrom(req.headers);
