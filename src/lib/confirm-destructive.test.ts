import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const db = vi.hoisted(() => ({ user: { findUniqueOrThrow: vi.fn() } }));
vi.mock("./db", () => ({ db }));
vi.mock("./rate-limit", () => ({ LIMITS: { loginAccount: { max: 10, windowMs: 1 } }, clearLimit: vi.fn(), hit: vi.fn(), isLimited: vi.fn(async () => false), ipKey: vi.fn() }));

const { confirmDestructive } = await import("./auth");

const hash = bcrypt.hashSync("correct horse battery", 4);
const withPassword = { passwordSet: true, passwordHash: hash };
const withoutPassword = { passwordSet: false, passwordHash: "" };
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => e.code as string);

describe("confirmDestructive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("needs the password when the account has one, and ignores the typed phrase", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue(withPassword);
    expect(await code(confirmDestructive("u1", { password: "correct horse battery" }))).toBe("ok");
    expect(await code(confirmDestructive("u1", { password: "nope" }))).toBe("wrong_password");
    expect(await code(confirmDestructive("u1", { phrase: "DELETE" }))).toBe("wrong_password");
  });

  it("takes the typed DELETE when the account has no password (Apple/Google)", async () => {
    db.user.findUniqueOrThrow.mockResolvedValue(withoutPassword);
    expect(await code(confirmDestructive("u1", { phrase: "DELETE" }))).toBe("ok");
    expect(await code(confirmDestructive("u1", { phrase: " DELETE " }))).toBe("ok");
    expect(await code(confirmDestructive("u1", { phrase: "delete" }))).toBe("confirm_required");
    expect(await code(confirmDestructive("u1", {}))).toBe("confirm_required");
    // A password sent by an older app doesn't count: there's none to check it against
    expect(await code(confirmDestructive("u1", { password: "anything" }))).toBe("confirm_required");
  });
});
