import "server-only";
import { db } from "./db";
import { newToken, sha256 } from "./auth";
import { audit } from "./audit";
import { ServiceError, conflict } from "./errors";
import { LIMITS, clearLimit, hit, isLimited } from "./rate-limit";
import { matchStep, newRecoveryCode, newSecret, normalizeCode, openSecret, otpauthUri, base32Encode, sealSecret, secretKey } from "./totp";

/**
 * Two-step verification: after the password (or a password-reset link, or Apple/Google), a 6-digit code from an
 * authenticator app, or one of ten single-use recovery codes. Shared by the web and the mobile API.
 */

export const RECOVERY_CODES = 10;
const CHALLENGE_MINUTES = 10;
/** Wrong codes for one sign-in before it has to start over with the password */
const CHALLENGE_ATTEMPTS = 5;

/** Needs TWO_FACTOR_KEY in production, which encrypts the secrets; without it the feature stays off. */
export const twoFactorAvailable = () => secretKey() !== null;

const WRONG_CODE = "That code isn't right. Check the app and try again; codes change every 30 seconds.";
const unavailable = () => new ServiceError(503, "Two-step verification isn't available yet.", "two_factor_unavailable");

function key() {
  const k = secretKey();
  if (!k) throw unavailable();
  return k;
}

type Who = { id: string; email: string; name: string; familyId: string };

/** Step 1 of turning it on: a new secret, kept aside until a code from it is confirmed. */
export async function startSetup(user: Who) {
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { twoFactor: true } });
  if (u.twoFactor) throw conflict("Two-step verification is already on.");
  const secret = newSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecret: sealSecret(secret, key()), totpLastStep: null } });
  return { secret: base32Encode(secret), uri: otpauthUri(secret, user.email) };
}

/** Step 2: a code from the app proves it's set up. Turns it on and returns the recovery codes, shown once. */
export async function confirmSetup(user: Who, code: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { twoFactor: true, totpSecret: true } });
  if (u.twoFactor) throw conflict("Two-step verification is already on.");
  if (!u.totpSecret) throw new ServiceError(400, "Start again: the setup expired.", "setup_missing");
  await throttle(user.id);
  const step = matchStep(openSecret(u.totpSecret, key()), normalizeCode(code));
  if (step === null) { await miss(user.id); throw new ServiceError(400, WRONG_CODE, "wrong_code"); }
  // Only the first of two confirmations at once turns it on (and makes the codes the parent sees)
  const on = await db.user.updateMany({ where: { id: user.id, twoFactor: false, totpSecret: u.totpSecret }, data: { twoFactor: true, totpLastStep: step } });
  if (!on.count) throw conflict("Two-step verification is already on.");
  await clearLimit(limitKey(user.id));
  const codes = await replaceRecoveryCodes(user.id);
  await audit(user.familyId, user.name, "security.two_factor.on", "Authenticator app");
  return { recoveryCodes: codes };
}

/** Turning it off, or making new recovery codes, needs a current code (or a recovery code). */
export async function disable(user: Who, code: string) {
  await requireCode(user.id, code);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { twoFactor: false, totpSecret: null, totpLastStep: null } }),
    db.recoveryCode.deleteMany({ where: { userId: user.id } }),
    db.loginChallenge.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit(user.familyId, user.name, "security.two_factor.off", "");
}

export async function regenerateRecoveryCodes(user: Who, code: string) {
  await requireCode(user.id, code);
  const codes = await replaceRecoveryCodes(user.id);
  await audit(user.familyId, user.name, "security.two_factor.recovery_codes", "New recovery codes; the old ones stopped working");
  return { recoveryCodes: codes };
}

export async function status(userId: string) {
  const [u, left] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { twoFactor: true } }),
    db.recoveryCode.count({ where: { userId, usedAt: null } }),
  ]);
  return { available: twoFactorAvailable(), enabled: u.twoFactor, recoveryCodesLeft: u.twoFactor ? left : 0 };
}

async function replaceRecoveryCodes(userId: string) {
  const codes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: sha256(normalizeCode(c)) })) }),
  ]);
  return codes;
}

