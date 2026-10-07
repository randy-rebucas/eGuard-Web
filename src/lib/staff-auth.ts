import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { hashPassword, newToken, sha256, verifyPassword } from "./auth";
import { ServiceError } from "./errors";
import { LIMITS, clearLimit, clientIpFrom, hit, ipKey, isLimited } from "./rate-limit";
import { matchStep, normalizeCode, openSecret, secretKey } from "./totp";
import { STAFF_COOKIE } from "./console-host";

/**
 * Staff sign-in for the console (console.eguard.family, docs/console.md). Separate from parents' sessions on
 * purpose: its own table and its own host-only cookie, so a parent's session never opens the console and a staff
 * session is never sent to www.
 */

/** A session ends 12 hours after signing in, or after 30 minutes without a request, whichever comes first. */
const SESSION_HOURS = 12;
const IDLE_MINUTES = 30;

export const STAFF_BAD_LOGIN = "Those details don't match a staff account.";

export type Staff = { id: string; name: string; email: string; sessionId: string };

/** Compared against when the email has no staff account, so a miss takes as long as a wrong password. */
let dummyHash: Promise<string> | undefined;
const timingDecoy = () => (dummyHash ??= hashPassword(newToken()));

/**
 * Email, password and authenticator code, all three in one step: a wrong one never says which. Failures count
 * against the email (from anywhere) and the address (across emails). A code works once.
 */
export async function authenticateStaff(email: string, password: string, code: string, ip: string | null) {
  const accountKey = `staff:acct:${email}`, addrKey = ipKey("staff", ip);
  if ((await isLimited(accountKey, LIMITS.staffLoginAccount)) || (await isLimited(addrKey, LIMITS.staffLoginIp))) {
    throw new ServiceError(429, "Too many attempts. Wait 15 minutes and try again.", "rate_limited");
  }
  // Fails closed: without the key no code can be checked, so nobody signs in
  const key = secretKey();
  if (!key) throw new ServiceError(503, "Sign-in is unavailable: TWO_FACTOR_KEY isn't set on this server.", "unavailable");

  const staff = await db.staffUser.findUnique({ where: { email } });
  const passwordOk = staff ? await verifyPassword(password, staff.passwordHash) : (await verifyPassword(password, await timingDecoy()), false);
  let step: number | null = null;
  if (staff && passwordOk && staff.active) {
    step = matchStep(openSecret(staff.totpSecret, key), normalizeCode(code));
    if (step !== null && staff.totpLastStep !== null && step <= staff.totpLastStep) step = null;
  }
  // Compare-and-swap, so the same code sent twice at once only works once
  const used = staff && step !== null
    ? await db.staffUser.updateMany({
      where: { id: staff.id, active: true, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step, lastLoginAt: new Date() },
    })
    : { count: 0 };
  if (!staff || !used.count) {
    await Promise.all([hit(accountKey, LIMITS.staffLoginAccount), hit(addrKey, LIMITS.staffLoginIp)]);
    throw new ServiceError(401, STAFF_BAD_LOGIN, "invalid_credentials");
  }
  await clearLimit(accountKey);
  return { id: staff.id, name: staff.name, email: staff.email };
}

/** Signs the browser in: a new session row and the host-only cookie. */
export async function startStaffSession(staffId: string) {
  const h = await headers();
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db.staffSession.create({
    data: { staffId, tokenHash: sha256(token), userAgent: h.get("user-agent")?.slice(0, 200) ?? null, ip: clientIpFrom(h), expiresAt },
  });
  (await cookies()).set(STAFF_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
  });
  await logStaff(staffId, "staff.login");
}

export async function endStaffSession() {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (token) await db.staffSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(STAFF_COOKIE);
}

/** The signed-in staff member, or null. Cached per request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const s = await db.staffSession.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, expiresAt: true, lastSeenAt: true, staff: { select: { id: true, name: true, email: true, active: true } } },
  });
  if (!s) return null;
  const now = Date.now();
  if (s.expiresAt.getTime() < now || now - s.lastSeenAt.getTime() > IDLE_MINUTES * 60_000 || !s.staff.active) {
    await db.staffSession.deleteMany({ where: { id: s.id } });
    return null;
  }
  if (now - s.lastSeenAt.getTime() > 60_000) {
    await db.staffSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
  }
  return { id: s.staff.id, name: s.staff.name, email: s.staff.email, sessionId: s.id };
});

/** The signed-in staff member, or off to the console's sign-in page (/login on the console host). */
export async function requireStaff() {
  const s = await getStaff();
  if (!s) redirect("/login");
  return s;
}

/** Records what a staff member did or opened. `target` is "kind:id", e.g. "family:clx…". */
export async function logStaff(staffId: string, action: string, target?: string, detail?: string) {
  await db.staffAuditLog.create({ data: { staffId, action, target: target ?? null, detail: detail?.slice(0, 500) ?? null } });
}
