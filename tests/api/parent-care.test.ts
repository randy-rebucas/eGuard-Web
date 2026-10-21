import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

// Captures every email instead of sending it; `fail` makes the next sends throw like a provider outage
const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string; headers?: Record<string, string> }[], fail: 0 }));
vi.mock("@/lib/mail", async (orig) => ({
  ...(await orig<typeof import("@/lib/mail")>()),
  sendMail: async (m: { to: string; subject: string; text: string; headers?: Record<string, string> }) => {
    if (mail.fail > 0) { mail.fail--; throw new Error("fetch failed"); }
    mail.sent.push(m);
  },
}));
// No real push in tests: FCM off, whatever .env says
vi.mock("@/lib/push", async (orig) => ({ ...(await orig<typeof import("@/lib/push")>()), pushConfig: () => null, pushAvailable: () => false }));

import { claimDue, releaseStale } from "@/lib/parent-care/queue";
import { loadContext, planUser, processJob, syncAutomations } from "@/lib/parent-care/runner";
import { noteActivity, recordEvents } from "@/lib/parent-care/events";
import * as care from "@/lib/parent-care/service";
import { optOutByToken } from "@/lib/parent-care/optout";
import * as metrics from "@/lib/parent-care/metrics";

/** The parent-care engine (src/lib/parent-care) against the real database, at fixed times. */

const db = new PrismaClient();
const RUN = `c${Date.now().toString(36)}`;
const DOMAIN = `${RUN}@care-test.example`;
let familyId = "";
const users: Record<string, { id: string; familyId: string }> = {};
// Wednesday 2026-10-21, noon in Manila
const NOON = new Date("2026-10-21T04:00:00Z");
const HOUR = 3600_000;

async function parent(name: string, prefs: Record<string, unknown> = {}) {
  const u = await db.user.create({ data: { familyId, name: `${name} Reyes`, email: `${name.toLowerCase()}.${DOMAIN}`, passwordHash: "x", role: "PARENT", emailVerifiedAt: new Date() } });
  // Only what each test turns on: time-based automations would otherwise add their own messages
  await db.parentCarePreference.create({ data: { userId: u.id, cohort: "TREATMENT", briefings: false, weeklyPlan: false, monthlyReport: false, checkIns: false, ...prefs } });
  users[name] = { id: u.id, familyId };
  return users[name];
}

/** Delivers every due job, as the cron would at `now` */
async function runJobs(now: Date) {
  const enabled = await syncAutomations();
  const outcomes: string[] = [];
  for (let batch = await claimDue(50, now); batch.length; batch = await claimDue(50, now)) {
    for (const j of batch) outcomes.push(await processJob(j, enabled, now));
  }
  return outcomes;
}

const ours = () => mail.sent.filter((m) => m.to.endsWith(DOMAIN));
const jobsOf = (userId: string) => db.parentCareJob.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

beforeAll(async () => {
  const f = await db.family.create({ data: { name: `Care ${RUN}`, timezone: "Asia/Manila" } });
  familyId = f.id;
  await db.child.create({ data: { familyId, name: "Mia", birthYear: 2016 } });
  await syncAutomations();
  await db.parentCareAutomation.updateMany({ data: { enabled: true } });
});

beforeEach(() => { mail.sent.length = 0; mail.fail = 0; });

afterAll(async () => {
  await db.family.deleteMany({ where: { id: familyId } });
  await db.$disconnect();
});

