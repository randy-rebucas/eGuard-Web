import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));
type Row = { id: string; tokenHash: string; email: string; name: string; familyName: string; passwordHash: string; codeHash: string | null; attempts: number; sends: number; sentAt: Date; expiresAt: Date };
const rows = vi.hoisted(() => new Map<string, Row>());
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  signupRequest: {
    create: vi.fn(async ({ data }: { data: Omit<Row, "id" | "attempts" | "sends" | "sentAt"> }) => {
      const row = { id: `r${rows.size + 1}`, attempts: 0, sends: 1, sentAt: new Date(), ...data };
      rows.set(row.id, row);
      return row;
    }),
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => [...rows.values()].find((r) => r.tokenHash === where.tokenHash) ?? null),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> & { sends?: unknown } }) => {
      const r = rows.get(where.id)!;
      Object.assign(r, { ...data, sends: r.sends + 1 });
      return r;
    }),
    updateMany: vi.fn(async ({ where }: { where: { id: string; attempts: { lt: number } } }) => {
      const r = rows.get(where.id);
      if (!r || r.attempts >= where.attempts.lt) return { count: 0 };
      r.attempts++;
      return { count: 1 };
    }),
    deleteMany: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
      for (const [id, r] of rows) if (id === where.id || r.email === where.email) rows.delete(id);
      return { count: 1 };
    }),
  },
}));
vi.mock("../db", () => ({ db }));
let tokens = 0;
vi.mock("../auth", () => ({
  hostCookie: (n: string) => n,
  hashPassword: async (p: string) => `hashed:${p}`,
  isPendingInvite: (u: { role: string; passwordSet: boolean; emailVerifiedAt: Date | null }) => u.role === "PARENT" && !u.passwordSet && !u.emailVerifiedAt,
  newToken: () => `ticket-${++tokens}-abcdefghijklmnop`,
  sha256: (v: string) => createHash("sha256").update(v).digest("hex"),
}));
const breached = vi.hoisted(() => ({ assertNotBreached: vi.fn() }));
vi.mock("../breached-password", () => breached);
vi.mock("../email-verification", () => ({ appUrl: () => "https://eguard.test" }));
const family = vi.hoisted(() => ({ userIdForMailbox: vi.fn(), createFamily: vi.fn(async () => ({ id: "u-new" })) }));
vi.mock("../family-service", () => family);
const sendMail = vi.hoisted(() => vi.fn<(m: { to: string; subject: string; text: string }) => Promise<void>>(async () => {}));
vi.mock("../mail", () => ({ sendMail, escapeHtml: (s: string) => s }));
const limits = vi.hoisted(() => ({ enforce: vi.fn(), hit: vi.fn(async () => ({ limited: false })) }));
vi.mock("../rate-limit", () => ({ ...limits, LIMITS: { signupIp: {}, signupMail: {}, tokenIp: {} }, ipKey: (s: string, ip: string | null) => (ip ? `${s}:${ip}` : null) }));

const { finishSignup, resendSignupCode, startSignup } = await import("../signup");

const input = { name: "Ana Cruz", familyName: "Cruz Family", email: "ana@example.com", password: "a-good-long-password" };
const codeIn = (text: string) => /\b(\d{6})\b/.exec(text)?.[1] ?? "";
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => e.code as string);

beforeEach(() => {
  rows.clear();
  vi.clearAllMocks();
  family.userIdForMailbox.mockResolvedValue(null);
});

