import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const logStaff = vi.hoisted(() => vi.fn());
vi.mock("../staff-auth", () => ({ logStaff }));

/** Just enough of the database for a review and its replies, with updateMany's "only from this state" behaviour */
const store = vi.hoisted(() => ({
  review: null as null | Record<string, unknown>,
  replies: [] as Record<string, unknown>[],
}));
const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && "in" in v) return (v.in as unknown[]).includes(row[k]);
    if (v && typeof v === "object" && "not" in v) return row[k] !== v.not;
    return row[k] === v;
  });
vi.mock("../db", () => {
  const db = {
    storeReview: {
      findUnique: vi.fn(async () => (store.review ? { ...store.review } : null)),
      update: vi.fn(async ({ data }: { data: object }) => Object.assign(store.review!, data)),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        if (!store.review || !matches(store.review, where)) return { count: 0 };
        Object.assign(store.review, data);
        return { count: 1 };
      }),
    },
    storeReviewReply: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => store.replies.filter((r) => matches(r, where)).at(-1) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const r = { id: `rep${store.replies.length + 1}`, status: "DRAFT", trimmed: false, ...data };
        store.replies.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: object }) => Object.assign(store.replies.find((r) => r.id === where.id)!, data)),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        const hit = store.replies.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { db };
});

const { approveAndPost, replyProblem, saveDraft } = await import("../store-reviews/post");

const posted = { id: null, at: new Date("2026-11-17T10:00:00Z") };

beforeEach(() => {
  store.review = { id: "rv1", store: "GOOGLE_PLAY", externalId: "gp:1", textHash: "h1", status: "DRAFTED" };
  store.replies = [{ id: "rep0", reviewId: "rv1", text: "AI draft", source: "AI", forTextHash: "h1", status: "DRAFT", trimmed: true }];
  logStaff.mockReset();
});

describe("replyProblem", () => {
  it("needs words, within the store's limit", () => {
    expect(replyProblem("GOOGLE_PLAY", "  ")).toBe("Write a reply first.");
    expect(replyProblem("GOOGLE_PLAY", "a".repeat(351))).toContain("at most 350");
    expect(replyProblem("GOOGLE_PLAY", "a".repeat(350))).toBeNull();
    expect(replyProblem("APP_STORE", "a".repeat(351))).toBeNull();
  });
});

describe("approveAndPost", () => {
  it("posts staff's edited text and records it as the store's reply", async () => {
    const post = vi.fn(async () => posted);
    await approveAndPost("rv1", "Salamat po! Email support@eguard.family.", "staff1", post);
    expect(post).toHaveBeenCalledWith("GOOGLE_PLAY", "gp:1", "Salamat po! Email support@eguard.family.");
    expect(store.review).toMatchObject({ status: "REPLIED", storeReplyText: "Salamat po! Email support@eguard.family.", storeReplyAt: posted.at });
    // The AI draft was edited, so it's staff's words now, approved by them
    expect(store.replies[0]).toMatchObject({ status: "POSTED", source: "STAFF", approvedById: "staff1", trimmed: false });
    expect(logStaff).toHaveBeenCalledWith("staff1", "review.reply.post", "review:rv1", expect.stringContaining("Google Play"));
  });

  it("refuses a reply over the limit without calling the store", async () => {
    const post = vi.fn(async () => posted);
    await expect(approveAndPost("rv1", "a".repeat(351), "staff1", post)).rejects.toMatchObject({ code: "invalid" });
    expect(post).not.toHaveBeenCalled();
  });

  it("posts once when it's being posted already", async () => {
    store.review!.status = "POSTING";
    const post = vi.fn(async () => posted);
    await expect(approveAndPost("rv1", "Thanks", "staff1", post)).rejects.toMatchObject({ code: "conflict" });
    expect(post).not.toHaveBeenCalled();
  });

  it("won't post a reply written for words the reviewer has since changed", async () => {
    const post = vi.fn(async () => posted);
    // The review changed between saving the draft and claiming the review
    const realUpdate = store.replies[0];
    store.review!.textHash = "h1";
    const { db } = (await import("../db")) as unknown as { db: { storeReview: { updateMany: ReturnType<typeof vi.fn> } } };
    db.storeReview.updateMany.mockImplementationOnce(async () => ({ count: 0 }));
    await expect(approveAndPost("rv1", "Thanks", "staff1", post)).rejects.toMatchObject({ code: "conflict" });
    expect(post).not.toHaveBeenCalled();
    expect(realUpdate.status).toBe("SUPERSEDED");
  });

  it("marks the reply failed with the store's reason, ready to try again", async () => {
    const err = Object.assign(Object.create(Error.prototype) as Error, { message: "Google Play didn't accept this reply.", code: "store_rejected", status: 400 });
    Object.setPrototypeOf(err, (await import("../errors")).ServiceError.prototype);
    const post = vi.fn(async () => { throw err; });
    await expect(approveAndPost("rv1", "Thanks", "staff1", post)).rejects.toBe(err);
    expect(store.review!.status).toBe("FAILED");
    expect(store.replies[0]).toMatchObject({ status: "FAILED", postError: "Google Play didn't accept this reply." });
    // Trying again reuses the failed draft
    await approveAndPost("rv1", "Thanks", "staff1", vi.fn(async () => posted));
    expect(store.replies).toHaveLength(1);
    expect(store.review!.status).toBe("REPLIED");
  });
});

describe("saveDraft", () => {
  it("starts a staff draft when there's none for the current words", async () => {
    store.replies = [{ id: "old", reviewId: "rv1", text: "For old words", source: "AI", forTextHash: "h0", status: "DRAFT" }];
    store.review!.status = "NEW";
    const r = await saveDraft("rv1", "New reply", "staff1");
    expect(r).toMatchObject({ source: "STAFF", forTextHash: "h1", text: "New reply" });
    expect(store.review!.status).toBe("DRAFTED");
  });
});

/** Store reviews are public words; this file must still never reach into families' or children's data */
describe("review queries keep to the console's privacy rule", () => {
  const src = readFileSync(join(__dirname, "..", "review-queries.ts"), "utf8");
  it("reads only the store review tables", () => {
    const models = [...src.matchAll(/db\.(\w+)\./g)].map((m) => m[1]);
    expect(new Set(models)).toEqual(new Set(["storeReview", "storeReviewReply", "storeSyncState"]));
    const tables = [...src.matchAll(/FROM "(\w+)"/g)].map((m) => m[1]);
    expect(new Set(tables)).toEqual(new Set(["StoreReview"]));
  });
});
