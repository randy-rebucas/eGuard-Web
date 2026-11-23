import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => {
  const d = {
    user: { findUniqueOrThrow: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    family: { delete: vi.fn() },
    device: { findMany: vi.fn(async () => [
      { id: "d1", name: "iPhone", kind: "PHONE", tokenHash: "h1", removalSecret: null, child: { name: "Mia" } },
      { id: "d2", name: "Laptop", kind: "COMPUTER", tokenHash: "h2", removalSecret: "s2", child: { name: "Mia" } },
    ]) },
    removedComputer: { upsert: vi.fn() },
    oAuthIdentity: { findMany: vi.fn(), delete: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  d.$transaction.mockImplementation((fn: (tx: typeof d) => unknown) => fn(d));
  return d;
});
vi.mock("../db", () => ({ db }));
const auth = vi.hoisted(() => ({ PASSWORD_TOO_LONG: "", passwordTooLong: () => false, confirmDestructive: vi.fn(), userForToken: vi.fn(), isPendingInvite: () => false }));
vi.mock("../auth", () => auth);
vi.mock("../billing", () => ({}));
vi.mock("../web-billing", () => ({ cancelSubscriptionsBeforeDeletion: vi.fn() }));
vi.mock("../organizations", () => ({ handOverOrganizations: vi.fn() }));
vi.mock("../audit", () => ({ audit: vi.fn() }));
vi.mock("../testimonials", () => ({ hasPublishedQuotes: vi.fn(async () => false), expireProof: vi.fn() }));
vi.mock("../forum", () => ({ eraseForUsers: vi.fn() }));
vi.mock("../email-verification", () => ({}));
vi.mock("../device-slots", () => ({}));
const apple = vi.hoisted(() => ({ appleTokensOf: vi.fn(), revokeAppleTokens: vi.fn(), rememberAppleToken: vi.fn() }));
vi.mock("../apple-tokens", () => apple);

// The social sign-in route, with everything but the request handling mocked
vi.mock("../rate-limit", () => ({ LIMITS: { socialIp: {} }, enforce: vi.fn(), ipKey: vi.fn() }));
const social = vi.hoisted(() => ({ verifyIdToken: vi.fn(), signInWithIdentity: vi.fn() }));
vi.mock("../social-auth", () => ({ verifyIdToken: social.verifyIdToken }));
vi.mock("../social-signin", () => ({ signInWithIdentity: social.signInWithIdentity }));
vi.mock("../mobile-account", () => ({
  clientIp: () => "203.0.113.1",
  signInResponse: async (_req: Request, userId: string, status: number, extra: object) => Response.json({ token: `t_${userId}`, ...extra }, { status }),
}));

const { deleteAccount, unlinkIdentity, removeParent } = await import("../family-service");
const { POST } = await import("@/app/api/mobile/v1/auth/social/route");

type Actor = Parameters<typeof deleteAccount>[0];
const admin = { id: "u1", familyId: "fam1", name: "Ana", role: "FAMILY_ADMIN" } as Actor;
const parent = { ...admin, id: "u2", role: "PARENT" } as Actor;

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", email: "ana@example.com", passwordSet: false });
  db.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
  apple.appleTokensOf.mockResolvedValue(["sealed_1"]);
  apple.revokeAppleTokens.mockResolvedValue(1);
});

describe("deleteAccount revokes Sign in with Apple", () => {
  it("for every parent of a deleted family, after the family is gone", async () => {
    await expect(deleteAccount(admin, { phrase: "DELETE" })).resolves.toEqual({ deleted: "family" });
    expect(apple.appleTokensOf).toHaveBeenCalledWith(["u1", "u2"]);
    expect(apple.revokeAppleTokens).toHaveBeenCalledWith(["sealed_1"]);
    expect(db.family.delete.mock.invocationCallOrder[0]).toBeLessThan(apple.revokeAppleTokens.mock.invocationCallOrder[0]);
  });

  it("keeps the children's devices as removed devices first, so each still gets its signed uninstall", async () => {
    await deleteAccount(admin, { phrase: "DELETE" });
    const kept = db.removedComputer.upsert.mock.calls.map(([a]) => [(a as { where: { deviceId: string } }).where.deviceId, (a as { create: { removalSecret: string | null } }).create.removalSecret]);
    expect(kept).toEqual([["d1", null], ["d2", "s2"]]);
    expect(db.removedComputer.upsert.mock.invocationCallOrder[1]).toBeLessThan(db.family.delete.mock.invocationCallOrder[0]);
  });

  it("for a parent who leaves, only theirs", async () => {
    await expect(deleteAccount(parent, { phrase: "DELETE" })).resolves.toEqual({ deleted: "account" });
    expect(apple.appleTokensOf).toHaveBeenCalledWith(["u2"]);
    expect(db.user.delete.mock.invocationCallOrder[0]).toBeLessThan(apple.revokeAppleTokens.mock.invocationCallOrder[0]);
  });

  it("not when the deletion isn't confirmed", async () => {
    auth.confirmDestructive.mockRejectedValueOnce(Object.assign(new Error("Type DELETE"), { status: 400 }));
    await expect(deleteAccount(admin, {})).rejects.toThrow();
    expect(apple.revokeAppleTokens).not.toHaveBeenCalled();
    expect(db.family.delete).not.toHaveBeenCalled();
  });
});

