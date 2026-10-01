import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { ServiceError, forbidden } from "./errors";
import { LIMITS, clearLimit, hit, ipKey, isLimited } from "./rate-limit";
import { PATH_HEADER, loginPath, safeNext } from "./return-to";

const COOKIE = "eg_session";
const SESSION_DAYS = 30;

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/**
 * An invited parent who hasn't accepted yet (lib/invitations): no password of their own and an email nobody has
 * proved. They can't sign in, and the invitation never stands in the way of the person signing up for themselves.
 */
export const isPendingInvite = (u: { role: Role; passwordSet: boolean; emailVerifiedAt: Date | null }) =>
  u.role === "PARENT" && !u.passwordSet && !u.emailVerifiedAt;

/** Shortest password a parent can choose (sign-up, reset, accepting an invitation). */
export const MIN_PASSWORD = 10;

/** bcrypt ignores everything past 72 bytes, so a longer password would silently match its own prefix. */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_TOO_LONG = "Use a shorter password (up to 72 characters).";
export const passwordTooLong = (pw: string) => Buffer.byteLength(pw, "utf8") > PASSWORD_MAX_BYTES;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/** Creates a DB session and returns its raw token. Used by the cookie (web) and bearer (mobile) flows. */
export async function issueSession(userId: string, userAgent: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  const session = await db.session.create({
    data: { userId, tokenHash: sha256(token), userAgent: userAgent?.slice(0, 200) ?? null, expiresAt },
  });
  return { token, expiresAt, sessionId: session.id };
}

/** Resolves a raw session token (cookie or bearer) to the signed-in user. */
export async function userForToken(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  if (Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  const u = s.user;
  return { id: u.id, name: u.name, email: u.email, emailVerified: !!u.emailVerifiedAt, role: u.role, familyId: u.familyId, sessionId: s.id };
}

export async function createSession(userId: string) {
  const h = await headers();
  const { token, expiresAt } = await issueSession(userId, h.get("user-agent"));
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Forgets the browser's session cookie (after the account itself is gone). */
export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  familyId: string;
  sessionId: string;
};

/** Current user, or null. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? userForToken(token) : null;
});

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect(loginPath(safeNext((await headers()).get(PATH_HEADER))));
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "FAMILY_ADMIN") throw forbidden();
  return u;
}

/** Compared against when the email has no account, so a miss takes as long as a wrong password. */
let dummyHash: Promise<string> | undefined;
const timingDecoy = () => (dummyHash ??= bcrypt.hash(newToken(), 12));

export const BAD_CREDENTIALS = "That email and password don't match an eGuard account.";

/**
 * Email + password sign-in, shared by web and mobile. Failures count against the account (from any
 * address) and against the address (across accounts), in the database, so limits survive restarts.
 */
export async function authenticate(email: string, password: string, ip: string | null) {
  const accountKey = `login:acct:${email}`, addrKey = ipKey("login", ip);
  if ((await isLimited(accountKey, LIMITS.loginAccount)) || (await isLimited(addrKey, LIMITS.loginIp))) {
    throw new ServiceError(429, "Too many attempts. Wait 15 minutes and try again, or reset your password.", "rate_limited");
  }
  const user = await db.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await timingDecoy()), false);
  if (!user || !ok) {
    await Promise.all([hit(accountKey, LIMITS.loginAccount), hit(addrKey, LIMITS.loginIp)]);
    throw new ServiceError(401, BAD_CREDENTIALS, "invalid_credentials");
  }
  await clearLimit(accountKey);
  return user;
}

/** Checks the signed-in parent's password before a sensitive change. Social-only accounts have none yet. */
export async function confirmPassword(userId: string, password: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordSet) {
    throw new ServiceError(403, "Set a password first: sign out and use \"Forgot password\" to create one.", "password_not_set");
  }
  const key = `confirm:${userId}`;
  if (await isLimited(key, LIMITS.loginAccount)) throw new ServiceError(429, "Too many attempts. Wait 15 minutes and try again.", "rate_limited");
  if (!(await verifyPassword(password, user.passwordHash))) {
    await hit(key, LIMITS.loginAccount);
    throw new ServiceError(403, "That password isn't right.", "wrong_password");
  }
  await clearLimit(key);
  return user;
}
