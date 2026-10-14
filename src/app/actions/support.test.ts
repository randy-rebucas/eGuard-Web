import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/errors";

/** Settings › Support's form: what's checked before a ticket is filed, and what the parent is told. */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/mail", () => ({ escapeHtml: (s: string) => s, sendMail: vi.fn() }));
const nav = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: nav.revalidatePath }));
const user = { id: "u1", familyId: "fam1", name: "Ana", email: "ana@example.com", role: "PARENT" };
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
const svc = vi.hoisted(() => ({ createTicket: vi.fn() }));
// The real schema and categories; only filing the ticket is mocked
vi.mock("@/lib/support", async (real) => ({ ...(await real<typeof import("@/lib/support")>()), createTicket: svc.createTicket }));

const { submitTicket } = await import("./support");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const good = { category: "DEVICE", subject: "Tablet offline", message: "Mia's tablet shows offline since Monday." };

beforeEach(() => {
  vi.resetAllMocks();
  auth.requireUser.mockResolvedValue(user);
  svc.createTicket.mockResolvedValue({ id: "t1" });
});

describe("submitTicket", () => {
  it("files it for the signed-in parent, trimmed, and refreshes their list", async () => {
    expect(await submitTicket(undefined, form({ ...good, subject: "  Tablet offline  " }))).toEqual({ ok: expect.stringContaining("one business day") });
    expect(svc.createTicket).toHaveBeenCalledWith(user, good);
    expect(nav.revalidatePath).toHaveBeenCalledWith("/settings/support");
  });
  it("files it as Something else when no category is chosen", async () => {
    await submitTicket(undefined, form({ subject: good.subject, message: good.message }));
    expect(svc.createTicket).toHaveBeenCalledWith(user, { ...good, category: "OTHER" });
  });
  it("explains what's missing, without filing anything", async () => {
    expect(await submitTicket(undefined, form({ ...good, subject: "Hi" }))).toEqual({ error: "Add a short subject." });
    expect(await submitTicket(undefined, form({ ...good, message: "Help" }))).toEqual({ error: "Tell us a little more so we can help." });
    expect((await submitTicket(undefined, form({ ...good, category: "URGENT" })))?.error).toBeTruthy();
    expect(svc.createTicket).not.toHaveBeenCalled();
  });
  it("says when they've sent too many", async () => {
    svc.createTicket.mockRejectedValue(new ServiceError(429, "You've sent several requests. We'll reply to those first.", "rate_limited"));
    expect(await submitTicket(undefined, form(good))).toEqual({ error: "You've sent several requests. We'll reply to those first." });
    expect(nav.revalidatePath).not.toHaveBeenCalled();
  });
  it("needs a signed-in parent", async () => {
    auth.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(submitTicket(undefined, form(good))).rejects.toThrow("NEXT_REDIRECT");
    expect(svc.createTicket).not.toHaveBeenCalled();
  });
  it("lets an unexpected failure through instead of hiding it", async () => {
    svc.createTicket.mockRejectedValue(new Error("database down"));
    await expect(submitTicket(undefined, form(good))).rejects.toThrow("database down");
  });
});
