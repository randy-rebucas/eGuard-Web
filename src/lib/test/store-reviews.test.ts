import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../mail", () => ({ sendMail: vi.fn(), escapeHtml: (s: string) => s }));
vi.mock("../review-ai", () => ({ classifyAndDraft: vi.fn(), CLASSIFIER_VERSION: 1 }));
vi.mock("../ai", () => ({ aiAvailable: () => false }));

const { normalizePlayReview, listPlayReviews, replyPlayReview } = await import("../store-reviews/play");
const { normalizeAscReview, listAscReviews, ascToken } = await import("../store-reviews/app-store");
const { reviewTextHash } = await import("../store-reviews/types");
const { syncDue, shouldStopPaging, reviewChange, syncEveryMs } = await import("../store-reviews/sync");

const playRaw = (over: object = {}) => ({
  reviewId: "gp:abc",
  authorName: "Ana Cruz",
  comments: [
    { userComment: { text: "Great app\tWorks on my son's phone", lastModified: { seconds: "1763370000", nanos: 500_000_000 }, starRating: 5, reviewerLanguage: "en", device: "a52", androidOsVersion: 34, appVersionName: "1.4.0" } },
    { developerComment: { text: "Thank you!", lastModified: { seconds: "1763380000" } } },
  ],
  ...over,
});

describe("normalizePlayReview", () => {
  it("splits the title from the text and keeps the developer reply", () => {
    expect(normalizePlayReview(playRaw())).toEqual({
      store: "GOOGLE_PLAY", externalId: "gp:abc", rating: 5, reviewTitle: "Great app", text: "Works on my son's phone", authorName: "Ana Cruz",
      language: "en", territory: null, appVersion: "1.4.0", device: "a52 · Android API 34", reviewedAt: new Date(1763370000_500),
      reply: { text: "Thank you!", at: new Date(1763380000_000), id: null },
    });
  });

  it("has no title or reply when there are none", () => {
    const r = normalizePlayReview(playRaw({ comments: [{ userComment: { text: "Ok lang", lastModified: { seconds: 1 }, starRating: 3 } }] }));
    expect(r).toMatchObject({ reviewTitle: null, text: "Ok lang", reply: null, device: null });
  });

  it("drops a review without stars or a date", () => {
    expect(normalizePlayReview(playRaw({ comments: [{ userComment: { text: "x", lastModified: { seconds: 1 } } }] }))).toBeNull();
    expect(normalizePlayReview(playRaw({ comments: [{ userComment: { text: "x", starRating: 4 } }] }))).toBeNull();
    expect(normalizePlayReview({ reviewId: "x" })).toBeNull();
  });
});

describe("normalizeAscReview", () => {
  const raw = {
    id: "asc-1",
    attributes: { rating: 2, title: "Hindi gumagana", body: "Laging offline", reviewerNickname: "nanay123", createdDate: "2026-11-10T03:00:00-08:00", territory: "PHL" },
    relationships: { response: { data: { id: "resp-1" } } },
  };

  it("joins the response from `included`", () => {
    const r = normalizeAscReview(raw, [{ id: "resp-1", attributes: { responseBody: "Sorry to hear that", lastModifiedDate: "2026-11-11T00:00:00Z" } }]);
    expect(r).toMatchObject({ store: "APP_STORE", externalId: "asc-1", rating: 2, reviewTitle: "Hindi gumagana", text: "Laging offline", authorName: "nanay123", territory: "PHL" });
    expect(r?.reply).toEqual({ text: "Sorry to hear that", at: new Date("2026-11-11T00:00:00Z"), id: "resp-1" });
    expect(r?.reviewedAt.toISOString()).toBe("2026-11-10T11:00:00.000Z");
  });

  it("has no reply when the response isn't included, and drops broken rows", () => {
    expect(normalizeAscReview(raw)?.reply).toBeNull();
    expect(normalizeAscReview({ ...raw, attributes: { ...raw.attributes, rating: 0 } })).toBeNull();
    expect(normalizeAscReview({ ...raw, attributes: { ...raw.attributes, createdDate: "nope" } })).toBeNull();
  });
});

