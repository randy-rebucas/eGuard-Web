import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const afterFns = vi.hoisted(() => [] as (() => unknown)[]);
vi.mock("next/server", () => ({ after: (fn: () => unknown) => afterFns.push(fn) }));
const enforce = vi.hoisted(() => vi.fn());
vi.mock("../rate-limit", () => ({ LIMITS: { feedbackUser: { max: 10, windowMs: 1 } }, enforce }));
vi.mock("../feature-flags", () => ({ isEnabled: vi.fn() }));
const forwardTicket = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../support", () => ({ forwardTicket }));
const tx = vi.hoisted(() => ({
  supportTicket: { create: vi.fn(async ({ data }: { data: object }) => ({ id: "t1", status: "OPEN", ...data })) },
  feedback: { create: vi.fn(async ({ data }: { data: object }) => ({ id: "f1", ...data })) },
  feedbackState: { upsert: vi.fn() },
}));
vi.mock("../db", () => ({ db: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } }));

const { npsBucket, npsScore, npsDue, followUpFor, FeedbackSchema, submitFeedback, NPS_RULES } = await import("../feedback");

const DAY = 864e5;
const now = Date.UTC(2026, 10, 17);
const facts = (over: object = {}) => ({
  flagOn: true, accountCreatedAt: new Date(now - 60 * DAY), devices: 1, openTickets: 0,
  state: { npsSeenAt: null, npsAnsweredAt: null, npsDismissedAt: null }, ...over,
});

describe("NPS math", () => {
  it("groups scores the standard way", () => {
    expect([0, 6, 7, 8, 9, 10].map(npsBucket)).toEqual(["DETRACTOR", "DETRACTOR", "PASSIVE", "PASSIVE", "PROMOTER", "PROMOTER"]);
  });

  it("is % promoters minus % detractors", () => {
    expect(npsScore([])).toBeNull();
    expect(npsScore([10, 9, 8, 3])).toBe(25);
    expect(npsScore([0, 1])).toBe(-100);
  });
});

describe("npsDue", () => {
  it("asks a settled-in family with a device", () => {
    expect(npsDue(facts(), now)).toEqual({ due: true, reason: "due" });
  });

  it.each([
    ["flag_off", { flagOn: false }],
    ["too_new", { accountCreatedAt: new Date(now - (NPS_RULES.minAccountDays - 1) * DAY) }],
    ["no_device", { devices: 0 }],
    ["open_ticket", { openTickets: 1 }],
    ["answered", { state: { npsSeenAt: null, npsDismissedAt: null, npsAnsweredAt: new Date(now - 179 * DAY) } }],
    ["dismissed", { state: { npsSeenAt: null, npsAnsweredAt: null, npsDismissedAt: new Date(now - 89 * DAY) } }],
    ["seen", { state: { npsAnsweredAt: null, npsDismissedAt: null, npsSeenAt: new Date(now - 13 * DAY) } }],
  ])("holds off: %s", (reason, over) => {
    expect(npsDue(facts(over), now)).toEqual({ due: false, reason });
  });

  it("asks again once each wait is over", () => {
    expect(npsDue(facts({ state: { npsSeenAt: new Date(now - 15 * DAY), npsAnsweredAt: new Date(now - 181 * DAY), npsDismissedAt: new Date(now - 91 * DAY) } }), now).due).toBe(true);
  });
});

describe("followUpFor", () => {
  it("opens a ticket only for an unhappy parent who said we may write, and told us what's wrong", () => {
    expect(followUpFor({ kind: "NPS", score: 3, comment: "Keeps going offline", contactOk: true })).toBe("TICKET");
    expect(followUpFor({ kind: "NPS", score: 3, comment: "", contactOk: true })).toBe("NEEDED");
    expect(followUpFor({ kind: "NPS", score: 3, comment: "Bad", contactOk: false })).toBe("NEEDED");
    expect(followUpFor({ kind: "BUG", comment: "Crash on open", contactOk: true })).toBe("TICKET");
    expect(followUpFor({ kind: "NPS", score: 7, comment: "ok", contactOk: true })).toBe("NONE");
    expect(followUpFor({ kind: "NPS", score: 10, comment: "love it", contactOk: true })).toBe("NONE");
    expect(followUpFor({ kind: "IDEA", comment: "dark mode", contactOk: true })).toBe("NONE");
  });
});

describe("FeedbackSchema", () => {
  it("needs a score for the survey only, and words for everything else", () => {
    expect(FeedbackSchema.safeParse({ kind: "NPS" }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ kind: "NPS", score: 11 }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ kind: "NPS", score: 8 }).success).toBe(true);
    expect(FeedbackSchema.safeParse({ kind: "IDEA", score: 5, comment: "dark mode" }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ kind: "BUG", comment: "x" }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ kind: "BUG", comment: "Crashes", contactOk: true }).data).toMatchObject({ trigger: "settings" });
  });
});

describe("submitFeedback", () => {
  const user = { id: "u1", name: "Ana", email: "ana@example.com", familyId: "fam1" };
  beforeEach(() => {
    afterFns.length = 0;
    vi.clearAllMocks();
  });

  it("opens a FEEDBACK ticket in the parent's name and forwards it", async () => {
    const res = await submitFeedback(user, { kind: "NPS", score: 2, comment: "  Laging offline  ", contactOk: true }, "IOS");
    expect(res).toMatchObject({ followUp: "TICKET", ticketId: "t1", bucket: "DETRACTOR" });
    expect(res.message).toContain("email you");
    expect(tx.supportTicket.create).toHaveBeenCalledWith({ data: { familyId: "fam1", userId: "u1", category: "FEEDBACK", subject: "Survey answer: 2/10", message: "Laging offline" } });
    expect(tx.feedback.create.mock.calls[0][0].data).toMatchObject({ kind: "NPS", score: 2, bucket: "DETRACTOR", comment: "Laging offline", platform: "IOS", trigger: "nps_survey", ticketId: "t1" });
    expect(tx.feedbackState.upsert.mock.calls[0][0].update).toHaveProperty("npsAnsweredAt");
    await Promise.all(afterFns.map((f) => f()));
    expect(forwardTicket).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), user);
  });

  it("keeps a happy answer to itself", async () => {
    const res = await submitFeedback(user, { kind: "NPS", score: 10, contactOk: true }, "WEB");
    expect(res).toMatchObject({ followUp: "NONE", ticketId: null, bucket: "PROMOTER" });
    expect(tx.supportTicket.create).not.toHaveBeenCalled();
    expect(afterFns).toHaveLength(0);
  });

  it("records an idea without touching the survey's timing", async () => {
    await submitFeedback(user, { kind: "IDEA", comment: "Dark mode please" }, "ANDROID");
    expect(tx.feedbackState.upsert.mock.calls[0][0].update).not.toHaveProperty("npsAnsweredAt");
  });

  it("is rate limited per parent", async () => {
    enforce.mockRejectedValueOnce(new Error("limited"));
    await expect(submitFeedback(user, { kind: "IDEA", comment: "x".repeat(10) }, "WEB")).rejects.toThrow("limited");
    expect(tx.feedback.create).not.toHaveBeenCalled();
  });
});

describe("feedback queries keep to the console's privacy rule", () => {
  const src = readFileSync(join(__dirname, "..", "feedback-queries.ts"), "utf8");
  it("reads only feedback", () => {
    expect(new Set([...src.matchAll(/db\.(\w+)\./g)].map((m) => m[1]))).toEqual(new Set(["feedback"]));
  });
});
