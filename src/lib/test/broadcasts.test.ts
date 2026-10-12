import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../email-verification", () => ({ appUrl: () => "https://app.test" }));
const sendMail = vi.hoisted(() => vi.fn());
vi.mock("../mail", async () => ({ sendMail, escapeHtml: (await vi.importActual<typeof import("../mail")>("../mail")).escapeHtml }));
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  broadcast: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  broadcastDelivery: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), count: vi.fn(), createMany: vi.fn() },
  user: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
}));
vi.mock("../db", () => ({ db }));

const {
  audienceWhere, broadcastEmail, cancelBroadcast, consoleTimeValue, deliverBroadcasts, parseConsoleTime, skipReason, unsubscribeByToken,
  BroadcastSchema,
} = await import("../broadcasts");

describe("broadcastEmail", () => {
  const b = { kind: "UPDATE", subject: "New: Saved places", body: "Line one <b>\nline two.\n\n\nSee https://eguard.family/help?a=1&b=2." };

  it("greets by first name, keeps paragraphs, escapes and links", () => {
    const m = broadcastEmail(b, "Ana", "tok");
    expect(m.subject).toBe("New: Saved places");
    expect(m.text).toMatch(/^Hi Ana,\n\nLine one <b>\nline two\.\n\nSee https:\/\/eguard\.family\/help\?a=1&b=2\./);
    expect(m.html).toContain("<p>Line one &lt;b&gt;<br>line two.</p>");
    // The trailing full stop isn't part of the link; & stays escaped in href
    expect(m.html).toContain('<a href="https://eguard.family/help?a=1&amp;b=2" style="color:#1a73e8">https://eguard.family/help?a=1&amp;b=2</a>.');
    expect(m.html).not.toContain("<b>");
  });

  it("gives a product update its unsubscribe link and one-click headers", () => {
    const m = broadcastEmail(b, "Ana", "tok");
    expect(m.text).toContain("Unsubscribe: https://app.test/unsubscribe?t=tok");
    expect(m.headers).toEqual({
      "List-Unsubscribe": "<https://app.test/api/email/unsubscribe?t=tok>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("points a test copy at Settings, with no headers", () => {
    const m = broadcastEmail(b, "", null);
    expect(m.text.startsWith("Hi,\n")).toBe(true);
    expect(m.text).toContain("Unsubscribe: https://app.test/settings/notifications");
    expect(m.headers).toBeUndefined();
  });

  it("sends a service notice without any way to unsubscribe", () => {
    const m = broadcastEmail({ ...b, kind: "SERVICE" }, "Ana", "tok");
    expect(m.text).not.toContain("Unsubscribe");
    expect(m.html).not.toContain("Unsubscribe");
    expect(m.headers).toBeUndefined();
    expect(m.text).toContain("service notice");
  });
});

describe("audience", () => {
  it("is verified parents with product updates on, on the chosen plans", () => {
    expect(audienceWhere({ kind: "UPDATE", plans: [] })).toEqual({ emailVerifiedAt: { not: null }, productUpdates: true });
    expect(audienceWhere({ kind: "SERVICE", plans: ["Free"] })).toEqual({ emailVerifiedAt: { not: null }, family: { plan: { in: ["Free"] } } });
  });

  it("only takes plans that exist", () => {
    expect(BroadcastSchema.safeParse({ kind: "UPDATE", subject: "s", body: "b", plans: ["Free", "eGuard Plus"] }).success).toBe(true);
    expect(BroadcastSchema.safeParse({ kind: "UPDATE", subject: "s", body: "b", plans: ["Gold"] }).success).toBe(false);
    expect(BroadcastSchema.safeParse({ kind: "PROMO", subject: "s", body: "b", plans: [] }).success).toBe(false);
  });
});

describe("console time", () => {
  it("reads the datetime-local value as Philippine time, and back", () => {
    expect(parseConsoleTime("2026-10-12T14:30")?.toISOString()).toBe("2026-10-12T06:30:00.000Z");
    expect(consoleTimeValue(new Date("2026-10-12T06:30:00Z"))).toBe("2026-10-12T14:30");
    expect(parseConsoleTime("2026-10-12 14:30")).toBeNull();
    expect(parseConsoleTime("2026-13-45T99:99")).toBeNull();
  });
});

describe("skipReason", () => {
  const user = { email: "a@x.ph", emailVerifiedAt: new Date(), productUpdates: true };
  it("skips anyone who changed since the list was taken", () => {
    expect(skipReason("UPDATE", "a@x.ph", user)).toBeNull();
    expect(skipReason("UPDATE", "a@x.ph", null)).toBe("Account deleted");
    expect(skipReason("UPDATE", "old@x.ph", user)).toBe("Email address changed");
    expect(skipReason("UPDATE", "a@x.ph", { ...user, emailVerifiedAt: null })).toBe("Email not verified");
    expect(skipReason("UPDATE", "a@x.ph", { ...user, productUpdates: false })).toBe("Unsubscribed");
    expect(skipReason("SERVICE", "a@x.ph", { ...user, productUpdates: false })).toBeNull();
  });
});

describe("deliverBroadcasts", () => {
  const verified = new Date();
  const delivery = (id: string, over: object = {}) => ({
    id, email: `${id}@x.ph`, token: `t-${id}`, user: { name: `Parent ${id}`, email: `${id}@x.ph`, emailVerifiedAt: verified, productUpdates: true, ...over },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.broadcast.findMany.mockImplementation(async ({ where }) =>
      where.status === "SCHEDULED" ? [] : [{ id: "b1", kind: "UPDATE", subject: "Hello", body: "News" }]);
    db.broadcastDelivery.updateMany.mockResolvedValue({ count: 1 });
    db.broadcastDelivery.count.mockResolvedValue(0);
    db.broadcast.updateMany.mockResolvedValue({ count: 1 });
  });

  it("claims each email while the broadcast is still sending, sends, and finishes it", async () => {
    db.broadcastDelivery.findMany.mockResolvedValue([delivery("d1"), delivery("d2", { productUpdates: false })]);
    sendMail.mockResolvedValue(undefined);
    expect(await deliverBroadcasts({ now: new Date("2026-10-12T00:00:00Z") })).toEqual({ started: 0, sent: 1, failed: 0, skipped: 1 });
    expect(db.broadcastDelivery.updateMany).toHaveBeenCalledWith({ where: { id: "d1", status: "PENDING", broadcast: { status: "SENDING" } }, data: { status: "SENDING" } });
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: "d1@x.ph", subject: "Hello" });
    expect(sendMail.mock.calls[0][0].text).toMatch(/^Hi Parent,/);
    expect(db.broadcastDelivery.update).toHaveBeenCalledWith({ where: { id: "d2" }, data: { status: "SKIPPED", error: "Unsubscribed" } });
    expect(db.broadcast.updateMany).toHaveBeenCalledWith({ where: { id: "b1", status: "SENDING" }, data: { status: "SENT", finishedAt: new Date("2026-10-12T00:00:00Z") } });
  });

  it("records a failed email, doesn't send one another run claimed, and stops at the limit", async () => {
    db.broadcastDelivery.findMany.mockResolvedValue([delivery("d1"), delivery("d2"), delivery("d3"), delivery("d4")]);
    db.broadcastDelivery.updateMany.mockImplementation(async ({ where }) => ({ count: where.id === "d2" ? 0 : 1 }));
    sendMail.mockRejectedValueOnce(new Error("Resend refused the email (422)")).mockResolvedValue(undefined);
    db.broadcastDelivery.count.mockResolvedValue(1);
    expect(await deliverBroadcasts({ limit: 2 })).toMatchObject({ sent: 1, failed: 1 });
    expect(sendMail.mock.calls.map((c) => c[0].to)).toEqual(["d1@x.ph", "d3@x.ph"]);
    expect(db.broadcastDelivery.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: { status: "FAILED", error: "Resend refused the email (422)" } });
    // d4 wasn't reached and is still waiting: not finished
    expect(db.broadcast.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SENT" }) }));
  });

  it("starts a due broadcast once, with its recipient list", async () => {
    db.broadcast.findMany.mockImplementation(async ({ where }) => (where.status === "SCHEDULED" ? [{ id: "b2", kind: "SERVICE", plans: [] }] : []));
    const tx = {
      broadcast: { updateMany: vi.fn(async () => ({ count: 1 })), update: vi.fn() },
      user: { findMany: vi.fn(async () => [{ id: "u1", email: "a@x.ph" }, { id: "u2", email: "b@x.ph" }]) },
      broadcastDelivery: { createMany: vi.fn() },
    };
    db.$transaction.mockImplementation(async (fn) => fn(tx));
    expect((await deliverBroadcasts()).started).toBe(1);
    expect(tx.user.findMany).toHaveBeenCalledWith({ where: { emailVerifiedAt: { not: null } }, select: { id: true, email: true } });
    const rows = tx.broadcastDelivery.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { email: string }) => r.email)).toEqual(["a@x.ph", "b@x.ph"]);
    expect(new Set(rows.map((r: { token: string }) => r.token)).size).toBe(2);
    expect(tx.broadcast.update).toHaveBeenCalledWith({ where: { id: "b2" }, data: { recipients: 2 } });

    tx.broadcast.updateMany.mockResolvedValue({ count: 0 });
    tx.user.findMany.mockClear();
    expect((await deliverBroadcasts()).started).toBe(0);
    expect(tx.user.findMany).not.toHaveBeenCalled();
  });
});

