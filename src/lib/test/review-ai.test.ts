import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../mail", () => ({ sendMail: vi.fn(), escapeHtml: (s: string) => s }));
vi.mock("../email-verification", () => ({ appUrl: () => "https://app.test" }));
const structured = vi.hoisted(() => vi.fn());
vi.mock("../ai", () => ({ structured }));

const { classifyAndDraft, fitReply, reviewPrompt } = await import("../review-ai");

const review = { store: "GOOGLE_PLAY" as const, rating: 2, reviewTitle: "Laging offline", text: "Hindi gumagana sa phone ng anak ko", language: "fil" };
const reading = (reply: string, over: object = {}) => ({
  output: { sentiment: "NEGATIVE", topics: ["PAIRING", "PAIRING", "BUGS"], urgency: "HIGH", summary: " The child's phone keeps showing offline. ", likelyChild: false, reply, ...over },
  provider: "anthropic",
});

describe("reviewPrompt", () => {
  it("carries the review and the limit, and nothing about who wrote it", () => {
    const withAuthor = { ...review, authorName: "Maria Santos" } as typeof review;
    const p = reviewPrompt(withAuthor, 350, "shorter please");
    expect(p).toContain("A 2-star review on Google Play (language: fil).");
    expect(p).toContain("<title>Laging offline</title>");
    expect(p).toContain("<review>\nHindi gumagana sa phone ng anak ko\n</review>");
    expect(p).toContain("at most 350 characters");
    expect(p).toContain("<staff_request>\nshorter please\n</staff_request>");
    expect(p).not.toContain("Maria");
  });
});

describe("fitReply", () => {
  it("leaves a reply that fits, tidied", () => {
    expect(fitReply("  Salamat po!\r\n\n\n\nEmail us.  ", 350)).toEqual({ text: "Salamat po!\n\nEmail us.", trimmed: false });
  });

  it("cuts a long reply at the last whole sentence", () => {
    const text = `${"First sentence is here. ".repeat(10)}And a last one that goes on.`;
    const out = fitReply(text, 120);
    expect(out.trimmed).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(120);
    expect(out.text.endsWith(".")).toBe(true);
  });

  it("falls back to the last word when there's no sentence end", () => {
    const out = fitReply("word ".repeat(100), 50);
    expect(out.text.length).toBeLessThanOrEqual(50);
    expect(out.text.endsWith("word")).toBe(true);
  });
});

describe("classifyAndDraft", () => {
  beforeEach(() => structured.mockReset());

  it("returns the reading with topics deduplicated and capped", async () => {
    structured.mockResolvedValue(reading("Pasensya na po. Email support@eguard.family. — The eGuard team"));
    const r = await classifyAndDraft(review);
    expect(r).toMatchObject({ topics: ["PAIRING", "BUGS"], summary: "The child's phone keeps showing offline.", trimmed: false, provider: "anthropic" });
    expect(structured).toHaveBeenCalledTimes(1);
    expect(structured.mock.calls[0][0]).toMatchObject({ name: "review_reading", tag: "review-ai" });
    expect(structured.mock.calls[0][0].system).toContain("Never ask them to change, raise or remove their rating");
  });

  it("asks once more for a Play reply over 350 characters, then trims what's still too long", async () => {
    structured.mockResolvedValueOnce(reading("x. ".repeat(140))).mockResolvedValueOnce(reading("Still too long. ".repeat(30)));
    const r = await classifyAndDraft(review);
    expect(structured).toHaveBeenCalledTimes(2);
    expect(structured.mock.calls[1][0].prompt).toContain("at most 297 characters");
    expect(structured.mock.calls[1][0].prompt).toContain("Write it again, shorter.");
    expect(r.reply.length).toBeLessThanOrEqual(350);
    expect(r.trimmed).toBe(true);
  });

  it("gives the App Store its longer limit", async () => {
    structured.mockResolvedValue(reading("y ".repeat(300)));
    const r = await classifyAndDraft({ ...review, store: "APP_STORE" });
    expect(structured).toHaveBeenCalledTimes(1);
    expect(r.trimmed).toBe(false);
  });

  it("passes provider errors through", async () => {
    const busy = Object.assign(Object.create(Error.prototype) as Error, { message: "busy", code: "rate_limited" });
    structured.mockRejectedValueOnce(busy);
    await expect(classifyAndDraft(review)).rejects.toBe(busy);
  });

  it("files a reading with no topics under OTHER", async () => {
    structured.mockResolvedValue(reading("Thanks!", { topics: [] }));
    expect((await classifyAndDraft(review)).topics).toEqual(["OTHER"]);
  });
});
