import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const db = vi.hoisted(() => ({
  staffUser: { findUnique: vi.fn(), updateMany: vi.fn() },
  staffSession: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
  staffAuditLog: { create: vi.fn() },
}));
vi.mock("../db", () => ({ db }));
const auth = vi.hoisted(() => ({ verifyPassword: vi.fn(), hashPassword: vi.fn(async () => "decoy-hash") }));
vi.mock("../auth", () => ({
  ...auth,
  sha256: (v: string) => createHash("sha256").update(v).digest("hex"),
  newToken: () => "staff-token",
}));
const rl = vi.hoisted(() => ({ hit: vi.fn(), clearLimit: vi.fn(), isLimited: vi.fn(async () => false) }));
vi.mock("../rate-limit", () => ({
  ...rl,
  LIMITS: { staffLoginAccount: { max: 5, windowMs: 1 }, staffLoginIp: { max: 20, windowMs: 1 } },
  ipKey: (scope: string, ip: string | null) => (ip ? `${scope}:ip:${ip}` : null),
  clientIpFrom: () => null,
}));

const { authenticateStaff, getStaff, STAFF_BAD_LOGIN } = await import("../staff-auth");
const { hotp, sealSecret, secretKey, stepAt } = await import("../totp");
const { cookies } = await import("next/headers");

const SECRET = Buffer.from("12345678901234567890");
const staff = { id: "s1", email: "ana@eguard.family", name: "Ana", passwordHash: "h", totpSecret: sealSecret(SECRET, secretKey()!), totpLastStep: null, active: true };
const code = () => hotp(SECRET, stepAt(Date.now()));
const login = (c = code(), pw = "right") => authenticateStaff("ana@eguard.family", pw, c, "1.2.3.4");

describe("staff sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rl.isLimited.mockResolvedValue(false);
    db.staffUser.findUnique.mockResolvedValue(staff);
    db.staffUser.updateMany.mockResolvedValue({ count: 1 });
    auth.verifyPassword.mockImplementation(async (pw: string) => pw === "right");
  });

  it("signs in with the password and the current code, using up the code's step", async () => {
    expect(await login()).toEqual({ id: "s1", name: "Ana", email: "ana@eguard.family" });
    const { where, data } = db.staffUser.updateMany.mock.calls[0][0];
    expect(data.totpLastStep).toBe(stepAt(Date.now()));
    expect(where.active).toBe(true);
    expect(rl.clearLimit).toHaveBeenCalledWith("staff:acct:ana@eguard.family");
  });

  it("gives the same answer for a wrong password, a wrong code and an unknown email, and counts each", async () => {
    await expect(login(code(), "wrong")).rejects.toThrow(STAFF_BAD_LOGIN);
    await expect(login("000000")).rejects.toThrow(STAFF_BAD_LOGIN);
    db.staffUser.findUnique.mockResolvedValue(null);
    await expect(login()).rejects.toThrow(STAFF_BAD_LOGIN);
    expect(rl.hit).toHaveBeenCalledTimes(6);
    expect(db.staffUser.updateMany).not.toHaveBeenCalled();
  });

  it("checks a decoy password when the email has no account, so a miss takes as long", async () => {
    db.staffUser.findUnique.mockResolvedValue(null);
    await expect(login()).rejects.toThrow(STAFF_BAD_LOGIN);
    expect(auth.verifyPassword).toHaveBeenCalledWith("right", "decoy-hash");
  });

  it("refuses a code from a step already used", async () => {
    db.staffUser.findUnique.mockResolvedValue({ ...staff, totpLastStep: stepAt(Date.now()) + 1 });
    await expect(login()).rejects.toThrow(STAFF_BAD_LOGIN);
    expect(db.staffUser.updateMany).not.toHaveBeenCalled();
  });

  it("loses the race when the same code was just used by another request", async () => {
    db.staffUser.updateMany.mockResolvedValue({ count: 0 });
    await expect(login()).rejects.toThrow(STAFF_BAD_LOGIN);
  });

  it("refuses a deactivated account even with everything right", async () => {
    db.staffUser.findUnique.mockResolvedValue({ ...staff, active: false });
    await expect(login()).rejects.toThrow(STAFF_BAD_LOGIN);
  });

  it("stops checking once rate limited", async () => {
    rl.isLimited.mockResolvedValue(true);
    await expect(login()).rejects.toMatchObject({ status: 429 });
    expect(db.staffUser.findUnique).not.toHaveBeenCalled();
  });
});

describe("the staff session", () => {
  const jar = (token?: string) => vi.mocked(cookies).mockResolvedValue({ get: () => (token ? { value: token } : undefined) } as never);
  const session = (o: { expiresIn?: number; idleFor?: number; active?: boolean } = {}) => ({
    id: "ss1",
    expiresAt: new Date(Date.now() + (o.expiresIn ?? 3600_000)),
    lastSeenAt: new Date(Date.now() - (o.idleFor ?? 0)),
    staff: { id: "s1", name: "Ana", email: "ana@eguard.family", active: o.active ?? true },
  });
  beforeEach(() => vi.clearAllMocks());

  it("is nobody without the cookie", async () => {
    jar();
    expect(await getStaff()).toBeNull();
    expect(db.staffSession.findUnique).not.toHaveBeenCalled();
  });

  it("is the staff member for a live session", async () => {
    jar("t1");
    db.staffSession.findUnique.mockResolvedValue(session());
    expect(await getStaff()).toMatchObject({ id: "s1", sessionId: "ss1" });
  });

  it.each([
    ["expired", { expiresIn: -1 }],
    ["idle for over 30 minutes", { idleFor: 31 * 60_000 }],
    ["of a deactivated account", { active: false }],
  ])("ends a session that is %s", async (_, o) => {
    jar("t2");
    db.staffSession.findUnique.mockResolvedValue(session(o));
    expect(await getStaff()).toBeNull();
    expect(db.staffSession.deleteMany).toHaveBeenCalledWith({ where: { id: "ss1" } });
  });
});