describe("removeParent revokes Sign in with Apple", () => {
  it("revokes the removed parent's token once their account is gone", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u2", name: "Ben", email: "ben@example.com", role: "PARENT", passwordSet: true });
    db.user.deleteMany.mockResolvedValue({ count: 1 });
    await removeParent(admin, "u2");
    expect(apple.appleTokensOf).toHaveBeenCalledWith(["u2"]);
    expect(apple.revokeAppleTokens).toHaveBeenCalledWith(["sealed_1"]);
    expect(db.user.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(apple.revokeAppleTokens.mock.invocationCallOrder[0]);
  });

  it("revokes nothing when another admin removed them first", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u2", name: "Ben", email: "ben@example.com", role: "PARENT" });
    db.user.deleteMany.mockResolvedValue({ count: 0 });
    await expect(removeParent(admin, "u2")).rejects.toMatchObject({ status: 404 });
    expect(apple.revokeAppleTokens).not.toHaveBeenCalled();
  });
});

describe("unlinkIdentity revokes Apple", () => {
  beforeEach(() => db.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", passwordSet: true }));

  it("revokes an unlinked Apple sign-in's token", async () => {
    db.oAuthIdentity.findMany.mockResolvedValue([{ id: "i1", provider: "apple", appleRefreshToken: "sealed_a" }]);
    await unlinkIdentity(admin, "i1");
    expect(db.oAuthIdentity.delete).toHaveBeenCalledWith({ where: { id: "i1" } });
    expect(apple.revokeAppleTokens).toHaveBeenCalledWith(["sealed_a"]);
  });

  it("has nothing to revoke for Google, or an Apple sign-in from before tokens were kept", async () => {
    db.oAuthIdentity.findMany.mockResolvedValue([
      { id: "i1", provider: "google", appleRefreshToken: null },
      { id: "i2", provider: "apple", appleRefreshToken: null },
    ]);
    await unlinkIdentity(admin, "i1");
    await unlinkIdentity(admin, "i2");
    expect(apple.revokeAppleTokens).not.toHaveBeenCalled();
  });

  it("revokes nothing when the unlink is refused", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", passwordSet: false });
    db.oAuthIdentity.findMany.mockResolvedValue([{ id: "i1", provider: "apple", appleRefreshToken: "sealed_a" }]);
    await expect(unlinkIdentity(admin, "i1")).rejects.toMatchObject({ status: 409 });
    expect(apple.revokeAppleTokens).not.toHaveBeenCalled();
  });
});

describe("POST /auth/social with an authorizationCode", () => {
  const req = (body: object) => new Request("http://localhost/api/mobile/v1/auth/social", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const ctx = { params: Promise.resolve({}) } as never;
  const idToken = "x".repeat(40);

  beforeEach(() => {
    social.verifyIdToken.mockResolvedValue({ provider: "apple", subject: "001.apple", email: "a@example.com", emailVerified: true, name: null });
    social.signInWithIdentity.mockResolvedValue({ userId: "u1", isNew: false });
  });

  it("signs in and hands the code to the exchange", async () => {
    apple.rememberAppleToken.mockResolvedValue(true);
    const res = await POST(req({ provider: "apple", idToken, authorizationCode: "c_1" }), ctx);
    expect(res.status).toBe(200);
    expect(apple.rememberAppleToken).toHaveBeenCalledWith({ subject: "001.apple", idToken, authorizationCode: "c_1" });
  });

  it("still signs in when the exchange fails", async () => {
    apple.rememberAppleToken.mockResolvedValue(false);
    const res = await POST(req({ provider: "apple", idToken, authorizationCode: "c_1" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ token: "t_u1" });
  });

  it("works without a code (older apps), and ignores one sent with Google", async () => {
    expect((await POST(req({ provider: "apple", idToken }), ctx)).status).toBe(200);
    social.verifyIdToken.mockResolvedValue({ provider: "google", subject: "g1", email: "a@example.com", emailVerified: true, name: null });
    expect((await POST(req({ provider: "google", idToken, authorizationCode: "c_1" }), ctx)).status).toBe(200);
    expect(apple.rememberAppleToken).not.toHaveBeenCalled();
  });

  it("passes the Terms agreement through for a new account, and leaves it out when not sent", async () => {
    await POST(req({ provider: "apple", idToken, guardian: true, terms: true }), ctx);
    expect(social.signInWithIdentity).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ guardian: true, terms: true }));
    await POST(req({ provider: "apple", idToken }), ctx);
    expect(social.signInWithIdentity).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ terms: undefined }));
    // Only an agreement counts: `false` isn't a value the app sends
    expect((await POST(req({ provider: "apple", idToken, terms: false }), ctx)).status).toBe(400);
  });
});
