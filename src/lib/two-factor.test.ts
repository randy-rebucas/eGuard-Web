import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  user: { findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  recoveryCode: { updateMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  loginChallenge: { findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("./db", () => ({ db }));
vi.mock("./auth", () => ({ sha256: (v: string) => createHash("sha256").update(v).digest("hex"), newToken: () => "challenge-token-123456789" }));
vi.mock("./audit", () => ({ audit: vi.fn() }));
vi.mock("./rate-limit", () => ({ LIMITS: { loginAccount: { max: 10, windowMs: 1 } }, clearLimit: vi.fn(), hit: vi.fn(), isLimited: vi.fn(async () => false) }));

const { checkCode, completeChallenge } = await import("./two-factor");
const { hotp, sealSecret, secretKey, stepAt } = await import("./totp");

const SECRET = Buffer.from("12345678901234567890");
const sealed = sealSecret(SECRET, secretKey()!);
const now = () => stepAt(Date.now());

describe("checking a code", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts the current authenticator code once (compare-and-swap on the step)", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ twoFactor: true, totpSecret: sealed, totpLastStep: null });
    db.user.updateMany.mockResolvedValue({ count: 1 });
    expect(await checkCode("u1", hotp(SECRET, now()))).toEqual({ ok: true, recovery: false });
    expect(db.user.updateMany.mock.calls[0][0].data.totpLastStep).toBe(now());
  });

  it("refuses a code from a step already used, without writing", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ twoFactor: true, totpSecret: sealed, totpLastStep: now() + 1 });
    expect((await checkCode("u1", hotp(SECRET, now()))).ok).toBe(false);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("loses the race when another request used the code first", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ twoFactor: true, totpSecret: sealed, totpLastStep: null });
    db.user.updateMany.mockResolvedValue({ count: 0 });
    expect((await checkCode("u1", hotp(SECRET, now()))).ok).toBe(false);
  });

  it("uses up a recovery code, matching however it was typed", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ twoFactor: true, totpSecret: sealed, totpLastStep: null });
    db.recoveryCode.updateMany.mockResolvedValue({ count: 1 });
    expect(await checkCode("u1", " K3M9 X2QA-7FPD ")).toEqual({ ok: true, recovery: true });
    const where = db.recoveryCode.updateMany.mock.calls[0][0].where;
    expect(where.codeHash).toBe(createHash("sha256").update("k3m9x2qa7fpd").digest("hex"));
    expect(where.usedAt).toBeNull();
  });

  it("refuses everything when two-step is off", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ twoFactor: false, totpSecret: null, totpLastStep: null });
    expect((await checkCode("u1", "123456")).ok).toBe(false);
  });
});

describe("the sign-in challenge", () => {
  beforeEach(() => vi.clearAllMocks());
  const challenge = (o: object = {}) => ({ id: "ch1", userId: "u1", expiresAt: new Date(Date.now() + 60_000), user: { id: "u1", familyId: "f1", name: "Ana" }, ...o });

  it("signs in with a right code and uses the challenge up", async () => {
    db.loginChallenge.findUnique.mockResolvedValue(challenge());
    db.loginChallenge.updateMany.mockResolvedValue({ count: 1 });
    db.loginChallenge.deleteMany.mockResolvedValue({ count: 1 });
    db.user.findUniqueOrThrow.mockResolvedValue({ twoFactor: true, totpSecret: sealed, totpLastStep: null });
    db.user.updateMany.mockResolvedValue({ count: 1 });
    const r = await completeChallenge("challenge-token-123456789", hotp(SECRET, now()));
    expect(r.user.id).toBe("u1");
    expect(r.usedRecoveryCode).toBe(false);
  });

  it("refuses an expired challenge", async () => {
    db.loginChallenge.findUnique.mockResolvedValue(challenge({ expiresAt: new Date(Date.now() - 1) }));
    await expect(completeChallenge("x".repeat(25), "123456")).rejects.toMatchObject({ code: "challenge_expired" });
  });

  it("ends the challenge after too many attempts, even with the right code", async () => {
    db.loginChallenge.findUnique.mockResolvedValue(challenge());
    db.loginChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(completeChallenge("x".repeat(25), hotp(SECRET, now()))).rejects.toMatchObject({ code: "challenge_expired" });
    expect(db.loginChallenge.deleteMany).toHaveBeenCalled();
  });

  it("counts a wrong code and says so", async () => {
    db.loginChallenge.findUnique.mockResolvedValue(challenge());
    db.loginChallenge.updateMany.mockResolvedValue({ count: 1 });
    db.user.findUniqueOrThrow.mockResolvedValue({ twoFactor: true, totpSecret: sealed, totpLastStep: null });
    await expect(completeChallenge("x".repeat(25), "000000")).rejects.toMatchObject({ code: "wrong_code" });
  });
});
