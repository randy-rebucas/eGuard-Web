import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dayIn } from "@/lib/browser-health";
import { BASE, PASSWORD, call, cleanup, db, email, verifyInbox } from "./helpers";

/**
 * Browser health (/api/browser/v1/health): the extension's self-checks, drift against the child's current policy,
 * the alerts they raise and resolve, silence after a day, and the daily per-category counts (/events).
 */

let token = "";
let familyId = "";
let childId = "";
let access = "";
let installationId = "";

const ext = (path: string, o: { body?: unknown; token?: string } = {}) =>
  call(o.body === undefined ? "GET" : "POST", `${BASE}/api/browser/v1${path}`, { body: o.body, token: o.token, headers: { "x-eguard-client": "chrome-extension" } });

type Status = "PASS" | "WARNING" | "ACTION_REQUIRED" | "UNSUPPORTED" | "NOT_CONFIGURED";
const ALL_PASS: Record<string, Status> = {
  policy_signature: "PASS", rules_installed: "PASS", private_windows: "PASS", sync_fresh: "PASS", safe_browsing: "PASS", force_installed: "NOT_CONFIGURED",
};
const report = (version: number | null, patch: Record<string, Status> = {}, state = "PROTECTED") =>
  ext("/health", { token: access, body: { state, policyVersion: version, checks: Object.entries({ ...ALL_PASS, ...patch }).map(([id, status]) => ({ id, status })) } });
const openAlert = (key: string) => db.alert.findFirst({ where: { familyId, resolveKey: `${key}:${installationId}`, resolvedAt: null } });
const currentVersion = async () => (await ext("/policy", { token: access })).data.policy.version as number;

afterAll(cleanup);

beforeAll(async () => {
  const r = await call("POST", "/auth/register", { body: { name: "Nora Diaz", email: email("nora"), password: PASSWORD, guardian: true } });
  token = r.data.token;
  familyId = r.data.user.family.id;
  await verifyInbox(email("nora"));
  childId = (await call("POST", "/children", { token, body: { name: "Ben", age: 9 } })).data.id;
  const code = (await call("POST", `/children/${childId}/pairing-code`, { token, body: { kind: "BROWSER", deviceLabel: "Ben's Laptop" } })).data.code;
  const paired = (await ext("/pair", { body: { code, browser: "Chrome", browserVersion: "153", extensionVersion: "0.1.0", platform: "win" } })).data;
  access = paired.accessToken;
  installationId = paired.installationId;
});

describe("health reports", () => {
  it("are stored with a score that leaves out checks that don't apply", async () => {
    const v = await currentVersion();
    const r = await report(v);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(r.data).toEqual({ ok: true, score: 5, total: 5 });

    const inst = await db.browserInstallation.findUniqueOrThrow({ where: { id: installationId } });
    expect(inst).toMatchObject({ protectionState: "PROTECTED", appliedPolicyVersion: v, lastHealthAt: expect.any(Date) });
    const row = await db.browserHealthCheck.findFirstOrThrow({ where: { installationId }, orderBy: { createdAt: "desc" } });
    expect(row).toMatchObject({ state: "PROTECTED", policyVersion: v, score: 5, total: 5 });
    expect(row.checks).toHaveLength(6);
  });

  it("drop check ids this server doesn't know, and refuse malformed reports", async () => {
    const v = await currentVersion();
    const r = await ext("/health", { token: access, body: { state: "PROTECTED", policyVersion: v, checks: [{ id: "from_the_future", status: "PASS" }, { id: "rules_installed", status: "PASS" }] } });
    expect(r.data).toEqual({ ok: true, score: 1, total: 1 });
    expect((await ext("/health", { token: access, body: { state: "FINE", policyVersion: v, checks: [] } })).status).toBe(400);
    expect((await ext("/health", { token: access, body: { state: "PROTECTED", policyVersion: v, checks: [{ id: "rules_installed", status: "GREAT" }] } })).status).toBe(400);
  });

  it("need a connected browser", async () => {
    expect((await ext("/health", { body: { state: "PROTECTED", policyVersion: 1, checks: [] } })).status).toBe(401);
  });
});

