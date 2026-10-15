import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { ServiceError, forbidden } from "./errors";
import { LIMITS, clearLimit, clientIpFrom, hit, ipKey, isLimited } from "./rate-limit";
import { PATH_HEADER, loginPath, safeNext } from "./return-to";
import { type SignInDevice, noteSignIn } from "./sign-in-notice";
import { summarizeAgent } from "./user-agent";

/**
 * A cookie only this host can set or read: __Host- makes the browser refuse it unless it's Secure, path=/ and has no
 * Domain, so another subdomain can't plant or overwrite it. Plain in development, which runs over http.
 */
export const hostCookie = (name: string) => (process.env.NODE_ENV === "production" ? `__Host-${name}` : name);

const COOKIE = hostCookie("eg_session");
/**
 * The session cookie's name before 2026-10-15. Still read, so nobody was signed out by the rename; sessions issued
 * under it are all expired by 2026-11-14, after which this can go.
 */
const LEGACY_COOKIE = "eg_session";
/** Remembers this browser for "New sign-in" emails (lib/sign-in-notice). Not a session: it signs nobody in. */
const DEVICE_COOKIE = hostCookie("eg_device");
const SESSION_DAYS = 30;
/** A browser session also ends after this long unused. App sessions don't (Session.web). */
export const WEB_IDLE_DAYS = 14;

const cookieBase = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" });

/**
 * Removes a cookie this app set. Next's cookies().delete() sends the expired cookie without Secure, which a browser
 * ignores for a __Host- one, so it's expired here with the attributes it was set with.
 */
export async function clearCookie(name: string) {
  (await cookies()).set(name, "", { ...cookieBase(), maxAge: 0 });
}

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

/**
 * Kept from bcrypt, which ignores everything past 72 bytes: passwords hashed with it before 2026-10-15 were checked
 * against this limit, and the apps check the same one.
 */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_TOO_LONG = "Use a shorter password (up to 72 characters).";
export const passwordTooLong = (pw: string) => Buffer.byteLength(pw, "utf8") > PASSWORD_MAX_BYTES;

/** argon2id at OWASP's recommended minimum: 19 MiB of memory, 2 passes, 1 lane. */
const ARGON2 = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const CURRENT_HASH = `$argon2id$v=19$m=${ARGON2.memoryCost},t=${ARGON2.timeCost},p=${ARGON2.parallelism}$`;

export async function hashPassword(pw: string) {
  return argon2Hash(pw, ARGON2);
}
/** Checks argon2id hashes, and the bcrypt ones made before 2026-10-15 (upgraded at the next sign-in, see rehashIfOld). */
export async function verifyPassword(pw: string, hash: string) {
  if (hash.startsWith("$argon2")) return argon2Verify(hash, pw).catch(() => false);
  return bcrypt.compare(pw, hash);
}
/** True for a bcrypt hash, or argon2 with older settings: re-hash it while the plain password is at hand. */
export const isOldHash = (hash: string) => !hash.startsWith(CURRENT_HASH);

/**
 * After a correct password: stores it hashed with the current settings if it isn't already. Only replaces the hash
 * that was checked, so a password changed in the meantime is never overwritten.
 */
async function rehashIfOld(userId: string, checkedHash: string, password: string) {
  if (!isOldHash(checkedHash)) return;
  try {
    await db.user.updateMany({ where: { id: userId, passwordHash: checkedHash }, data: { passwordHash: await hashPassword(password) } });
  } catch (e) {
    // The old hash still works: try again next time rather than fail the sign-in
    console.error("[auth] password re-hash failed", e);
  }
}

/**
 * Creates a DB session and returns its raw token. Used by the cookie (web) and bearer (mobile) flows. `device` is
 * where the sign-in came from: a new one is emailed to the parent (lib/sign-in-notice), never failing the sign-in.
 */
export async function issueSession(userId: string, userAgent: string | null, opts: { web?: boolean; device?: SignInDevice } = {}) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  const session = await db.session.create({
    data: { userId, tokenHash: sha256(token), userAgent: userAgent?.slice(0, 200) ?? null, expiresAt, web: opts.web ?? false },
  });
  if (opts.device) await noteSignIn(userId, opts.device).catch((e) => console.error("[auth] sign-in notice failed", e));
  return { token, expiresAt, sessionId: session.id };
}

/** Resolves a raw session token (cookie or bearer) to the signed-in user. */
export async function userForToken(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true, expiresAt: true, lastSeenAt: true, web: true,
      user: { select: { id: true, name: true, email: true, emailVerifiedAt: true, role: true, familyId: true, passwordSet: true, introSeenAt: true } },
    },
  });
  if (!s || s.expiresAt < new Date()) return null;
  if (s.web && Date.now() - s.lastSeenAt.getTime() > WEB_IDLE_DAYS * 864e5) {
    await db.session.deleteMany({ where: { id: s.id } });
    return null;
  }
  if (Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  const u = s.user;
  return { id: u.id, name: u.name, email: u.email, emailVerified: !!u.emailVerifiedAt, hasPassword: u.passwordSet, role: u.role, familyId: u.familyId, sessionId: s.id, introSeen: !!u.introSeenAt };
}