describe("cancelBroadcast", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stops a sending broadcast and skips everyone still waiting", async () => {
    db.broadcast.findUnique.mockResolvedValue({ status: "SENDING" });
    db.broadcast.updateMany.mockResolvedValue({ count: 1 });
    expect(await cancelBroadcast("b1")).toBe("SENDING");
    expect(db.broadcastDelivery.updateMany).toHaveBeenCalledWith({ where: { broadcastId: "b1", status: "PENDING" }, data: { status: "SKIPPED", error: "Cancelled" } });
  });

  it("can't cancel one that already finished", async () => {
    db.broadcast.findUnique.mockResolvedValue({ status: "SENT" });
    expect(await cancelBroadcast("b1")).toBeNull();
    expect(db.broadcast.updateMany).not.toHaveBeenCalled();
  });
});

describe("unsubscribeByToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("turns product updates off for that parent", async () => {
    db.broadcastDelivery.findUnique.mockResolvedValue({ userId: "u1", broadcast: { kind: "UPDATE" } });
    expect(await unsubscribeByToken("tok")).toBe("done");
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1" }, data: { productUpdates: false } });
  });

  it("does nothing for a service notice's token, a deleted parent or no token", async () => {
    db.broadcastDelivery.findUnique.mockResolvedValueOnce({ userId: "u1", broadcast: { kind: "SERVICE" } });
    expect(await unsubscribeByToken("tok")).toBe("invalid");
    db.broadcastDelivery.findUnique.mockResolvedValueOnce({ userId: null, broadcast: { kind: "UPDATE" } });
    expect(await unsubscribeByToken("tok")).toBe("invalid");
    expect(await unsubscribeByToken("")).toBe("invalid");
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});
