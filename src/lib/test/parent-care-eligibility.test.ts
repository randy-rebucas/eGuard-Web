import { describe, expect, it } from "vitest";
import { checkEligibility, channelPermitted, underLimits, type EligibilityInput } from "../parent-care/eligibility";
import { automationByKey } from "../parent-care/definitions";

// Wednesday 2026-10-21, 7:30 PM in Manila
const NOW = new Date("2026-10-21T11:30:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);

function input(o: Partial<Omit<EligibilityInput, "prefs">> & { prefs?: Partial<EligibilityInput["prefs"]>; key?: string } = {}): EligibilityInput {
  const { prefs, key = "weekly_plan", ...rest } = o;
  return {
    now: NOW, timezone: "Asia/Manila",
    automation: { ...automationByKey(key)!, enabled: true },
    account: { active: true, emailVerified: true },
    prefs: {
      enabled: true, inApp: true, push: true, email: true, pushConsentAt: hoursAgo(100), emailConsentAt: hoursAgo(100),
      briefings: true, followUps: true, weeklyPlan: true, checkIns: true, monthlyReport: true,
      quietStart: 21 * 60, quietEnd: 7 * 60, cohort: "TREATMENT", ...prefs,
    },
    suppressions: [], available: { PUSH: true, EMAIL: true, IN_APP: true }, recent: [], alreadySent: false, irrelevant: null,
    ...rest,
  };
}

describe("parent-care eligibility", () => {
  it("picks the automation's first permitted channel", () => {
    // weekly_plan prefers email
    expect(checkEligibility(input(), "deliver")).toEqual({ ok: true, channel: "EMAIL" });
  });

  it("never uses push or email without recorded consent, even with the switch on", () => {
    const p = { enabled: true, inApp: true, push: true, email: true, pushConsentAt: null, emailConsentAt: null } as unknown as EligibilityInput["prefs"];
    expect(channelPermitted("PUSH", p)).toBe(false);
    expect(channelPermitted("EMAIL", p)).toBe(false);
    expect(checkEligibility(input({ prefs: { pushConsentAt: null, emailConsentAt: null } }), "deliver")).toEqual({ ok: true, channel: "IN_APP" });
  });

  it("needs a verified email for email", () => {
    expect(checkEligibility(input({ account: { active: true, emailVerified: false } }), "deliver")).toEqual({ ok: true, channel: "PUSH" });
  });

  it("stops for a paused automation, an inactive account, care off, the automation's switch, or holdout", () => {
    expect(checkEligibility(input({ automation: { ...automationByKey("weekly_plan")!, enabled: false } }), "deliver")).toMatchObject({ ok: false, reason: "automation_paused" });
    expect(checkEligibility(input({ account: { active: false, emailVerified: true } }), "deliver")).toMatchObject({ reason: "account_inactive" });
    expect(checkEligibility(input({ prefs: { enabled: false } }), "deliver")).toMatchObject({ reason: "care_off" });
    expect(checkEligibility(input({ prefs: { weeklyPlan: false } }), "deliver")).toMatchObject({ reason: "automation_off" });
    expect(checkEligibility(input({ prefs: { cohort: "HOLDOUT" } }), "schedule")).toMatchObject({ reason: "holdout" });
  });

  it("honours opt-outs and suppressions, and lets expired ones go", () => {
    expect(checkEligibility(input({ suppressions: [{ scope: "ALL", reason: "OPT_OUT", until: null }] }), "deliver")).toMatchObject({ reason: "opted_out" });
    expect(checkEligibility(input({ suppressions: [{ scope: "weekly_plan", reason: "COOLDOWN", until: hoursAgo(-5) }] }), "deliver")).toMatchObject({ reason: "suppressed" });
    expect(checkEligibility(input({ suppressions: [{ scope: "weekly_plan", reason: "COOLDOWN", until: hoursAgo(1) }] }), "deliver")).toMatchObject({ ok: true });
    // An email opt-out moves the message to the next channel
    expect(checkEligibility(input({ suppressions: [{ scope: "CHANNEL:EMAIL", reason: "OPT_OUT", until: null }] }), "deliver")).toEqual({ ok: true, channel: "PUSH" });
  });

  it("skips a job whose reason has gone (activity done, parent back)", () => {
    expect(checkEligibility(input({ key: "follow_up", irrelevant: "activity_completed" }), "deliver")).toMatchObject({ reason: "activity_completed" });
    expect(checkEligibility(input({ key: "check_in", irrelevant: "returned" }), "deliver")).toMatchObject({ reason: "returned" });
  });

  it("refuses a second message for the same step", () => {
    expect(checkEligibility(input({ alreadySent: true }), "deliver")).toMatchObject({ reason: "already_sent" });
  });

  it("caps push and email at one a day and three a week across automations, then falls back to in-app", () => {
    const one = [{ channel: "PUSH", automationKey: "briefing", sentAt: hoursAgo(3) }];
    expect(underLimits("EMAIL", one, NOW)).toBe(false);
    expect(underLimits("IN_APP", one, NOW)).toBe(true);
    expect(checkEligibility(input({ recent: one }), "deliver")).toEqual({ ok: true, channel: "IN_APP" });
    const three = [30, 60, 90].map((h) => ({ channel: "EMAIL", automationKey: "briefing", sentAt: hoursAgo(h) }));
    expect(underLimits("PUSH", three, NOW)).toBe(false);
    // check_in has no in-app fallback: nothing goes
    expect(checkEligibility(input({ key: "check_in", recent: three }), "deliver")).toMatchObject({ reason: "contact_limit" });
  });

  it("limits in-app messages too", () => {
    const two = [1, 2].map((h) => ({ channel: "IN_APP", automationKey: "briefing", sentAt: hoursAgo(h) }));
    expect(underLimits("IN_APP", two, NOW)).toBe(false);
  });

  it("keeps each automation's cooldown", () => {
    const lastPlan = [{ channel: "IN_APP", automationKey: "weekly_plan", sentAt: hoursAgo(48) }];
    expect(checkEligibility(input({ recent: lastPlan }), "deliver")).toMatchObject({ reason: "cooldown" });
  });

  it("holds push and email until quiet hours end, without falling back", () => {
    const late = new Date("2026-10-21T15:00:00Z"); // 11 PM Manila
    const d = checkEligibility(input({ now: late }), "deliver");
    expect(d).toMatchObject({ ok: false, reason: "quiet_hours" });
    expect(d.ok === false && d.retryAt?.toISOString()).toBe("2026-10-21T23:00:00.000Z");
    // In-app only: shown at once, it interrupts nobody
    expect(checkEligibility(input({ now: late, prefs: { push: false, email: false } }), "deliver")).toEqual({ ok: true, channel: "IN_APP" });
  });

  it("at scheduling time ignores limits and quiet hours but still needs a channel", () => {
    const late = new Date("2026-10-21T15:00:00Z");
    const many = [1, 2, 3].map((h) => ({ channel: "EMAIL", automationKey: "briefing", sentAt: hoursAgo(h) }));
    expect(checkEligibility(input({ now: late, recent: many }), "schedule")).toMatchObject({ ok: true });
    expect(checkEligibility(input({ key: "check_in", prefs: { push: false, email: false } }), "schedule")).toMatchObject({ reason: "no_channel" });
  });

  it("needs push to be deliverable (FCM, a phone) to pick it", () => {
    expect(checkEligibility(input({ key: "briefing", available: { PUSH: false, EMAIL: true, IN_APP: true } }), "deliver")).toEqual({ ok: true, channel: "IN_APP" });
  });
});
