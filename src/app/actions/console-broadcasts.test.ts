import { beforeEach, describe, expect, it, vi } from "vitest";

/** The console's email actions: only a confirmed draft with an audience is sent or scheduled, and each is logged. */

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "console.localhost:3000" }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const after = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after }));
const db = vi.hoisted(() => ({ broadcast: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
const staff = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ id: "s1", name: "Ana Reyes", email: "ana@eguard.family" })), logStaff: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ ...staff, authenticateStaff: vi.fn(), endStaffSession: vi.fn(), startStaffSession: vi.fn() }));
const limited = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/rate-limit", () => ({ clientIpFrom: () => null, LIMITS: { aiDraftStaff: { max: 30, windowMs: 1 } }, hit: vi.fn(async () => ({ limited: limited.value })) }));
const draftBroadcast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/broadcast-ai", () => ({ draftBroadcast }));
const lib = vi.hoisted(() => ({ countAudience: vi.fn(), deliverBroadcasts: vi.fn(), sendTestBroadcast: vi.fn(), cancelBroadcast: vi.fn() }));
vi.mock("@/lib/broadcasts", async (orig) => ({ ...(await orig<typeof import("@/lib/broadcasts")>()), ...lib }));
vi.mock("@/lib/email-verification", () => ({ appUrl: () => "https://app.test" }));

const { sendBroadcast, saveBroadcast, draftBroadcastWithAi } = await import("./console");
const { ServiceError } = await import("@/lib/errors");

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const updatedAt = new Date("2026-10-28T02:00:00.000Z");
const version = updatedAt.toISOString();
const draft = { id: "b1", status: "DRAFT", kind: "UPDATE", subject: "Hello", body: "News", plans: ["Free"], updatedAt };