/** This browser's device id (DEVICE_COOKIE), made on its first sign-in. Kept across sign-outs: it's how it's known. */
async function browserDeviceId() {
  const jar = await cookies();
  const id = jar.get(DEVICE_COOKIE)?.value;
  if (id && /^[\w-]{16,64}$/.test(id)) return id;
  const fresh = newToken(16);
  jar.set(DEVICE_COOKIE, fresh, { ...cookieBase(), maxAge: 400 * 86400 });
  return fresh;
}

export async function createSession(userId: string) {
  const h = await headers();
  const ua = h.get("user-agent");
  const device = { id: await browserDeviceId(), userAgent: ua, ip: clientIpFrom(h), label: summarizeAgent(ua) };
  const { token, expiresAt } = await issueSession(userId, ua, { web: true, device });
  const jar = await cookies();
  jar.set(COOKIE, token, { ...cookieBase(), expires: expiresAt });
  if (LEGACY_COOKIE !== COOKIE) await clearCookie(LEGACY_COOKIE);
}

/** Forgets the browser's session cookie (after the account itself is gone). */
export async function clearSessionCookie() {
  await clearCookie(COOKIE);
  if (LEGACY_COOKIE !== COOKIE) await clearCookie(LEGACY_COOKIE);
}

/** The raw session token this browser sent, under the current cookie name or the old one. */
async function sessionToken() {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value;
}

export async function destroySession() {
  const token = await sessionToken();
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  await clearSessionCookie();
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /** false for Apple/Google accounts until they set one: they confirm deletions by typing DELETE instead */
  hasPassword: boolean;
  role: Role;
  familyId: string;
  sessionId: string;
  /** The parent has closed the web app's first-run intro (components/tour) */
  introSeen: boolean;
};

/** Current user, or null. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = await sessionToken();
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
export const timingDecoy = () => (dummyHash ??= hashPassword(newToken()));

export const BAD_CREDENTIALS = "That email and password don't match an eGuard account.";

/**
 * Rate-limit keys for failed sign-ins: `pair` is one account from one address, `account` is that account from
 * everywhere. An unknown address (no proxy in front) shares one pair, which acts like the account-wide limit.
 */
export const loginKeys = (email: string, ip: string | null) => ({ pair: `login:acct:${email}:ip:${ip ?? "unknown"}`, account: `login:acct:${email}` });

/**
 * Email + password sign-in, shared by web and mobile. Failures count against the account from that address (10),
 * the account from everywhere (50, for guessing spread over many addresses) and the address across accounts, in the
 * database, so limits survive restarts. Someone else's wrong guesses don't lock the parent out of their own phone.
 */
export async function authenticate(email: string, password: string, ip: string | null) {
  const { pair, account } = loginKeys(email, ip), addrKey = ipKey("login", ip);
  const limited = await Promise.all([isLimited(pair, LIMITS.loginAccount), isLimited(account, LIMITS.loginAccountAll), isLimited(addrKey, LIMITS.loginIp)]);
  if (limited.some(Boolean)) {
    throw new ServiceError(429, "Too many attempts. Wait 15 minutes and try again, or reset your password.", "rate_limited");
  }
  const user = await db.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await timingDecoy()), false);
  if (!user || !ok) {
    await Promise.all([hit(pair, LIMITS.loginAccount), hit(account, LIMITS.loginAccountAll), hit(addrKey, LIMITS.loginIp)]);
    throw new ServiceError(401, BAD_CREDENTIALS, "invalid_credentials");
  }
  // Only this address's count: the account-wide one runs out on its own, so signing in can't reset another's guesses
  await clearLimit(pair);
  await rehashIfOld(user.id, user.passwordHash, password);
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
  await rehashIfOld(userId, user.passwordHash, password);
  return user;
}

/** What a parent types to confirm a deletion when their account has no password (Apple/Google sign-in). */
export const DELETE_PHRASE = "DELETE";

/**
 * Confirms a deletion (the account, a child, a device, a browser): the password when the account has one, else the
 * typed phrase, so Apple/Google parents aren't sent off to set a password first. Changing the password or email
 * still needs confirmPassword.
 */
export async function confirmDestructive(userId: string, confirm: { password?: string; phrase?: string }) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordSet: true } });
  if (user.passwordSet) {
    await confirmPassword(userId, confirm.password ?? "");
    return;
  }
  if (confirm.phrase?.trim() !== DELETE_PHRASE) throw new ServiceError(400, `Type ${DELETE_PHRASE} to confirm.`, "confirm_required");
}