describe("parent care: activity follow-up", () => {
  it("schedules one follow-up when an activity starts, and cancels it when it's completed", async () => {
    const a = await parent("Ana");
    await care.startActivity(a, "family-media-plan", NOON);
    let jobs = await jobsOf(a.id);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ automationKey: "follow_up", status: "PENDING" });
    expect(jobs[0].runAt.toISOString()).toBe(new Date(NOON.getTime() + 24 * HOUR).toISOString());
    // Starting again doesn't add a second reminder
    await care.startActivity(a, "family-media-plan", new Date(NOON.getTime() + HOUR));
    expect(await jobsOf(a.id)).toHaveLength(1);

    await care.completeActivity(a, "family-media-plan", new Date(NOON.getTime() + 2 * HOUR));
    jobs = await jobsOf(a.id);
    expect(jobs[0]).toMatchObject({ status: "CANCELLED", lastError: "activity_completed" });
    await runJobs(new Date(NOON.getTime() + 25 * HOUR));
    expect(await db.parentCareMessage.count({ where: { userId: a.id } })).toBe(0);
    const types = (await db.parentCareEvent.findMany({ where: { userId: a.id }, select: { type: true } })).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["ACTIVITY_STARTED", "ACTIVITY_COMPLETED", "NOTIFICATION_SCHEDULED", "NOTIFICATION_CANCELLED", "QUALIFYING_ACTIVITY"]));
  });

  it("rechecks the activity, then delivers in-app when push and email aren't allowed", async () => {
    const b = await parent("Ben");
    await care.startActivity(b, "caregiver-rules", NOON);
    expect(await runJobs(new Date(NOON.getTime() + 23 * HOUR))).toEqual([]);
    expect(await runJobs(new Date(NOON.getTime() + 24 * HOUR + 60_000))).toEqual(["done"]);
    const [m] = await db.parentCareMessage.findMany({ where: { userId: b.id } });
    expect(m).toMatchObject({ channel: "IN_APP", status: "DELIVERED", automationKey: "follow_up", link: "/plan/caregiver-rules" });
    expect(ours()).toHaveLength(0);
    // Shown on the Safety plan, rendered from its ids (no text stored)
    const inbox = await care.careMessages(b);
    expect(inbox.messages[0]).toMatchObject({ title: 'Ready to finish "Share the screen rules with lolo, lola or yaya"?', link: "/plan/caregiver-rules" });
    expect(inbox.unread).toBe(1);
    await care.markMessage(b, m.id, "click");
    expect((await db.parentCareMessage.findUniqueOrThrow({ where: { id: m.id } })).clickedAt).not.toBeNull();
  });
});

describe("parent care: email delivery", () => {
  it("sends by email only with consent, once, with a tracked link and one-click opt-out", async () => {
    const c = await parent("Cy");
    // Turning email on through the service records consent
    await care.updateCarePreferences(c, { email: true, weeklyPlan: true });
    const pref = await db.parentCarePreference.findUniqueOrThrow({ where: { userId: c.id } });
    expect(pref.emailConsentAt).not.toBeNull();

    // Monday 2026-10-26 at 7:30 PM Manila; planned the evening before
    const sunday = new Date("2026-10-25T10:00:00Z");
    expect(await planUser((await loadContext(c.id, sunday))!, await syncAutomations(), sunday)).toBe(1);
    expect(await planUser((await loadContext(c.id, sunday))!, await syncAutomations(), sunday)).toBe(0);
    const at = new Date("2026-10-26T11:31:00Z");
    expect(await runJobs(at)).toEqual(["done"]);
    expect(ours()).toHaveLength(1);
    expect(ours()[0].subject).toBe("Your family safety plan for this week");
    const m = await db.parentCareMessage.findFirstOrThrow({ where: { userId: c.id } });
    expect(m).toMatchObject({ channel: "EMAIL", status: "ACCEPTED" });
    expect(ours()[0].text).toContain(`/api/care/open/${m.token}`);
    expect(ours()[0].headers?.["List-Unsubscribe"]).toContain(`t=${m.token}`);
    expect((await db.parentCarePlan.findFirstOrThrow({ where: { userId: c.id } })).deliveredAt).not.toBeNull();
    // Running again sends nothing more
    expect(await runJobs(new Date(at.getTime() + HOUR))).toEqual([]);
    expect(ours()).toHaveLength(1);

    // The email's opt-out link turns care email off and records it
    expect(await optOutByToken(m.token)).toBe("care");
    const after = await db.parentCarePreference.findUniqueOrThrow({ where: { userId: c.id } });
    expect(after).toMatchObject({ email: false, emailConsentAt: null });
    expect(await db.parentCareSuppression.count({ where: { userId: c.id, scope: "CHANNEL:EMAIL", reason: "OPT_OUT" } })).toBe(1);
    expect(await db.parentCareEvent.count({ where: { userId: c.id, type: "NOTIFICATION_OPTED_OUT" } })).toBe(1);
  });

  it("retries a provider failure with backoff and delivers exactly once", async () => {
    const d = await parent("Dee", { email: true, emailConsentAt: new Date(), weeklyPlan: true });
    const sunday = new Date("2026-10-25T10:00:00Z");
    await planUser((await loadContext(d.id, sunday))!, await syncAutomations(), sunday);
    mail.fail = 1;
    const at = new Date("2026-10-26T11:31:00Z");
    expect(await runJobs(at)).toEqual(["retry"]);
    const [job] = await jobsOf(d.id);
    expect(job).toMatchObject({ status: "PENDING", attempts: 1, lastError: "provider_unavailable" });
    expect(job.runAt.getTime()).toBeGreaterThan(at.getTime() + 3 * 60_000);
    expect((await db.parentCareMessage.findFirstOrThrow({ where: { userId: d.id } })).status).toBe("FAILED");

    expect(await runJobs(new Date(job.runAt.getTime() + 1000))).toEqual(["done"]);
    expect(ours().filter((m) => m.to.startsWith("dee."))).toHaveLength(1);
    const msgs = await db.parentCareMessage.findMany({ where: { userId: d.id } });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].status).toBe("ACCEPTED");
    expect(await db.parentCareEvent.count({ where: { userId: d.id, type: "NOTIFICATION_FAILED" } })).toBe(1);
  });

  it("never sends again after a send was interrupted mid-way (a restart)", async () => {
    const e = await parent("Eve", { email: true, emailConsentAt: new Date(), weeklyPlan: true });
    const sunday = new Date("2026-10-25T10:00:00Z");
    await planUser((await loadContext(e.id, sunday))!, await syncAutomations(), sunday);
    const [job] = await jobsOf(e.id);
    // As if a worker claimed it, wrote its message and died before hearing back from the provider
    await db.parentCareJob.update({ where: { id: job.id }, data: { status: "RUNNING", lockedAt: new Date("2026-10-26T11:31:00Z"), attempts: 1 } });
    await db.parentCareMessage.create({ data: { userId: e.id, automationKey: "weekly_plan", jobId: job.id, dedupeKey: job.idempotencyKey, channel: "EMAIL", templateKey: "weekly_plan", templateVersion: 1, language: "en", link: "/plan", token: `t-${RUN}-eve`, status: "SENDING" } });
    expect(await releaseStale(new Date("2026-10-26T11:45:00Z"))).toEqual({ retried: 1, dead: 0 });
    expect(await runJobs(new Date("2026-10-26T11:46:00Z"))).toEqual(["duplicate"]);
    expect(ours().filter((m) => m.to.startsWith("eve."))).toHaveLength(0);
    expect((await db.parentCareMessage.findFirstOrThrow({ where: { userId: e.id } })).status).toBe("UNCERTAIN");
    expect(await db.parentCareEvent.count({ where: { userId: e.id, type: "DUPLICATE_BLOCKED" } })).toBe(1);
  });
});

