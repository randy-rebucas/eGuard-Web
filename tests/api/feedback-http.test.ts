import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PASSWORD, call, cleanup, db, email, register } from "./helpers";

/**
 * Feedback, the NPS survey and the store rating prompt through the mobile API, against a running server
 * (docs/features/feedback.md). The feature flags they depend on are put back as they were found.
 */

let token = "", userId = "";
const FLAGS = ["nps_survey", "rate_prompt"];
let flags: { key: string; description: string; enabled: boolean; rollout: number }[] = [];
const android = { "x-eguard-client": "android" };

beforeAll(async () => {
  flags = await db.featureFlag.findMany({ where: { key: { in: FLAGS } }, select: { key: true, description: true, enabled: true, rollout: true } });
  const r = await register({ name: "Liza Cruz", email: email("feedback"), password: PASSWORD, guardian: true });
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.data)}`);
  token = r.data.token;
  userId = r.data.user.id;
});

afterAll(async () => {
  await db.featureFlag.deleteMany({ where: { key: { in: FLAGS } } });
  if (flags.length) await db.featureFlag.createMany({ data: flags });
  await cleanup();
});

const setFlag = (key: string, enabled: boolean) =>
  db.featureFlag.upsert({ where: { key }, create: { key, description: "test", enabled, rollout: 100 }, update: { enabled, rollout: 100 } });

describe("feedback API", () => {
  it("needs a session", async () => {
    for (const [m, p] of [["GET", "/feedback/prompts"], ["POST", "/feedback"], ["POST", "/feedback/nps"], ["GET", "/review-prompt"], ["POST", "/review-prompt"]] as const) {
      expect((await call(m, p, { body: m === "POST" ? {} : undefined })).status, p).toBe(401);
    }
  });

  it("doesn't ask a brand-new parent for the survey, flag or not", async () => {
    expect((await call("GET", "/feedback/prompts", { token })).data).toEqual({ nps: { due: false } });
    await setFlag("nps_survey", true);
    expect((await call("GET", "/feedback/prompts", { token })).data).toEqual({ nps: { due: false } });
  });

  it("checks what's sent", async () => {
    expect((await call("POST", "/feedback", { token, body: { kind: "NPS" } })).status).toBe(400);
    expect((await call("POST", "/feedback", { token, body: { kind: "NPS", score: 11 } })).status).toBe(400);
    expect((await call("POST", "/feedback", { token, body: { kind: "IDEA", score: 4, comment: "Dark mode" } })).status).toBe(400);
    expect((await call("POST", "/feedback/nps", { token, body: { event: "liked" } })).status).toBe(400);
  });

  it("opens a support ticket for an unhappy parent who said we may write", async () => {
    const r = await call("POST", "/feedback", { token, headers: android, body: { kind: "NPS", score: 3, comment: "Keeps showing offline", contactOk: true, appVersion: "1.0.14" } });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ followUp: "TICKET", bucket: "DETRACTOR", ticketId: expect.any(String) });
    const tickets = (await call("GET", "/support/tickets", { token })).data.tickets;
    expect(tickets[0]).toMatchObject({ id: r.data.ticketId, category: "FEEDBACK", subject: "Survey answer: 3/10", message: "Keeps showing offline" });
    const saved = await db.feedback.findFirstOrThrow({ where: { userId } });
    expect(saved).toMatchObject({ platform: "ANDROID", appVersion: "1.0.14", trigger: "nps_survey" });
    expect((await db.feedbackState.findUniqueOrThrow({ where: { userId } })).npsAnsweredAt).not.toBeNull();
  });

  it("keeps an idea to itself", async () => {
    const r = await call("POST", "/feedback", { token, body: { kind: "IDEA", comment: "A weekly email for grandparents" } });
    expect(r.data).toMatchObject({ followUp: "NONE", ticketId: null });
  });

  it("records the survey being shown and dismissed", async () => {
    expect((await call("POST", "/feedback/nps", { token, body: { event: "seen" } })).data).toEqual({ ok: true });
    expect((await call("POST", "/feedback/nps", { token, body: { event: "dismissed" } })).status).toBe(200);
    const s = await db.feedbackState.findUniqueOrThrow({ where: { userId } });
    expect(s.npsSeenAt).not.toBeNull();
    expect(s.npsDismissedAt).not.toBeNull();
  });
});

describe("store rating prompt API", () => {
  it("says no while the flag is off, then why not once it's on", async () => {
    await setFlag("rate_prompt", false);
    expect((await call("GET", "/review-prompt", { token, headers: android })).data).toEqual({ eligible: false, reason: "flag_off" });
    await setFlag("rate_prompt", true);
    expect((await call("GET", "/review-prompt", { token, headers: android })).data).toEqual({ eligible: false, reason: "too_new" });
  });

  it("records each app's ask and counts the year", async () => {
    expect((await call("POST", "/review-prompt", { token, headers: android })).data).toEqual({ ok: true });
    expect((await call("POST", "/review-prompt", { token })).status).toBe(200);
    const s = await db.feedbackState.findUniqueOrThrow({ where: { userId } });
    expect(Object.keys(s.ratePromptedAt as object).sort()).toEqual(["ANDROID", "IOS"]);
    expect(s.ratePromptCount).toBe(2);
  });
});

describe("/rate", () => {
  it("sends a phone to Google Play without asking anything", async () => {
    const res = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:3000"}/rate`, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14)" } });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("play.google.com");
  });
});