describe("sign-up with an emailed code", () => {
  it("creates nothing until the code checks out, then makes the family with the email verified", async () => {
    const { ticket } = await startSignup(input, "203.0.113.5");
    expect(limits.enforce).toHaveBeenCalledWith("signup:203.0.113.5", {});
    expect(family.createFamily).not.toHaveBeenCalled();
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe("ana@example.com");
    expect(mail.subject).toMatch(/^\d{6} is your eGuard sign-up code$/);
    expect(await err(finishSignup(ticket, codeIn(mail.text), null))).toBe("ok");
    expect(family.createFamily).toHaveBeenCalledWith({ name: "Ana Cruz", familyName: "Cruz Family", email: "ana@example.com", passwordHash: "hashed:a-good-long-password", emailVerified: true });
    // Used up, with every other sign-up waiting on that address
    expect(rows.size).toBe(0);
  });

  it("answers the same for an email with an account, which gets a sign-in note and no working code", async () => {
    family.userIdForMailbox.mockResolvedValue("u1");
    db.user.findUnique.mockResolvedValue({ role: "FAMILY_ADMIN", passwordSet: true, emailVerifiedAt: new Date() });
    const r = await startSignup(input, null);
    expect(Object.keys(r).sort()).toEqual(["email", "expiresAt", "ticket"]);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe("You already have an eGuard account");
    expect(mail.text).toContain("https://eguard.test/login");
    expect(codeIn(mail.text)).toBe("");
    for (const guess of ["000000", "123456"]) expect(await err(finishSignup(r.ticket, guess, null))).toBe("wrong_code");
    expect(family.createFamily).not.toHaveBeenCalled();
  });

  it("treats an invitation nobody accepted as no account (creating the family replaces it)", async () => {
    family.userIdForMailbox.mockResolvedValue("u2");
    db.user.findUnique.mockResolvedValue({ role: "PARENT", passwordSet: false, emailVerifiedAt: null });
    await startSignup(input, null);
    expect(sendMail.mock.calls[0][0].subject).toMatch(/sign-up code$/);
  });

  it("only works with the ticket the code was sent for, and allows 5 tries", async () => {
    const { ticket } = await startSignup(input, null);
    const code = codeIn(sendMail.mock.calls[0][0].text);
    const other = await startSignup({ ...input, email: "eve@example.com" }, null);
    expect(await err(finishSignup(other.ticket, code, null))).toBe("wrong_code");
    expect(await err(finishSignup("not-a-ticket", code, null))).toBe("signup_expired");
    for (let i = 0; i < 4; i++) expect(await err(finishSignup(ticket, "999999", null))).toBe("wrong_code");
    expect(await err(finishSignup(ticket, code, null))).toBe("ok");
    const third = await startSignup(input, null);
    for (let i = 0; i < 5; i++) await finishSignup(third.ticket, "999999", null).catch(() => {});
    expect(await err(finishSignup(third.ticket, codeIn(sendMail.mock.calls.at(-1)![0].text), null))).toBe("signup_expired");
  });

  it("an expired sign-up can't be finished", async () => {
    const { ticket } = await startSignup(input, null);
    for (const r of rows.values()) r.expiresAt = new Date(Date.now() - 1000);
    expect(await err(finishSignup(ticket, codeIn(sendMail.mock.calls[0][0].text), null))).toBe("signup_expired");
  });

  it("a resend waits a minute, replaces the code, and stops after 5 emails", async () => {
    const { ticket } = await startSignup(input, null);
    const first = codeIn(sendMail.mock.calls[0][0].text);
    expect(await err(resendSignupCode(ticket))).toBe("rate_limited");
    for (const r of rows.values()) r.sentAt = new Date(Date.now() - 61_000);
    await resendSignupCode(ticket);
    const second = codeIn(sendMail.mock.calls[1][0].text);
    if (second !== first) expect(await err(finishSignup(ticket, first, null))).toBe("wrong_code");
    for (const r of rows.values()) Object.assign(r, { sends: 5, sentAt: new Date(0) });
    expect(await err(resendSignupCode(ticket))).toBe("rate_limited");
    expect(await err(finishSignup(ticket, second, null))).toBe("ok");
  });

  it("turns down a breached password before anything is stored", async () => {
    breached.assertNotBreached.mockRejectedValueOnce(Object.assign(new Error("breached"), { code: "invalid" }));
    expect(await err(startSignup(input, null))).toBe("invalid");
    expect(rows.size).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("stops emailing an address that gets too many sign-ups, without saying so", async () => {
    limits.hit.mockResolvedValueOnce({ limited: true });
    await expect(startSignup(input, null)).resolves.toHaveProperty("ticket");
    expect(sendMail).not.toHaveBeenCalled();
  });
});