describe("sendBroadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.broadcast.findUnique.mockResolvedValue(draft);
    db.broadcast.updateMany.mockResolvedValue({ count: 1 });
    lib.countAudience.mockResolvedValue(3);
  });

  it("sends a confirmed draft now: scheduled for now, first batch after the response, logged", async () => {
    expect(await sendBroadcast(undefined, form({ id: "b1", version, mode: "now", confirm: "on" }))).toMatchObject({ ok: expect.stringContaining("Sending") });
    expect(db.broadcast.updateMany).toHaveBeenCalledWith({ where: { id: "b1", status: "DRAFT", updatedAt }, data: { status: "SCHEDULED", scheduledAt: expect.any(Date) } });
    expect(after).toHaveBeenCalledOnce();
    expect(staff.logStaff).toHaveBeenCalledWith("s1", "broadcast.send", "broadcast:b1", "Product update, Free, 3 parents");
  });

  it("schedules for a future Philippine time, without sending anything yet", async () => {
    const when = new Date(Date.now() + 2 * 864e5 + 8 * 3600_000).toISOString().slice(0, 16);
    expect(await sendBroadcast(undefined, form({ id: "b1", version, mode: "later", when, confirm: "on" }))).toEqual({ ok: "Scheduled." });
    expect(db.broadcast.updateMany.mock.calls[0][0].data.scheduledAt.toISOString()).toBe(new Date(`${when}:00+08:00`).toISOString());
    expect(after).not.toHaveBeenCalled();
    expect(staff.logStaff.mock.calls[0][1]).toBe("broadcast.schedule");
  });

  it("refuses without the confirmation, a time in the past, an empty audience or a non-draft", async () => {
    expect(await sendBroadcast(undefined, form({ id: "b1", version, mode: "now" }))).toHaveProperty("error");
    expect(await sendBroadcast(undefined, form({ id: "b1", version, mode: "later", when: "2020-01-01T09:00", confirm: "on" }))).toHaveProperty("error");
    lib.countAudience.mockResolvedValueOnce(0);
    expect(await sendBroadcast(undefined, form({ id: "b1", version, mode: "now", confirm: "on" }))).toEqual({ error: "Nobody is in this audience yet." });
    db.broadcast.findUnique.mockResolvedValueOnce({ ...draft, status: "SENT" });
    expect(await sendBroadcast(undefined, form({ id: "b1", version, mode: "now", confirm: "on" }))).toHaveProperty("error");
    expect(db.broadcast.updateMany).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("won't send while an AI draft still has [TODO: …] gaps", async () => {
    db.broadcast.findUnique.mockResolvedValue({ ...draft, body: "Live on [TODO: launch date]." });
    expect(await sendBroadcast(undefined, form({ id: "b1", version, mode: "now", confirm: "on" }))).toEqual({ error: expect.stringContaining("[TODO") });
    expect(db.broadcast.updateMany).not.toHaveBeenCalled();
  });

  it("won't send a draft changed since the page showed it (or a form without its version)", async () => {
    db.broadcast.findUnique.mockResolvedValue({ ...draft, kind: "SERVICE", plans: [], updatedAt: new Date("2026-10-28T02:05:00.000Z") });
    expect(await sendBroadcast(undefined, form({ id: "b1", version, mode: "now", confirm: "on" }))).toEqual({ error: expect.stringContaining("changed since you opened it") });
    db.broadcast.findUnique.mockResolvedValue(draft);
    expect(await sendBroadcast(undefined, form({ id: "b1", mode: "now", confirm: "on" }))).toEqual({ error: expect.stringContaining("changed since you opened it") });
    expect(db.broadcast.updateMany).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("sends nothing when another staff member sent it first", async () => {
    db.broadcast.updateMany.mockResolvedValue({ count: 0 });
    expect(await sendBroadcast(undefined, form({ id: "b1", version, mode: "now", confirm: "on" }))).toHaveProperty("error");
    expect(after).not.toHaveBeenCalled();
    expect(staff.logStaff).not.toHaveBeenCalled();
  });
});

describe("saveBroadcast", () => {
  beforeEach(() => vi.clearAllMocks());

  it("edits only a draft, and keeps what was typed on an error", async () => {
    db.broadcast.updateMany.mockResolvedValue({ count: 0 });
    db.broadcast.findUnique.mockResolvedValue({ status: "SENT" });
    const r = await saveBroadcast(undefined, form({ id: "b1", kind: "UPDATE", subject: "Hi", body: "Body", plans: ["Free", "eGuard Family"] }));
    expect(r).toMatchObject({ error: expect.stringContaining("Only a draft"), fields: { plans: "Free\neGuard Family" } });
    expect(db.broadcast.updateMany).toHaveBeenCalledWith({ where: { id: "b1", status: "DRAFT" }, data: { audience: "PARENTS", kind: "UPDATE", subject: "Hi", body: "Body", plans: ["Free", "eGuard Family"] } });
  });

  it("saves only over the version the form showed, and says so when another edit came first", async () => {
    db.broadcast.updateMany.mockResolvedValue({ count: 0 });
    db.broadcast.findUnique.mockResolvedValue({ status: "DRAFT" });
    const r = await saveBroadcast(undefined, form({ id: "b1", version, kind: "UPDATE", subject: "Hi", body: "Body" }));
    expect(r).toMatchObject({ error: expect.stringContaining("changed since you opened it"), fields: { subject: "Hi" } });
    expect(db.broadcast.updateMany.mock.calls[0][0].where).toEqual({ id: "b1", status: "DRAFT", updatedAt });
  });

  it("saves a mailing-list email as a product update with no plans", async () => {
    db.broadcast.updateMany.mockResolvedValue({ count: 1 });
    expect(await saveBroadcast(undefined, form({ id: "b1", audience: "IOS_LAUNCH", kind: "UPDATE", subject: "Out now", body: "Body", plans: ["Free"] }))).toEqual({ ok: "Saved." });
    expect(db.broadcast.updateMany).toHaveBeenCalledWith({ where: { id: "b1", status: "DRAFT" }, data: { audience: "IOS_LAUNCH", kind: "UPDATE", subject: "Out now", body: "Body", plans: [] } });
  });

  it("refuses a service notice to a mailing list, and an unknown audience", async () => {
    expect(await saveBroadcast(undefined, form({ audience: "NEWSLETTER", kind: "SERVICE", subject: "Hi", body: "Body" }))).toMatchObject({ error: "A mailing list only gets product updates." });
    expect(await saveBroadcast(undefined, form({ audience: "EVERYONE", kind: "UPDATE", subject: "Hi", body: "Body" }))).toHaveProperty("error");
    expect(db.broadcast.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown plan", async () => {
    expect(await saveBroadcast(undefined, form({ kind: "UPDATE", subject: "Hi", body: "Body", plans: "Gold" }))).toHaveProperty("error");
    expect(db.broadcast.create).not.toHaveBeenCalled();
  });
});

describe("draftBroadcastWithAi", () => {
  const input = { brief: "Announce saved places", kind: "UPDATE" as const, plans: [] };
  beforeEach(() => { vi.clearAllMocks(); limited.value = false; });

  it("returns the draft and logs the request with the brief", async () => {
    draftBroadcast.mockResolvedValue({ subject: "S", body: "B", placeholders: false, provider: "openai" });
    expect(await draftBroadcastWithAi(input)).toEqual({ subject: "S", body: "B", placeholders: false, provider: "openai" });
    expect(staff.logStaff).toHaveBeenCalledWith("s1", "broadcast.ai_draft", undefined, "openai: Announce saved places");
  });

  it("passes on a message for staff, and stops at the hourly limit without calling Claude", async () => {
    draftBroadcast.mockRejectedValueOnce(new ServiceError(429, "The AI is busy. Try again in a minute."));
    expect(await draftBroadcastWithAi(input)).toEqual({ error: "The AI is busy. Try again in a minute." });
    limited.value = true;
    expect(await draftBroadcastWithAi(input)).toHaveProperty("error");
    expect(draftBroadcast).toHaveBeenCalledTimes(1);
    expect(staff.logStaff).not.toHaveBeenCalled();
  });
});