describe("drift", () => {
  it("rules that aren't in place alert the family at once, and a good report resolves it", async () => {
    const v = await currentVersion();
    await report(v, { rules_installed: "ACTION_REQUIRED" }, "NEEDS_ATTENTION");
    const alert = await openAlert("BROWSER_DRIFT");
    expect(alert).toMatchObject({ title: "Browser protection changed", severity: "ATTENTION", category: "PROTECTION", subject: "Ben's Chrome on Ben's Laptop" });
    expect(alert?.body).toContain("website rules");
    // Raised once while it lasts
    await report(v, { rules_installed: "ACTION_REQUIRED" }, "NEEDS_ATTENTION");
    expect(await db.alert.count({ where: { familyId, resolveKey: `BROWSER_DRIFT:${installationId}` } })).toBe(1);

    await report(v);
    expect(await openAlert("BROWSER_DRIFT")).toBeNull();
  });

  it("an older policy version is a change in flight at first, and drift once the grace period is over", async () => {
    const v = await currentVersion();
    await db.browserPolicy.update({ where: { childId }, data: { version: { increment: 1 } } });
    await report(v);
    expect(await openAlert("BROWSER_DRIFT")).toBeNull();

    await db.$executeRaw`UPDATE "BrowserPolicy" SET "updatedAt" = now() - interval '1 hour' WHERE "childId" = ${childId}`;
    await report(v);
    const alert = await openAlert("BROWSER_DRIFT");
    expect(alert?.body).toBe(`Chrome on Ben's Laptop is still using older browser settings (version ${v}, latest ${v + 1}).`);

    await report(v + 1);
    expect(await openAlert("BROWSER_DRIFT")).toBeNull();
    expect((await db.browserInstallation.findUniqueOrThrow({ where: { id: installationId } })).appliedPolicyVersion).toBe(v + 1);
  });
});

describe("other alerts", () => {
  it("private windows not allowed, until they are", async () => {
    const v = await currentVersion();
    await report(v, { private_windows: "WARNING" }, "NEEDS_ATTENTION");
    expect(await openAlert("BROWSER_PRIVATE")).toMatchObject({ title: "Private windows aren't protected" });
    // A browser that can't tell leaves it as it is
    await report(v, { private_windows: "UNSUPPORTED" });
    expect(await openAlert("BROWSER_PRIVATE")).not.toBeNull();
    await report(v);
    expect(await openAlert("BROWSER_PRIVATE")).toBeNull();
  });

  it("Safe Browsing turned off by something eGuard can't override", async () => {
    const v = await currentVersion();
    await report(v, { safe_browsing: "ACTION_REQUIRED" }, "NEEDS_ATTENTION");
    expect(await openAlert("BROWSER_SAFE_BROWSING")).toMatchObject({ title: "Malware and phishing protection is off" });
    // Parent turned the setting off in eGuard: nothing to fix any more
    await report(v, { safe_browsing: "NOT_CONFIGURED" });
    expect(await openAlert("BROWSER_SAFE_BROWSING")).toBeNull();
  });

  it("a browser silent for a day gets one alert from the maintenance job, resolved when it checks in", async () => {
    await db.browserInstallation.update({ where: { id: installationId }, data: { lastSeenAt: new Date(Date.now() - 25 * 3600_000) } });
    const cron = () => call("POST", `${BASE}/api/cron/maintenance`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "test-cron-secret"}` } });
    expect((await cron()).status).toBe(200);
    await cron();
    const alerts = await db.alert.findMany({ where: { familyId, resolveKey: `BROWSER_OFFLINE:${installationId}` } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ title: "eGuard can't verify this browser", category: "DEVICES", resolvedAt: null });

    await ext("/policy", { token: access }); // any check-in
    expect(await openAlert("BROWSER_OFFLINE")).toBeNull();
  });
});

describe("daily counts", () => {
  const today = () => dayIn("Asia/Manila");
  const send = (body: unknown) => ext("/events", { token: access, body });

  it("stores counts per category for a day, and a resend replaces them", async () => {
    const date = today();
    expect((await send({ date, blocked: { GAMING: 3, ADULT: 1, BLOCKED_SITE: 2 } })).data).toEqual({ ok: true, date, categories: 3 });
    expect((await send({ date, blocked: { GAMING: 4, ADULT: 0 } })).status).toBe(200);
    const rows = await db.browserEventDaily.findMany({ where: { installationId }, orderBy: { category: "asc" } });
    expect(rows.map((r) => [r.date.toISOString().slice(0, 10), r.category, r.blockedCount])).toEqual([[date, "GAMING", 4]]);
  });

  it("accepts only category keys and counts, for the last two weeks", async () => {
    expect((await send({ date: today(), blocked: { "roblox.com": 1 } })).status).toBe(400);
    expect((await send({ date: today(), blocked: { GAMING: -1 } })).status).toBe(400);
    expect((await send({ date: "2026-02-30", blocked: { GAMING: 1 } })).data.code).toBe("invalid_date");
    expect((await send({ date: "2020-01-01", blocked: { GAMING: 1 } })).data.code).toBe("invalid_date");
    expect((await send({ date: "2999-01-01", blocked: { GAMING: 1 } })).data.code).toBe("invalid_date");
    expect((await ext("/events", { body: { date: today(), blocked: {} } })).status).toBe(401);
  });
});

describe("removing the browser", () => {
  it("resolves its open alerts and deletes its reports", async () => {
    const v = await currentVersion();
    await report(v, { private_windows: "WARNING" }, "NEEDS_ATTENTION");
    expect((await call("DELETE", `/browsers/${installationId}`, { token, body: { password: PASSWORD } })).status).toBe(200);
    expect(await openAlert("BROWSER_PRIVATE")).toBeNull();
    expect(await db.browserHealthCheck.count({ where: { installationId } })).toBe(0);
    expect(await db.browserEventDaily.count({ where: { installationId } })).toBe(0);
  });
});
