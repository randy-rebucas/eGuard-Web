import { request } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, PASSWORD, call, cleanup, db, email, register } from "./helpers";

/**
 * Parent care through the mobile API, end to end against a running server (docs/features/parent-care.md):
 * preferences, activities, the follow-up a start schedules and a completion cancels, messages, app events, and
 * who may call what. Messages are delivered by the maintenance job, which these tests run through the cron route.
 */

let token = "", userId = "", other = "";

beforeAll(async () => {
  const r = await register({ name: "Rosa Lim", email: email("care"), password: PASSWORD, guardian: true });
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.data)}`);
  token = r.data.token;
  userId = r.data.user.id;
  const o = await register({ name: "Omar Lim", email: email("care2"), password: PASSWORD, guardian: true });
  other = o.data.token;
});

afterAll(cleanup);

describe("parent care API", () => {
  it("needs a session", async () => {
    for (const [m, p] of [["GET", "/me/care"], ["GET", "/care/activities"], ["GET", "/care/messages"], ["POST", "/care/events"]] as const) {
      expect((await call(m, p, { body: m === "POST" ? { events: [] } : undefined })).status, p).toBe(401);
    }
  });

  it("records the sign-up and starts with in-app only: push and email wait for consent", async () => {
    const r = await call("GET", "/me/care", { token });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ enabled: true, inApp: true, push: false, email: false, consent: { push: null, email: null }, briefingDays: [1, 3, 5], deliveryTime: "19:30", effectiveTimezone: "Asia/Manila" });
    expect(await db.parentCareEvent.count({ where: { userId, type: "PARENT_REGISTERED" } })).toBe(1);
  });

  it("saves preferences, recording consent when email is turned on", async () => {
    const r = await call("PATCH", "/me/care", { token, body: { email: true, briefingDays: [2, 4, 4], deliveryTime: "20:15", quietStart: "22:00", quietEnd: "06:30", language: "fil" } });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ email: true, briefingDays: [2, 4], deliveryTime: "20:15", quietStart: "22:00", quietEnd: "06:30", language: "fil" });
    expect(r.data.consent.email).toEqual(expect.any(String));
    expect((await call("PATCH", "/me/care", { token, body: { deliveryTime: "8pm" } })).status).toBe(400);
    expect((await call("PATCH", "/me/care", { token, body: { userId: "someone-else" } })).status).toBe(400);
    expect((await call("PATCH", "/me/care", { token, body: { timezone: "Not/AZone" } })).status).toBe(400);
  });

  it("lists this week's plan and suggestions", async () => {
    const r = await call("GET", "/care/activities", { token });
    expect(r.status).toBe(200);
    expect(r.data.plan.length).toBeGreaterThanOrEqual(1);
    expect(r.data.plan[0]).toMatchObject({ status: "NEW", steps: expect.any(Array), article: expect.any(String) });
    expect(r.data.week).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("starting an activity schedules one reminder; completing it cancels the reminder", async () => {
    const start = await call("POST", "/care/activities/family-media-plan", { token, body: { action: "start" } });
    expect(start.status).toBe(200);
    expect(start.data.status).toBe("STARTED");
    const pending = await db.parentCareJob.findMany({ where: { userId, automationKey: "follow_up" } });
    expect(pending.map((j) => j.status)).toEqual(["PENDING"]);
    const done = await call("POST", "/care/activities/family-media-plan", { token, body: { action: "complete" } });
    expect(done.data.status).toBe("COMPLETED");
    expect((await db.parentCareJob.findUniqueOrThrow({ where: { id: pending[0].id } })).status).toBe("CANCELLED");
    expect((await call("POST", "/care/activities/family-media-plan", { token, body: { action: "start" } })).status).toBe(409);
    expect((await call("POST", "/care/activities/no-such-activity", { token, body: { action: "start" } })).status).toBe(404);
    expect((await call("POST", "/care/activities/family-media-plan", { token, body: { action: "explode" } })).status).toBe(400);
  });

  it("delivers a due reminder in-app through the maintenance job, and records taps once", async () => {
    await call("PATCH", "/me/care", { token, body: { email: false } });
    await call("POST", "/care/activities/caregiver-rules", { token, body: { action: "start" } });
    // Make it due now instead of tomorrow
    await db.parentCareJob.updateMany({ where: { userId, automationKey: "follow_up", status: "PENDING" }, data: { runAt: new Date(Date.now() - 1000) } });
    const cron = await fetch(`${BASE}/api/cron/maintenance`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } });
    expect([200, 500]).toContain(cron.status);
    const body = await cron.json();
    expect(body.failed ?? []).not.toContain("parent care");

    const list = await call("GET", "/care/messages", { token });
    expect(list.status).toBe(200);
    const m = list.data.messages.find((x: { automation: string }) => x.automation === "follow_up");
    expect(m).toMatchObject({ channel: "IN_APP", link: "/plan/caregiver-rules" });
    expect(list.data.unread).toBeGreaterThanOrEqual(1);

    expect((await call("POST", `/care/messages/${m.id}`, { token, body: { action: "click" } })).data).toMatchObject({ ok: true, link: "/plan/caregiver-rules" });
    expect((await call("POST", `/care/messages/${m.id}`, { token, body: { action: "click" } })).status).toBe(200);
    expect(await db.parentCareEvent.count({ where: { userId, type: "NOTIFICATION_CLICKED" } })).toBe(1);
    // Another parent can't touch it, or report events about it
    expect((await call("POST", `/care/messages/${m.id}`, { token: other, body: { action: "dismiss" } })).status).toBe(404);
    const ev = await call("POST", "/care/events", { token: other, body: { events: [{ eventId: "11111111-aaaa", type: "NOTIFICATION_OPENED", messageId: m.id }] } });
    expect(ev.data).toEqual({ recorded: 0, skipped: ["11111111-aaaa"] });
  });

  it("takes app-reported events once each, and refuses server-only types", async () => {
    const e = { eventId: "22222222-bbbb", type: "REPORT_VIEWED", month: "2026-09" };
    expect((await call("POST", "/care/events", { token, body: { events: [e, e] } })).data).toEqual({ recorded: 1, skipped: [] });
    expect((await call("POST", "/care/events", { token, body: { events: [{ eventId: "33333333-cccc", type: "PARENT_REACTIVATED" }] } })).status).toBe(400);
  });

  it("serves the monthly report", async () => {
    const r = await call("GET", "/care/report", { token });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ month: expect.stringMatching(/^\d{4}-\d{2}$/), completed: expect.any(Number), protectionChanges: expect.any(Number) });
    expect((await call("GET", "/care/report?month=2026-13", { token })).status).toBe(400);
  });

  it("an email's tracked link records the click and only ever opens an app page", async () => {
    const msg = await db.parentCareMessage.findFirstOrThrow({ where: { userId } });
    const res = await fetch(`${BASE}/api/care/open/${msg.token}`, { redirect: "manual" });
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe(msg.link.split("?")[0]);
    const bad = await fetch(`${BASE}/api/care/open/not-a-token`, { redirect: "manual" });
    expect(new URL(bad.headers.get("location")!).pathname).toBe("/plan");
  });

  it("keeps the console's parent-care pages behind staff sign-in", async () => {
    // fetch can't set Host; the console is told apart by it (console.localhost in development)
    const res = await new Promise<{ status: number; location: string }>((resolve, reject) => {
      const u = new URL(`${BASE}/care`);
      request({ host: u.hostname, port: u.port, path: u.pathname, headers: { host: `console.localhost:${u.port}` } }, (r) => {
        r.resume();
        resolve({ status: r.statusCode ?? 0, location: String(r.headers.location ?? "") });
      }).on("error", reject).end();
    });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.location).toMatch(/\/login$/);
    // Off the console host the console doesn't exist
    expect((await fetch(`${BASE}/console/care`, { redirect: "manual" })).status).toBe(404);
  });
});
