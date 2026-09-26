import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "./db";

const COOKIE = "eg_session";
const SESSION_DAYS = 30;

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = newToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({
    data: { userId, tokenHash: sha256(token), userAgent: h.get("user-agent")?.slice(0, 200) ?? null, expiresAt },
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
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
  role: Role;
  familyId: string;
  sessionId: string;
};

/** Current user, or null. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  if (Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  const u = s.user;
  return { id: u.id, name: u.name, email: u.email, role: u.role, familyId: u.familyId, sessionId: s.id };
});

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "FAMILY_ADMIN") throw new Error("Only the family admin can do this.");
  return u;
}

/* Simple in-memory limiter for login attempts (per process). */
const attempts = new Map<string, { n: number; until: number }>();
export function loginRateLimited(key: string) {
  const a = attempts.get(key);
  return !!a && a.n >= 5 && a.until > Date.now();
}
export function noteLoginFailure(key: string) {
  const a = attempts.get(key);
  const n = a && a.until > Date.now() ? a.n + 1 : 1;
  attempts.set(key, { n, until: Date.now() + 10 * 60_000 });
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
