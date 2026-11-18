import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const afterFns = vi.hoisted(() => [] as (() => unknown)[]);
vi.mock("next/server", () => ({ after: (fn: () => unknown) => afterFns.push(fn) }));
const enforce = vi.hoisted(() => vi.fn());
vi.mock("../rate-limit", () => ({
  LIMITS: { forumThread: {}, forumPost: {}, forumVote: {}, forumReport: {}, forumHandle: {}, forumMail: {} },
  enforce,
  hit: vi.fn(async () => ({ limited: false })),
}));
const isEnabled = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../feature-flags", () => ({ isEnabled }));
vi.mock("../mail", () => ({ sendMail: vi.fn(), escapeHtml: (s: string) => s }));
vi.mock("../push", () => ({ pushToUsers: vi.fn(async () => 0) }));
vi.mock("../email-verification", () => ({ appUrl: () => "https://app.test" }));

type Row = Record<string, unknown>;
const store = vi.hoisted(() => ({
  profile: null as Row | null,
  categories: [] as Row[],
  thread: null as Row | null,
  post: null as Row | null,
  votes: [] as Row[],
  reports: [] as Row[],
  children: [] as Row[],
}));
const db = vi.hoisted(() => ({
  forumProfile: { findUnique: vi.fn(async () => store.profile), upsert: vi.fn(async ({ create }: { create: Row }) => ({ ...create, mutedUntil: null, notifyReplies: true })) },
  forumCategory: { findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => store.categories.find((c) => c.slug === where.slug) ?? null) },
  forumThread: {
    create: vi.fn(async () => ({ id: "t-new" })),
    findUnique: vi.fn(async () => store.thread),
    update: vi.fn(async ({ data }: { data: { score?: { increment: number } } }) => {
      if (data.score && store.thread) store.thread.score = (store.thread.score as number) + data.score.increment;
      return store.thread;
    }),
    updateMany: vi.fn(async ({ data }: { data: Row }) => { Object.assign(store.thread!, data); return { count: 1 }; }),
  },
  forumPost: {
    findUnique: vi.fn(async () => store.post),
    create: vi.fn(async () => ({ id: "p-new" })),
    update: vi.fn(async ({ data }: { data: Row }) => { Object.assign(store.post!, data); return store.post; }),
  },
  forumVote: {
    findFirst: vi.fn(async () => store.votes[0] ?? null),
    create: vi.fn(async ({ data }: { data: Row }) => { store.votes.push({ id: "v1", ...data }); }),
    delete: vi.fn(async () => { store.votes.pop(); }),
  },
  forumReport: {
    create: vi.fn(async ({ data }: { data: Row }) => {
      if (store.reports.some((r) => r.reporterId === data.reporterId)) throw Object.assign(new Error("dup"), { code: "P2002" });
      store.reports.push({ ...data, status: "open" });
    }),
    count: vi.fn(async () => store.reports.filter((r) => r.status === "open").length),
    updateMany: vi.fn(),
  },
  forumSubscription: { upsert: vi.fn() },
  child: { findMany: vi.fn(async () => store.children) },
  $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(db)),
}));
vi.mock("../db", () => ({ db }));

const forum = await import("../forum");
const {
  normalizeHandle, cleanText, parseMentions, privacyHints, recipients, authorOf, participationBlock,
  createThread, reply, toggleVote, report, setHandle, AUTO_HIDE_REPORTS, PRIVACY_CODE, ThreadSchema,
} = forum;

const now = new Date(Date.UTC(2026, 10, 18, 12));
const parent = { id: "u1", familyId: "f1", emailVerified: true };
const profile = (over: Row = {}) => ({ userId: "u1", handle: "SleepyDad", mutedUntil: null, notifyReplies: true, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  afterFns.length = 0;
  isEnabled.mockResolvedValue(true);
  Object.assign(store, {
    profile: profile(),
    categories: [{ id: "c1", slug: "screen-time", staffOnly: false }, { id: "c0", slug: "announcements", staffOnly: true }],
    thread: { id: "t1", authorId: "u2", status: "visible", locked: false, score: 0 },
    post: { id: "p1", authorId: "u2", status: "visible", threadId: "t1" },
    votes: [], reports: [], children: [],
  });
});