describe("parent care: opting out and pausing", () => {
  it("cancels pending messages when the parent turns tips and reminders off", async () => {
    const f = await parent("Fay");
    await care.startActivity(f, "family-media-plan", NOON);
    await care.updateCarePreferences(f, { enabled: false });
    expect((await jobsOf(f.id))[0]).toMatchObject({ status: "CANCELLED", lastError: "care_off" });
    expect(await db.parentCareEvent.count({ where: { userId: f.id, type: "NOTIFICATION_OPTED_OUT" } })).toBe(1);
  });

  it("skips a due job once the parent has opted out, even if it was already queued", async () => {
    const g = await parent("Gil");
    await care.startActivity(g, "family-media-plan", NOON);
    await db.parentCareSuppression.create({ data: { userId: g.id, scope: "ALL", reason: "OPT_OUT" } });
    expect(await runJobs(new Date(NOON.getTime() + 25 * HOUR))).toEqual(["skipped"]);
    expect((await jobsOf(g.id))[0]).toMatchObject({ status: "SKIPPED", lastError: "opted_out" });
    expect(await db.parentCareMessage.count({ where: { userId: g.id } })).toBe(0);
  });

  it("sends nothing from a paused automation", async () => {
    const h = await parent("Hal");
    await care.startActivity(h, "family-media-plan", NOON);
    await db.parentCareAutomation.update({ where: { key: "follow_up" }, data: { enabled: false } });
    try {
      expect(await runJobs(new Date(NOON.getTime() + 25 * HOUR))).toEqual(["skipped"]);
      expect((await jobsOf(h.id))[0]).toMatchObject({ status: "SKIPPED", lastError: "automation_paused" });
    } finally {
      await db.parentCareAutomation.update({ where: { key: "follow_up" }, data: { enabled: true } });
    }
  });

  it("holds push and email during quiet hours without spending an attempt", async () => {
    const q = await parent("Quin", { email: true, emailConsentAt: new Date(), quietStart: 18 * 60, quietEnd: 21 * 60, weeklyPlan: true });
    const sunday = new Date("2026-10-25T10:00:00Z");
    await planUser((await loadContext(q.id, sunday))!, await syncAutomations(), sunday);
    // 7:31 PM Manila is inside 6–9 PM quiet hours
    expect(await runJobs(new Date("2026-10-26T11:31:00Z"))).toEqual(["deferred"]);
    const [job] = await jobsOf(q.id);
    expect(job).toMatchObject({ status: "PENDING", attempts: 0, lastError: "quiet_hours" });
    expect(job.runAt.toISOString()).toBe("2026-10-26T13:00:00.000Z");
  });
});

