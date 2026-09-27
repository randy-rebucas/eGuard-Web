import "server-only";
import { NextResponse } from "next/server";
import { db } from "./db";
import { issueSession } from "./auth";
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
    /** Two-step verification isn't available yet; always false */
    twoFactor: false,
    createdAt: u.createdAt,
  };
}

/** Issues a bearer session for the app. Store `token` in the Keychain; it lasts 30 days. */
export async function sessionResponse(req: Request, userId: string, status = 200, extra: Record<string, unknown> = {}) {
  const { token, expiresAt } = await issueSession(userId, req.headers.get("user-agent"));
  return NextResponse.json({ token, expiresAt, user: await meJson(userId), ...extra }, { status });
}

/** "Randy Cruz" → "Cruz Family"; "Randy" → "Randy's Family". The app's sign-up form doesn't ask for it. */
export function defaultFamilyName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[parts.length - 1]} Family` : `${parts[0]}'s Family`;
}

export const clientIp = (req: Request) => clientIpFrom(req.headers);