describe("handles", () => {
  it("keeps the case typed and a lower-case key", () => {
    expect(normalizeHandle("  Mama_ng_Tatlo ")).toEqual({ handle: "Mama_ng_Tatlo", handleKey: "mama_ng_tatlo" });
    expect(normalizeHandle("Niño.Dad").handleKey).toBe("niño.dad");
  });

  it.each([
    ["ab", "characters"],
    ["has space", "letters, numbers"],
    ["me@mail.com", "letters, numbers"],
    ["_edge", "Start and end"],
    ["mom09171234567", "phone number"],
    ["eGuardMom", "reserved"],
    ["Admin", "reserved"],
  ])("refuses %s", (raw, msg) => {
    expect(() => normalizeHandle(raw)).toThrow(msg);
  });

  it("needs the rules accepted the first time, and a verified email", async () => {
    store.profile = null;
    await expect(setHandle(parent, "NewMom", false, now)).rejects.toThrow("community rules");
    await expect(setHandle({ ...parent, emailVerified: false }, "NewMom", true, now)).rejects.toThrow("Verify your email");
    await expect(setHandle(parent, "NewMom", true, now)).resolves.toMatchObject({ handle: "NewMom" });
  });

  it("says when the name is taken", async () => {
    db.forumProfile.upsert.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(setHandle(parent, "TakenName", true, now)).rejects.toThrow("already uses that name");
  });
});

describe("text", () => {
  it("cleans line breaks, control characters and blank runs", () => {
    expect(cleanText("  hi\r\n\r\n\r\n\r\nthere\u0007  ")).toBe("hi\n\nthere");
  });

  it("validates threads", () => {
    expect(ThreadSchema.safeParse({ category: "x", title: "Hi", body: "ok" }).success).toBe(false);
    expect(ThreadSchema.safeParse({ category: "x", title: "Two\nlines here", body: "ok" }).success).toBe(false);
    expect(ThreadSchema.parse({ category: "x", title: "  Bedtime ideas ", body: " What works? " })).toMatchObject({ title: "Bedtime ideas", body: "What works?" });
  });

  it("finds @mentions, not emails, at most five", () => {
    expect(parseMentions("Thanks @SleepyDad and @mama.ng.tatlo. — mail me@x.com")).toEqual(["sleepydad", "mama.ng.tatlo"]);
    expect(parseMentions("@aaa @bbb @ccc @ddd @eee @fff")).toHaveLength(5);
  });

  it("notices what could identify a family", () => {
    expect(privacyHints("Our Sofia loves Roblox", ["Sofia Reyes"])).toEqual(["child_name"]);
    expect(privacyHints("Sofiano is a word", ["Sofia"])).toEqual([]);
    expect(privacyHints("Text me 0917 123 4567")).toEqual(["phone"]);
    expect(privacyHints("write to ana@example.ph")).toEqual(["email"]);
    expect(privacyHints("we live in Brgy. Mabini")).toEqual(["address"]);
    expect(privacyHints("Screen time after 9 pm for 2 kids")).toEqual([]);
  });
});

describe("who hears about a post", () => {
  it("is followers and mentioned parents, never the writer, each once", () => {
    expect(recipients("a", ["a", "b", "c"], ["c", "d", "a"])).toEqual({ reply: ["b"], mention: ["c", "d"] });
  });
});

describe("authors", () => {
  it("shows the handle, the team, or a deleted member", () => {
    expect(authorOf({ authorId: "u1", staffAuthorId: null, author: { forumProfile: { handle: "Kim" } } }, "u1")).toEqual({ name: "Kim", kind: "member", mine: true });
    expect(authorOf({ authorId: null, staffAuthorId: "s1" })).toMatchObject({ name: "eGuard team", kind: "staff" });
    expect(authorOf({ authorId: null, staffAuthorId: null })).toMatchObject({ name: "Deleted member", kind: "deleted" });
  });
});