describe("parent care: inactive parents", () => {
  // Last action: Tue 2026-10-14 08:00 UTC. Day 7 is Tue 10-21, sent at 7:30 PM Manila (11:30 UTC)
  const LAST = new Date("2026-10-14T08:00:00Z");
  const DAY7_PLAN = new Date("2026-10-21T10:00:00Z");

  it("enrolls after 7 days, sends the day-7 message, and stops the moment the parent returns", async () => {
    const i = await parent("Ivy", { email: true, emailConsentAt: new Date(), checkIns: true, lastQualifyingAt: LAST });
    expect(await planUser((await loadContext(i.id, DAY7_PLAN))!, await syncAutomations(), DAY7_PLAN)).toBe(1);
    const enrollment = await db.parentCareEnrollment.findFirstOrThrow({ where: { userId: i.id } });
    expect(enrollment).toMatchObject({ automationKey: "check_in", status: "ACTIVE", subjectKey: LAST.toISOString() });

    expect(await runJobs(new Date("2026-10-21T11:31:00Z"))).toEqual(["done"]);
    expect(ours().filter((m) => m.to.startsWith("ivy."))).toHaveLength(1);
    expect((await db.parentCareEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).step).toBe(1);

    // Day 14's step is planned, still inactive
    const day14 = new Date("2026-10-28T10:00:00Z");
    expect(await planUser((await loadContext(i.id, day14))!, await syncAutomations(), day14)).toBe(1);
    // Back: a protection change on day 15, before the day-14 message went
    await noteActivity(i, "protection_change", new Date("2026-10-28T11:00:00Z"));
    const jobs = await jobsOf(i.id);
    expect(jobs.map((j) => [j.step, j.status])).toEqual([[0, "DONE"], [1, "CANCELLED"]]);
    expect(await db.parentCareEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).toMatchObject({ status: "EXITED", exitReason: "returned" });
    const back = await db.parentCareEvent.findFirstOrThrow({ where: { userId: i.id, type: "PARENT_REACTIVATED" } });
    expect(back.meta).toMatchObject({ kind: "protection_change", inactiveDays: 14, enrolled: true, messagesBefore: 1, cohort: "TREATMENT" });
    // The queue is shared with the other tests: only Ivy's messages matter here
    await runJobs(new Date("2026-10-28T11:31:00Z"));
    expect(await db.parentCareMessage.count({ where: { userId: i.id } })).toBe(1);
    expect(ours().filter((m) => m.to.startsWith("ivy."))).toHaveLength(1);
  });

  it("rechecks inactivity before sending: a return the engine wasn't told about directly still stops it", async () => {
    const j = await parent("Jo", { email: true, emailConsentAt: new Date(), checkIns: true, lastQualifyingAt: LAST });
    await planUser((await loadContext(j.id, DAY7_PLAN))!, await syncAutomations(), DAY7_PLAN);
    await db.parentCarePreference.update({ where: { userId: j.id }, data: { lastQualifyingAt: new Date("2026-10-21T11:00:00Z") } });
    expect(await runJobs(new Date("2026-10-21T11:31:00Z"))).toEqual(["skipped"]);
    expect((await jobsOf(j.id))[0].lastError).toBe("returned");
    expect((await db.parentCareEnrollment.findFirstOrThrow({ where: { userId: j.id } })).status).toBe("EXITED");
  });

  it("measures holdout parents without messaging them", async () => {
    const k = await parent("Kai", { email: true, emailConsentAt: new Date(), checkIns: true, lastQualifyingAt: LAST, cohort: "HOLDOUT" });
    expect(await planUser((await loadContext(k.id, DAY7_PLAN))!, await syncAutomations(), DAY7_PLAN)).toBe(0);
    expect((await db.parentCareEnrollment.findFirstOrThrow({ where: { userId: k.id } })).status).toBe("HOLDOUT");
    expect(await db.parentCareEvent.count({ where: { userId: k.id, type: "AUTOMATION_ELIGIBLE" } })).toBe(1);
    await noteActivity(k, "app_decision", new Date("2026-10-22T00:00:00Z"));
    expect((await db.parentCareEvent.findFirstOrThrow({ where: { userId: k.id, type: "PARENT_REACTIVATED" } })).meta).toMatchObject({ cohort: "HOLDOUT", enrolled: false });
    // Still marked holdout, so the reactivation rate keeps counting it in the comparison group
    expect(await db.parentCareEnrollment.findFirstOrThrow({ where: { userId: k.id } })).toMatchObject({ status: "HOLDOUT", exitReason: "returned", completedAt: expect.any(Date) });
  });
});