describe("sync rules", () => {
  const H = 3600_000;
  const at = (h: number) => new Date(h * H);

  it("syncs when never run, after the interval, or an hour after a failure", () => {
    expect(syncDue(null, 0)).toBe(true);
    expect(syncDue({ lastRunAt: at(0), lastSuccessAt: at(0), newestReviewAt: null }, 5 * H, 6 * H)).toBe(false);
    expect(syncDue({ lastRunAt: at(0), lastSuccessAt: at(0), newestReviewAt: null }, 6 * H, 6 * H)).toBe(true);
    // Failed: lastRunAt newer than lastSuccessAt
    expect(syncDue({ lastRunAt: at(10), lastSuccessAt: at(0), newestReviewAt: null }, 10.5 * H, 6 * H)).toBe(false);
    expect(syncDue({ lastRunAt: at(10), lastSuccessAt: at(0), newestReviewAt: null }, 11 * H, 6 * H)).toBe(true);
    expect(syncDue({ lastRunAt: at(10), lastSuccessAt: null, newestReviewAt: null }, 11 * H, 6 * H)).toBe(true);
  });

  it("reads REVIEW_SYNC_HOURS within 1–72 hours", () => {
    expect(syncEveryMs({})).toBe(6 * H);
    expect(syncEveryMs({ REVIEW_SYNC_HOURS: "12" })).toBe(12 * H);
    expect(syncEveryMs({ REVIEW_SYNC_HOURS: "0" })).toBe(6 * H);
    expect(syncEveryMs({ REVIEW_SYNC_HOURS: "500" })).toBe(6 * H);
  });

  it("stops App Store paging once a page reaches past what's saved, less the overlap", () => {
    const newest = new Date("2026-11-10T00:00:00Z");
    expect(shouldStopPaging(new Date("2026-11-09T00:00:00Z"), newest)).toBe(false);
    expect(shouldStopPaging(new Date("2026-11-07T23:00:00Z"), newest)).toBe(true);
    expect(shouldStopPaging(new Date("2020-01-01"), null)).toBe(false);
    expect(shouldStopPaging(null, newest)).toBe(false);
  });

  it("tells new, edited and newly answered reviews apart", () => {
    const r = normalizePlayReview(playRaw())!;
    expect(reviewChange(null, r)).toBe("new");
    expect(reviewChange({ textHash: reviewTextHash(r), storeReplyText: "Thank you!" }, r)).toBe("same");
    expect(reviewChange({ textHash: reviewTextHash(r), storeReplyText: null }, r)).toBe("reply_changed");
    expect(reviewChange({ textHash: reviewTextHash({ ...r, rating: 4 }), storeReplyText: "Thank you!" }, r)).toBe("edited");
    expect(reviewTextHash({ ...r, reviewTitle: "Other" })).not.toBe(reviewTextHash(r));
  });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Google Play reviews API", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const cfg = { packageName: "app.eguard.android", account: { client_email: `sa-${Math.random()}@x.iam`, private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() } };

  it("pages with the token and posts replies", async () => {
    const f = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("oauth2")) return json({ access_token: "tok", expires_in: 3600 });
      if (u.includes(":reply")) return json({ result: { replyText: "Thanks" } });
      return json(u.includes("token=p2") ? { reviews: [playRaw({ reviewId: "b" })] } : { reviews: [playRaw()], tokenPagination: { nextPageToken: "p2" } });
    }) as unknown as typeof fetch;
    const one = await listPlayReviews(cfg, {}, f);
    expect(one.reviews).toHaveLength(1);
    expect(one.nextToken).toBe("p2");
    const two = await listPlayReviews(cfg, { token: "p2" }, f);
    expect(two).toMatchObject({ nextToken: null });
    await replyPlayReview(cfg, "gp:abc", "Thanks", f);
    const call = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.find(([u]) => String(u).includes(":reply"))!;
    expect(String(call[0])).toContain("/applications/app.eguard.android/reviews/gp%3Aabc:reply");
    expect(JSON.parse(String(call[1].body))).toEqual({ replyText: "Thanks" });
  });

  it("says what's wrong when Play refuses or fails", async () => {
    const f = (status: number) => (async (url: string | URL | Request) => (String(url).includes("oauth2") ? json({ access_token: "tok", expires_in: 3600 }) : json({}, status))) as unknown as typeof fetch;
    await expect(listPlayReviews(cfg, {}, f(403))).rejects.toMatchObject({ code: "store_forbidden" });
    await expect(listPlayReviews(cfg, {}, f(500))).rejects.toMatchObject({ code: "store_unavailable" });
    await expect(replyPlayReview(cfg, "x", "y", f(400))).rejects.toMatchObject({ code: "store_rejected" });
  });
});

describe("App Store Connect API", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const cfg = { issuerId: "iss-1", keyId: `KEY${Math.random()}`, privateKey, appId: "123456" };

  it("signs a short-lived ES256 token Apple accepts", () => {
    const now = Date.UTC(2026, 10, 17);
    const token = ascToken(cfg, now);
    const [h, c, s] = token.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: cfg.keyId, typ: "JWT" });
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({ iss: "iss-1", aud: "appstoreconnect-v1" });
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(1200);
    expect(verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))).toBe(true);
    expect(ascToken(cfg, now + 60_000)).toBe(token);
  });

  it("follows `links.next` only back to App Store Connect", async () => {
    const f = vi.fn(async () => json({ data: [], links: { next: "https://evil.example/next" } })) as unknown as typeof fetch;
    const page = await listAscReviews(cfg, {}, f);
    expect(page.next).toBe("https://evil.example/next");
    await listAscReviews(cfg, { next: page.next }, f);
    const urls = (f as unknown as { mock: { calls: [string][] } }).mock.calls.map(([u]) => u);
    expect(urls.every((u) => u.startsWith("https://api.appstoreconnect.apple.com/v1/apps/123456/customerReviews?"))).toBe(true);
    expect(urls[0]).toContain("include=response");
  });

  it("explains a refused key", async () => {
    const f = (async () => json({}, 401)) as unknown as typeof fetch;
    await expect(listAscReviews(cfg, {}, f)).rejects.toMatchObject({ code: "store_forbidden" });
  });
});
