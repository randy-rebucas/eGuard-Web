import { beforeEach, describe, expect, it, vi } from "vitest";

/** Mailing lists: double opt-in, nothing given away about who's subscribed, links that expire and work once. */

vi.mock("server-only", () => ({}));
vi.mock("../email-verification", () => ({ appUrl: () => "https://app.test" }));
const sendMail = vi.hoisted(() => vi.fn());
vi.mock("../mail", async () => ({ sendMail, escapeHtml: (await vi.importActual<typeof import("../mail")>("../mail")).escapeHtml }));
const db = vi.hoisted(() => ({
  subscriber: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
}));
vi.mock("../db", () => ({ db }));

const { SubscribeSchema, confirmEmail, confirmSubscription, subscribe, CONFIRM_DAYS } = await import("../subscribers");
const { sha256 } = await import("../auth");

const now = new Date("2026-10-17T00:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const sentLink = () => {
  const url = /https:\/\/app\.test\/subscribe\/confirm\?t=(\S+)/.exec(sendMail.mock.calls.at(-1)![0].text)!;
  return decodeURIComponent(url[1]);
};

beforeEach(() => vi.clearAllMocks());

describe("SubscribeSchema", () => {
  it("lowercases and trims the address, and only takes known lists", () => {
    expect(SubscribeSchema.parse({ email: "  Ana@Example.PH ", list: "NEWSLETTER" })).toEqual({ email: "ana@example.ph", list: "NEWSLETTER", source: "site" });
    expect(SubscribeSchema.safeParse({ email: "not-an-email", list: "NEWSLETTER" }).success).toBe(false);
    expect(SubscribeSchema.safeParse({ email: "a@b.ph", list: "EVERYTHING" }).success).toBe(false);
  });
});

describe("confirmEmail", () => {
  it("says what they signed up for, links to the confirm page, and that ignoring it is fine", () => {
    const m = confirmEmail("IOS_LAUNCH", "tok/+");
    expect(m.subject).toBe("Confirm your email for eGuard's iPhone launch email");
    expect(confirmEmail("NEWSLETTER", "t").subject).toBe("Confirm your email for eGuard news");
    expect(m.text).toContain("one email when eGuard for iPhone and iPad is out");
    expect(m.text).toContain("https://app.test/subscribe/confirm?t=tok%2F%2B");
    expect(m.text).toContain(`we'll delete your address after ${CONFIRM_DAYS} days`);
  });
});

describe("subscribe", () => {
  it("stores a new address unconfirmed and emails a link whose token is stored only as a hash", async () => {
    db.subscriber.findUnique.mockResolvedValue(null);
    db.subscriber.create.mockResolvedValue({});
    expect(await subscribe({ email: "a@x.ph", list: "NEWSLETTER", source: "footer" }, now)).toBe("sent");
    const token = sentLink();
    expect(db.subscriber.create).toHaveBeenCalledWith({ data: { email: "a@x.ph", lists: ["NEWSLETTER"], source: "footer", confirmSentAt: now, confirmTokenHash: sha256(token) } });
    expect(JSON.stringify(db.subscriber.create.mock.calls)).not.toContain(token);
  });

  it("adds a list for a confirmed address without emailing it", async () => {
    db.subscriber.findUnique.mockResolvedValue({ id: "s1", email: "a@x.ph", lists: ["NEWSLETTER"], confirmedAt: ago(864e5), confirmSentAt: ago(2 * 864e5) });
    expect(await subscribe({ email: "a@x.ph", list: "IOS_LAUNCH", source: "iphone" }, now)).toBe("already-confirmed");
    expect(db.subscriber.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { lists: { push: "IOS_LAUNCH" }, source: "iphone" } });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends an unconfirmed address a new link, but not twice in a minute", async () => {
    db.subscriber.findUnique.mockResolvedValue({ id: "s1", email: "a@x.ph", lists: ["NEWSLETTER"], confirmedAt: null, confirmSentAt: ago(10_000) });
    expect(await subscribe({ email: "a@x.ph", list: "NEWSLETTER", source: "footer" }, now)).toBe("throttled");
    expect(sendMail).not.toHaveBeenCalled();

    db.subscriber.findUnique.mockResolvedValue({ id: "s1", email: "a@x.ph", lists: ["NEWSLETTER"], confirmedAt: null, confirmSentAt: ago(120_000) });
    expect(await subscribe({ email: "a@x.ph", list: "IOS_LAUNCH", source: "iphone" }, now)).toBe("sent");
    expect(db.subscriber.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: expect.objectContaining({ lists: ["NEWSLETTER", "IOS_LAUNCH"], confirmSentAt: now }) });
    expect(sendMail).toHaveBeenCalledOnce();
  });
});

describe("confirmSubscription", () => {
  it("confirms once, with a link from the last week", async () => {
    db.subscriber.findUnique.mockResolvedValue({ id: "s1", lists: ["NEWSLETTER"], confirmTokenHash: sha256("tok"), confirmSentAt: ago(864e5) });
    db.subscriber.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await confirmSubscription("tok", now)).toEqual({ lists: ["NEWSLETTER"] });
    expect(db.subscriber.findUnique).toHaveBeenCalledWith({ where: { confirmTokenHash: sha256("tok") } });
    expect(db.subscriber.updateMany).toHaveBeenCalledWith({ where: { id: "s1", confirmTokenHash: sha256("tok") }, data: { confirmedAt: now, confirmTokenHash: null } });
    // A second press racing the first
    expect(await confirmSubscription("tok", now)).toBeNull();
  });

  it("refuses an expired, unknown or missing token", async () => {
    db.subscriber.findUnique.mockResolvedValueOnce({ id: "s1", lists: ["NEWSLETTER"], confirmTokenHash: sha256("tok"), confirmSentAt: ago((CONFIRM_DAYS + 1) * 864e5) });
    expect(await confirmSubscription("tok", now)).toBeNull();
    db.subscriber.findUnique.mockResolvedValueOnce(null);
    expect(await confirmSubscription("nope", now)).toBeNull();
    expect(await confirmSubscription("", now)).toBeNull();
    expect(db.subscriber.updateMany).not.toHaveBeenCalled();
  });
});