describe("taking part", () => {
  it("needs a verified email, a community name, and no mute in force", () => {
    expect(participationBlock({ emailVerified: false }, profile(), now)?.message).toMatch("Verify your email");
    expect(participationBlock({ emailVerified: true }, null, now)?.code).toBe("no_profile");
    expect(participationBlock({ emailVerified: true }, profile({ mutedUntil: new Date(now.getTime() + 864e5) }), now)?.status).toBe(403);
    expect(participationBlock({ emailVerified: true }, profile({ mutedUntil: new Date(now.getTime() - 1) }), now)).toBeNull();
  });

  it("is not there at all without the feature flag", async () => {
    isEnabled.mockResolvedValue(false);
    await expect(createThread(parent, { category: "screen-time", title: "Bedtime ideas", body: "What works?" }, {}, now)).rejects.toMatchObject({ status: 404 });
  });

  it("keeps Announcements for the team", async () => {
    await expect(createThread(parent, { category: "announcements", title: "Hello all", body: "hi" }, {}, now)).rejects.toThrow("eGuard team");
  });

  it("asks once before posting what could identify the family, then posts", async () => {
    store.children = [{ name: "Sofia" }];
    const input = { category: "screen-time", title: "Bedtime for Sofia", body: "She stays up late" };
    await expect(createThread(parent, input, {}, now)).rejects.toMatchObject({ code: PRIVACY_CODE });
    expect(db.forumThread.create).not.toHaveBeenCalled();
    await expect(createThread(parent, input, { acknowledged: true }, now)).resolves.toEqual({ id: "t-new" });
    expect(enforce).toHaveBeenCalledWith("forum-thread:u1", expect.anything(), expect.any(String));
  });

  it("doesn't reply to locked or hidden threads", async () => {
    store.thread = { ...store.thread, locked: true };
    await expect(reply(parent, "t1", "Me too", {}, now)).rejects.toThrow("closed");
    store.thread = { ...store.thread, locked: false, status: "hidden" };
    await expect(reply(parent, "t1", "Me too", {}, now)).rejects.toMatchObject({ status: 404 });
  });

  it("replies, counts the reply and notifies after the response", async () => {
    await expect(reply(parent, "t1", "Me too", {}, now)).resolves.toEqual({ id: "p-new" });
    expect(db.forumThread.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { replyCount: { increment: 1 }, lastActivityAt: now } });
    expect(afterFns).toHaveLength(1);
  });
});

describe("Helpful votes", () => {
  it("toggles on and off and keeps the score", async () => {
    await expect(toggleVote(parent, { threadId: "t1" }, now)).resolves.toEqual({ voted: true, score: 1 });
    await expect(toggleVote(parent, { threadId: "t1" }, now)).resolves.toEqual({ voted: false, score: 0 });
  });

  it("not on your own post", async () => {
    store.thread = { ...store.thread, authorId: "u1" };
    await expect(toggleVote(parent, { threadId: "t1" }, now)).rejects.toThrow("your own");
  });
});

describe("reports", () => {
  it("one per parent, and enough of them hide the post", async () => {
    await expect(report(parent, { postId: "p1" }, { reason: "spam" }, now)).resolves.toEqual({ hidden: false });
    await expect(report(parent, { postId: "p1" }, { reason: "spam" }, now)).rejects.toThrow("already reported");
    for (let i = 2; i <= AUTO_HIDE_REPORTS; i++) {
      const r = await report({ ...parent, id: `u${i + 10}` }, { postId: "p1" }, { reason: "harassment" }, now);
      expect(r.hidden).toBe(i === AUTO_HIDE_REPORTS);
    }
    expect(store.post).toMatchObject({ status: "hidden", statusAt: now });
    // A hidden reply no longer counts toward the thread's replies
    expect(db.forumThread.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { replyCount: { increment: -1 } } });
  });

  it("not your own post, and only with a known reason", async () => {
    store.post = { ...store.post, authorId: "u1" };
    await expect(report(parent, { postId: "p1" }, { reason: "spam" }, now)).rejects.toThrow("your own post");
    store.post = { ...store.post, authorId: "u2" };
    await expect(report(parent, { postId: "p1" }, { reason: "nope" as "spam" }, now)).rejects.toThrow();
  });
});
