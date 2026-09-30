import "server-only";
import { db } from "./db";
import { ServiceError } from "./errors";

/**
 * Fixed-window rate limits kept in Postgres, so they hold across server instances and restarts.
 * `hit` counts an attempt and says whether the caller is still within the limit.
 */

export type Limit = { max: number; windowMs: number };

export const LIMITS = {
  /** failed sign-ins for one account, from anywhere (stops password guessing from rotating IPs) */
  loginAccount: { max: 10, windowMs: 15 * 60_000 },
  /** failed sign-ins from one address, across accounts (stops password spraying) */
  loginIp: { max: 30, windowMs: 15 * 60_000 },
  signupIp: { max: 10, windowMs: 60 * 60_000 },
  socialIp: { max: 30, windowMs: 15 * 60_000 },
  pairIp: { max: 20, windowMs: 15 * 60_000 },
  /** pairing codes a parent creates (each new one replaces the child's previous code) */
  pairCodeUser: { max: 20, windowMs: 60 * 60_000 },
  tokenIp: { max: 30, windowMs: 15 * 60_000 },
  resetEmail: { max: 3, windowMs: 60 * 60_000 },
  resetIp: { max: 10, windowMs: 60 * 60_000 },
  supportUser: { max: 10, windowMs: 60 * 60_000 },
  /** events one child device reports (each can add an app row or an alert); a real phone sends a handful an hour */
  deviceEvents: { max: 120, windowMs: 60 * 60_000 },
} satisfies Record<string, Limit>;

/**
 * Counts one attempt against `key`; returns the new count and whether it is over `max`.
 * A null key (per-address limit when the address is unknown) is never limited.
 */
export async function hit(key: string | null, { max, windowMs }: Limit) {
  if (!key) return { count: 0, limited: false };
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  return { count, limited: count > max };
}

/** True when `key` is already over its limit, without counting an attempt. */
export async function isLimited(key: string | null, { max }: Limit) {
  if (!key) return false;
  const r = await db.rateLimit.findUnique({ where: { key } });
  return !!r && r.resetAt > new Date() && r.count >= max;
}

export const clearLimit = (key: string) => db.rateLimit.deleteMany({ where: { key } });

export const TOO_MANY = "Too many attempts. Wait a few minutes and try again.";

/** Counts an attempt and throws 429 once over the limit. */
export async function enforce(key: string | null, limit: Limit, message = TOO_MANY) {
  if ((await hit(key, limit)).limited) throw new ServiceError(429, message, "rate_limited");
}

/**
 * The client's address, or null when unknown. Behind a proxy, the last X-Forwarded-For entry is the
 * one the proxy itself added, so a client can't spoof it by sending its own header. Set
 * TRUSTED_PROXY_HOPS when more than one proxy sits in front of the app (e.g. CDN + load balancer).
 * Without a proxy there is no header and per-address limits are skipped (per-account ones still apply);
 * deploy behind one so they take effect.
 */
export function clientIpFrom(h: Headers): string | null {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  const chain = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - hops] ?? chain[0] ?? h.get("x-real-ip") ?? null;
}

/** Addresses exempt from per-address limits (RATE_LIMIT_IP_ALLOWLIST, comma-separated), e.g. a test runner or office NAT. */
const allowlisted = (ip: string) =>
  (process.env.RATE_LIMIT_IP_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean).includes(ip);

/** Rate-limit key for an address, or null (not limited) when the address is unknown or allowlisted. */
export const ipKey = (scope: string, ip: string | null) => (ip && !allowlisted(ip) ? `${scope}:ip:${ip}` : null);