describe("parent care: records", () => {
  it("drops a repeated event id", async () => {
    const l = await parent("Lea");
    const e = { userId: l.id, familyId, type: "PLAN_OPENED" as const, eventId: `dup-${RUN}` };
    expect(await recordEvents([e, e])).toBe(1);
    expect(await recordEvents([e])).toBe(0);
  });

  it("builds the monthly report from real records only", async () => {
    const m = await parent("Max");
    await db.user.update({ where: { id: m.id }, data: { createdAt: new Date("2026-08-01T00:00:00Z") } });
    await care.completeActivity(m, "family-media-plan", new Date("2026-09-10T04:00:00Z"));
    await care.startActivity(m, "caregiver-rules", new Date("2026-09-12T04:00:00Z"));
    const r = await care.careReport(m, "2026-09", new Date("2026-10-02T04:00:00Z"));
    expect(r).toMatchObject({ month: "2026-09", completed: 1, started: 1, joinedAfter: false });
    expect(r.activities.map((a) => a.key)).toEqual(["family-media-plan"]);
    expect(r.nextStep).not.toBeNull();
    await expect(care.careReport(m, "2099-01", new Date("2026-10-02T04:00:00Z"))).rejects.toThrow(/month that has started/);
  });

  it("keeps a parent's operations to their own rows", async () => {
    const n = await parent("Ned");
    const o = await parent("Oli");
    await care.startActivity(o, "caregiver-rules", NOON);
    await runJobs(new Date(NOON.getTime() + 25 * HOUR));
    const msg = await db.parentCareMessage.findFirstOrThrow({ where: { userId: o.id } });
    await expect(care.markMessage(n, msg.id, "click")).rejects.toThrow(/not found/);
    expect((await care.careMessages(n)).messages).toHaveLength(0);
  });
});

describe("parent care: console metrics", () => {
  it("runs every aggregate query, with rates that name their denominators", async () => {
    const o = await metrics.engagementOverview();
    expect(o.weeklyActiveFamilies).toEqual(expect.any(Number));
    for (const r of [o.retention7, o.retention30]) expect(r.TREATMENT).toMatchObject({ n: expect.any(Number), of: expect.any(Number) });
    expect(o.reactivation.HOLDOUT.of).toEqual(expect.any(Number));
    expect(o.channels.map((c) => c.channel)).toEqual(["PUSH", "EMAIL", "IN_APP"]);
    expect(o.channels.find((c) => c.channel === "EMAIL")!.sent).toBeGreaterThanOrEqual(0);

    const a = await metrics.automationStats(new Date("2026-10-30T00:00:00Z"));
    expect(a.map((x) => x.def.key)).toEqual(["briefing", "follow_up", "weekly_plan", "check_in", "monthly_report"]);
    expect(a.find((x) => x.def.key === "weekly_plan")!.sent30).toBeGreaterThanOrEqual(2);
    expect(a.find((x) => x.def.key === "check_in")!.enrollments.HOLDOUT).toBeGreaterThanOrEqual(1);

    const d = await metrics.deliveryOps(new Date("2026-10-30T00:00:00Z"));
    expect(d.duplicatesBlocked).toBeGreaterThanOrEqual(1);
    expect(d.uncertain).toBeGreaterThanOrEqual(1);
    expect(d.reliability.of).toBeGreaterThanOrEqual(1);
    expect(d.providerErrors.some((e) => e.code === "provider_unavailable")).toBe(false); // the failed message was re-sent: it's ACCEPTED now

    expect((await metrics.outcomeReasons()).some((r) => r.reason === "opted_out")).toBe(true);
    expect(await metrics.failedJobs()).toMatchObject({ rows: expect.any(Array) });
    const t = await metrics.trustOverview();
    expect(t.templates.find((x) => x.key === "briefing")!.languages).toEqual([{ lang: "en", approval: "APPROVED" }, { lang: "fil", approval: "PENDING_REVIEW" }]);
    expect(t.prefs.emailConsent).toBeGreaterThanOrEqual(1);
    expect(await metrics.careAudit()).toEqual(expect.any(Array));
  });
});
