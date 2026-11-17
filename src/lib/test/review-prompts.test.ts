import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../feature-flags", () => ({ isEnabled: vi.fn() }));

const { ratePromptEligibility, reviewInviteEligibility, readPromptedAt, promptsThisYear, storeFor, RATE_RULES } = await import("../review-prompts");
const { render, safeLink } = await import("../parent-care/templates");
const { automationByKey } = await import("../parent-care/definitions");

const DAY = 864e5;
const now = Date.UTC(2026, 10, 18);
const ago = (days: number) => new Date(now - days * DAY);
type Facts = Parameters<typeof ratePromptEligibility>[0];
const facts = (over: Partial<Facts> = {}): Facts => ({
  flagOn: true, accountCreatedAt: ago(60), activeDays14: 5, devices: [{ pairedAt: ago(40), healthy: true }],
  urgentAlerts: 0, openTickets: 0, lastFeedbackAt: null, promptedAt: {}, promptsLastYear: 0, ...over,
});

describe("ratePromptEligibility", () => {
  it("asks a settled-in parent whose devices are working", () => {
    expect(ratePromptEligibility(facts(), "ANDROID", now)).toEqual({ eligible: true, reason: "eligible" });
  });

  it.each<[string, Partial<Facts>]>([
    ["flag_off", { flagOn: false }],
    ["too_new", { accountCreatedAt: ago(RATE_RULES.minAccountDays - 1) }],
    ["not_active", { activeDays14: 2 }],
    ["no_settled_device", { devices: [{ pairedAt: ago(3), healthy: true }] }],
    ["no_settled_device", { devices: [] }],
    ["device_needs_attention", { devices: [{ pairedAt: ago(40), healthy: true }, { pairedAt: ago(10), healthy: false }] }],
    ["urgent_alert", { urgentAlerts: 1 }],
    ["open_ticket", { openTickets: 1 }],
    ["recent_feedback", { lastFeedbackAt: ago(29) }],
    ["asked_recently", { promptedAt: { ANDROID: ago(119) } }],
    ["yearly_limit", { promptsLastYear: 3 }],
  ])("holds off: %s", (reason, over) => {
    expect(ratePromptEligibility(facts(over), "ANDROID", now)).toEqual({ eligible: false, reason });
  });

  it("counts each app's last ask separately", () => {
    expect(ratePromptEligibility(facts({ promptedAt: { IOS: ago(10) } }), "ANDROID", now).eligible).toBe(true);
    expect(ratePromptEligibility(facts({ promptedAt: { ANDROID: ago(121) } }), "ANDROID", now).eligible).toBe(true);
  });

  /**
   * No review gating: what a parent answered in the survey can't change whether they're asked. The facts carry no
   * score at all; this pins down that recent feedback delays the ask the same for a 10 and a 2.
   */
  it("gives a happy and an unhappy parent the same answer", () => {
    const afterTen = facts({ lastFeedbackAt: ago(5) });
    const afterTwo = facts({ lastFeedbackAt: ago(5) });
    expect(ratePromptEligibility(afterTen, "ANDROID", now)).toEqual(ratePromptEligibility(afterTwo, "ANDROID", now));
    expect(Object.keys(facts())).not.toEqual(expect.arrayContaining(["score"]));
    expect(Object.keys(facts()).some((k) => /score|bucket|sentiment|nps/i.test(k))).toBe(false);
  });
});

describe("reviewInviteEligibility", () => {
  it("waits longer than the app's prompt, and never follows one closely", () => {
    expect(reviewInviteEligibility(facts(), now).eligible).toBe(true);
    expect(reviewInviteEligibility(facts({ accountCreatedAt: ago(20) }), now)).toEqual({ eligible: false, reason: "too_new" });
    expect(reviewInviteEligibility(facts({ promptedAt: { IOS: ago(30) } }), now)).toEqual({ eligible: false, reason: "asked_recently" });
    expect(reviewInviteEligibility(facts({ promptedAt: { ANDROID: ago(61) } }), now).eligible).toBe(true);
    expect(reviewInviteEligibility(facts({ lastFeedbackAt: ago(1) }), now).reason).toBe("recent_feedback");
  });
});

describe("stored prompt history", () => {
  it("reads only valid dates for known apps", () => {
    expect(readPromptedAt({ IOS: "2026-01-01T00:00:00Z", ANDROID: "nope", WEB: "2026-01-01T00:00:00Z" })).toEqual({ IOS: new Date("2026-01-01T00:00:00Z") });
    expect(readPromptedAt(null)).toEqual({});
  });

  it("restarts the yearly count a year after the year's first ask", () => {
    expect(promptsThisYear({ ratePromptCount: 2, ratePromptYearFrom: ago(100) }, now)).toBe(2);
    expect(promptsThisYear({ ratePromptCount: 3, ratePromptYearFrom: ago(366) }, now)).toBe(0);
    expect(promptsThisYear(null, now)).toBe(0);
  });
});

describe("/rate", () => {
  it("sends a phone to its store, and the rest to the page that lists them", () => {
    expect(storeFor("Mozilla/5.0 (Linux; Android 14; SM-A546E)")).toContain("play.google.com");
    // Not on the App Store yet: null, and /rate falls back to Google Play
    expect(storeFor("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBeNull();
    expect(storeFor("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBeNull();
    expect(storeFor(null)).toBeNull();
  });
});

describe("the review_invite message", () => {
  it("offers rating and help to everyone, by email only, and links inside eGuard", () => {
    const r = render("review_invite", "en", { params: {} })!;
    expect(r.title).toBe("Would you rate eGuard?");
    expect(r.body).toContain("Something not working");
    expect(r.body).not.toMatch(/5 stars|five stars|reward|free month/i);
    expect(safeLink(r.link)).toBe("/rate");
    expect(automationByKey("review_invite")).toMatchObject({ channels: ["EMAIL"], cooldownDays: 180, toggle: "feedbackInvites" });
  });

  it("sends English until the Filipino text is reviewed", () => {
    expect(render("review_invite", "fil", { params: {} })?.language).toBe("en");
  });
});
