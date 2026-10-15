import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
const known = vi.hoisted(() => new Set<string>());
const db = vi.hoisted(() => ({
  knownDevice: {
    createMany: vi.fn(async ({ data }: { data: { userId: string; key: string }[] }) => {
      const k = `${data[0].userId}/${data[0].key}`;
      if (known.has(k)) return { count: 0 };
      known.add(k);
      return { count: 1 };
    }),
    updateMany: vi.fn(),
    count: vi.fn(async ({ where }: { where: { userId: string; key: { not: string } } }) =>
      [...known].filter((k) => k.startsWith(`${where.userId}/`) && k !== `${where.userId}/${where.key.not}`).length),
  },
  user: { findUniqueOrThrow: vi.fn(async () => ({ email: "ana@example.com", name: "Ana Cruz", family: { timezone: "Asia/Manila" } })) },
}));
vi.mock("../db", () => ({ db }));
vi.mock("../auth", () => ({ sha256: (v: string) => createHash("sha256").update(v).digest("hex") }));
const notice = vi.hoisted(() => ({ sendSecurityNotice: vi.fn() }));
vi.mock("../security-notice", () => notice);

const { noteSignIn } = await import("../sign-in-notice");

const laptop = { id: "device-cookie-laptop", userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130", ip: "203.0.113.8", label: "Chrome on Windows" };

beforeEach(() => {
  known.clear();
  vi.clearAllMocks();
});

describe("new sign-in emails", () => {
  it("remembers the first device without an email, then emails a sign-in from a new one", async () => {
    expect(await noteSignIn("u1", laptop)).toBe(false);
    expect(await noteSignIn("u1", laptop)).toBe(false);
    expect(db.knownDevice.updateMany).toHaveBeenCalled();
    expect(notice.sendSecurityNotice).not.toHaveBeenCalled();
    const phone = { id: null, userAgent: "eGuard/1.0 (iPhone; iOS 18.1)", ip: null, label: "eGuard app on iOS" };
    expect(await noteSignIn("u1", phone)).toBe(true);
    expect(notice.sendSecurityNotice).toHaveBeenCalledWith("ana@example.com", "Ana Cruz", expect.objectContaining({ kind: "new_sign_in", device: "eGuard app on iOS", ip: null }));
  });

  it("knows a browser by its cookie, so a second Chrome on Windows still counts as new", async () => {
    await noteSignIn("u1", laptop);
    expect(await noteSignIn("u1", { ...laptop, id: "device-cookie-someone-else" })).toBe(true);
    expect(notice.sendSecurityNotice).toHaveBeenCalledWith("ana@example.com", "Ana Cruz", expect.objectContaining({ device: "Chrome on Windows", ip: "203.0.113.8" }));
  });

  it("keeps each parent's devices apart", async () => {
    await noteSignIn("u1", laptop);
    expect(await noteSignIn("u2", laptop)).toBe(false);
  });
});