/* ---------- Checking a code ---------- */

const limitKey = (userId: string) => `2fa:${userId}`;
async function throttle(userId: string) {
  if (await isLimited(limitKey(userId), LIMITS.loginAccount)) {
    throw new ServiceError(429, "Too many wrong codes. Wait 15 minutes and try again.", "rate_limited");
  }
}
const miss = (userId: string) => hit(limitKey(userId), LIMITS.loginAccount);

/**
 * An authenticator code (once per 30-second step: a code someone saw can't be replayed) or an unused recovery
 * code (used up). Returns whether it was a recovery code; false when neither matches.
 */
export async function checkCode(userId: string, code: string): Promise<{ ok: boolean; recovery: boolean }> {
  const c = normalizeCode(code);
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { twoFactor: true, totpSecret: true, totpLastStep: true } });
  if (!u.twoFactor || !u.totpSecret) return { ok: false, recovery: false };
  if (/^\d{6}$/.test(c)) {
    const step = matchStep(openSecret(u.totpSecret, key()), c);
    if (step === null || (u.totpLastStep !== null && step <= u.totpLastStep)) return { ok: false, recovery: false };
    // Compare-and-swap, so the same code sent twice at once only works once
    const used = await db.user.updateMany({ where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } });
    return { ok: used.count === 1, recovery: false };
  }
  const used = await db.recoveryCode.updateMany({ where: { userId, codeHash: sha256(c), usedAt: null }, data: { usedAt: new Date() } });
  return { ok: used.count === 1, recovery: true };
}

async function requireCode(userId: string, code: string) {
  await throttle(userId);
  const r = await checkCode(userId, code);
  if (!r.ok) { await miss(userId); throw new ServiceError(400, WRONG_CODE, "wrong_code"); }
  await clearLimit(limitKey(userId));
  return r;
}

/* ---------- Signing in ---------- */

/** On the web, the sign-in waiting for its code: httpOnly, and only as long as the challenge itself. */
export const CHALLENGE_COOKIE = "eg_2fa";

/**
 * Whether signing in as this parent needs the second step. Fails closed: if TWO_FACTOR_KEY went missing, the code
 * step reports itself unavailable rather than letting a password alone in.
 */
export const needsSecondStep = (u: { twoFactor: boolean }) => u.twoFactor;

/** The first step passed: a short-lived token for the code step. No session exists until that passes. */
export async function startChallenge(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_MINUTES * 60_000);
  await db.loginChallenge.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
  return { challenge: token, expiresAt };
}

const EXPIRED = "This sign-in expired. Sign in again with your password.";

/** The code step. Returns the user to issue a session for, and whether a recovery code was used. */
export async function completeChallenge(challenge: string, code: string) {
  const ch = await db.loginChallenge.findUnique({ where: { tokenHash: sha256(challenge) }, include: { user: true } });
  if (!ch || ch.expiresAt < new Date()) throw new ServiceError(401, EXPIRED, "challenge_expired");
  // Counted before checking, so parallel guesses can't share one attempt
  const counted = await db.loginChallenge.updateMany({ where: { id: ch.id, attempts: { lt: CHALLENGE_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
  if (!counted.count) {
    await db.loginChallenge.deleteMany({ where: { id: ch.id } });
    throw new ServiceError(401, "Too many wrong codes. Sign in again with your password.", "challenge_expired");
  }
  const r = await requireCode(ch.userId, code);
  // Single use: a second request with the same challenge finds nothing
  const gone = await db.loginChallenge.deleteMany({ where: { id: ch.id } });
  if (!gone.count) throw new ServiceError(401, EXPIRED, "challenge_expired");
  if (r.recovery) {
    await audit(ch.user.familyId, ch.user.name, "security.two_factor.recovery_used", "Signed in with a recovery code");
  }
  const left = r.recovery ? await db.recoveryCode.count({ where: { userId: ch.userId, usedAt: null } }) : null;
  return { user: ch.user, usedRecoveryCode: r.recovery, recoveryCodesLeft: left };
}
