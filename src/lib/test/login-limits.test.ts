import { describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// Rate limits in memory, with the real LIMITS
const counts = new Map<string, number>();
vi.mock("../rate-limit", async (orig) => {
  const { LIMITS } = await orig<typeof import("../rate-limit")>();
  return {
    LIMITS,
    ipKey: (scope: string, ip: string | null) => (ip ? `${scope}:ip:${ip}` : null),
    hit: async (key: string | null, l: { max: number }) => {
      if (!key) return { count: 0, limited: false };
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return { count: counts.get(key)!, limited: counts.get(key)! > l.max };
    },
    isLimited: async (key: string | null, l: { max: number }) => !!key && (counts.get(key) ?? 0) >= l.max,
    clearLimit: async (key: string) => void counts.delete(key),
  };
});

// Low cost: the limits are what's tested, not bcrypt
const passwordHash = bcrypt.hashSync("right-password", 4);
vi.mock("../db", () => ({ db: { user: { findUnique: async ({ where }: { where: { email: string } }) => (where.email === "mia@example.com" ? { id: "u1", email: "mia@example.com", passwordHash } : null) } } }));

const { authenticate } = await import("../auth");
const tryLogin = (password: string, ip: string) => authenticate("mia@example.com", password, ip).then(() => "ok", (e) => e.code as string);

describe("authenticate rate limits", () => {
  it("locks out the address that guessed wrong, not the parent signing in from elsewhere", async () => {
    counts.clear();
    for (let i = 0; i < 10; i++) expect(await tryLogin("wrong", "203.0.113.9")).toBe("invalid_credentials");
    expect(await tryLogin("right-password", "203.0.113.9")).toBe("rate_limited");
    expect(await tryLogin("right-password", "198.51.100.7")).toBe("ok");
  });

  it("stops guessing spread over many addresses once the account-wide cap is reached", async () => {
    counts.clear();
    for (let i = 0; i < 50; i++) await tryLogin("wrong", `203.0.113.${i}`);
    expect(await tryLogin("right-password", "198.51.100.7")).toBe("rate_limited");
  });
});
