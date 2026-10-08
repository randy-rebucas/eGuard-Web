import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, PASSWORD, call, childDevice, cleanup, db, email, inbox, inviteAndAccept, pairDevice, resetToken, verifyInbox } from "./helpers";

/**
 * Fixes from the security audit: password reset, sign-in lockout, account deletion, pairing races,
 * per-device app usage, device event abuse, the maintenance job and security headers.
 * Needs a server whose SMTP goes to Mailpit, and CRON_SECRET=test-cron-secret for the maintenance job.
 */

const CRON = process.env.CRON_SECRET ?? "test-cron-secret";
let token = "";
let familyId = "";
let childId = "";

afterAll(cleanup);

beforeAll(async () => {
  const r = await call("POST", "/auth/register", { body: { name: "Sam Reyes", email: email("sam"), password: PASSWORD, guardian: true } });
  token = r.data.token;
  familyId = r.data.user.family.id;
  // eGuard Plus: these tests pair more devices than Free covers
  await db.family.update({ where: { id: familyId }, data: { plan: "eGuard Plus", deviceLimit: 10 } });
  await verifyInbox(email("sam"));
  childId = (await call("POST", "/children", { token, body: { name: "Lia", age: 9 } })).data.id;
});

describe("forgot password", () => {
  it("answers the same whether or not the account exists", async () => {
    const known = await call("POST", "/auth/forgot-password", { body: { email: email("sam") } });
    const unknown = await call("POST", "/auth/forgot-password", { body: { email: email("nobody") } });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(Object.keys(known.data).sort()).toEqual(Object.keys(unknown.data).sort());
  });

  it("the emailed link sets a new password and signs out every session", async () => {
    const other = (await call("POST", "/auth/login", { body: { email: email("sam"), password: PASSWORD } })).data.token;
    const t = await resetToken(email("sam"));
    expect((await call("POST", "/auth/reset-password", { body: { token: t, password: "short" } })).status).toBe(400);
    const r = await call("POST", "/auth/reset-password", { body: { token: t, password: `${PASSWORD}-new` } });
    expect(r.status).toBe(200);
    expect(r.data.token).toBeTruthy();
    for (const old of [token, other]) expect((await call("GET", "/me", { token: old })).status).toBe(401);
    expect((await call("POST", "/auth/login", { body: { email: email("sam"), password: PASSWORD } })).status).toBe(401);
    token = (await call("POST", "/auth/login", { body: { email: email("sam"), password: `${PASSWORD}-new` } })).data.token;
    expect(token).toBeTruthy();
    // Single use
    expect((await call("POST", "/auth/reset-password", { body: { token: t, password: `${PASSWORD}-again` } })).data.code).toBe("link_invalid");
  });
});

describe("sign-in lockout", () => {
  it("locks an account after repeated wrong passwords, even with the right one, until a reset", async () => {
    const who = email("locked");
    const from = (n: number) => ({ "x-forwarded-for": `203.0.113.${n}` });
    const login = (password: string, headers?: Record<string, string>) => call("POST", "/auth/login", { body: { email: who, password }, headers });
    await call("POST", "/auth/register", { body: { name: "Lock Test", email: who, password: PASSWORD, guardian: true } });
    for (let i = 0; i < 10; i++) expect((await login(`wrong-${i}`)).status).toBe(401);
    const blocked = await login(PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.data.code).toBe("rate_limited");
    // 10 failures lock the account from that address only: someone else's guesses don't lock the parent out of their own phone
    expect((await login(PASSWORD, from(1))).status).toBe(200);
    // ...but 50 from anywhere lock it everywhere (guessing spread over many addresses)
    for (let n = 2; n <= 5; n++) for (let i = 0; i < 10; i++) expect((await login(`wrong-${n}-${i}`, from(n))).status).toBe(401);
    expect((await login(PASSWORD, from(9))).status).toBe(429);
    await call("POST", "/auth/forgot-password", { body: { email: who } });
    const r = await call("POST", "/auth/reset-password", { body: { token: await resetToken(who), password: PASSWORD } });
    expect(r.status).toBe(200);
    expect((await call("POST", "/auth/login", { body: { email: who, password: PASSWORD } })).status).toBe(200);
  });
});

describe("pairing", () => {
  it("a pairing code pairs exactly one device, even when two use it at once", async () => {
    const code = (await call("POST", `/children/${childId}/pairing-code`, { token })).data.code;
    const pair = (name: string) => call("POST", `${BASE}/api/device/v1/pair`, {
      body: { code, platform: "ANDROID", name, model: "Test", kind: "PHONE", osVersion: "Android 15" },
    });
    const results = await Promise.all([pair("Race A"), pair("Race B"), pair("Race C")]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400, 400]);
    expect(await db.device.count({ where: { childId, name: { startsWith: "Race" } } })).toBe(1);
  });
});

describe("app usage on two devices", () => {
  it("adds up minutes from the phone and the tablet instead of keeping the last report", async () => {
    const phone = await pairDevice(token, childId, "ANDROID", "Lia's Phone");
    const tablet = await pairDevice(token, childId, "ANDROID", "Lia's Tablet");
    // "Today" in the family's time zone (Asia/Manila by default), as the child app reports it
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    await phone.send("/usage", { date, totalMinutes: 40, apps: [{ name: "YouTube", minutes: 30 }] });
    await tablet.send("/usage", { date, totalMinutes: 25, apps: [{ name: "YouTube", minutes: 20 }] });
    // A later report from the same device replaces only that device's number
    await phone.send("/usage", { date, totalMinutes: 45, apps: [{ name: "YouTube", minutes: 35 }] });
    const rows = await db.appUsageDaily.findMany({ where: { childId, app: "YouTube" } });
    expect(rows.reduce((s, r) => s + r.minutes, 0)).toBe(55);
    await db.childApp.create({ data: { childId, name: "YouTube" } });
    const apps = await call("GET", `/children/${childId}/apps`, { token });
    expect(apps.data.apps.find((a: { name: string }) => a.name === "YouTube").todayMinutes).toBe(55);
  });
});

describe("device events", () => {
  let send: ReturnType<typeof childDevice>;
  beforeAll(async () => { send = (await pairDevice(token, childId, "IOS", "Lia's iPad")).send; });

  it("a request can't take back an app the parent allowed", async () => {
    await db.childApp.create({ data: { childId, name: "Khan Academy", approval: "ALLOWED" } });
    await send("/events", { type: "APP_REQUESTED", app: "Khan Academy" });
    expect((await db.childApp.findUnique({ where: { childId_name: { childId, name: "Khan Academy" } } }))!.approval).toBe("ALLOWED");
  });

  it("asking again and again raises one alert", async () => {
    for (let i = 0; i < 5; i++) await send("/events", { type: "APP_REQUESTED", app: "Roblox" });
    expect(await db.alert.count({ where: { familyId, title: "App approval requested", subject: { startsWith: "Roblox" } } })).toBe(1);
    for (let i = 0; i < 3; i++) await send("/events", { type: "APP_INSTALLED", app: "Minecraft" });
    expect(await db.alert.count({ where: { familyId, title: "New app installed", subject: { startsWith: "Minecraft" } } })).toBe(1);
  });
});

describe("maintenance job", () => {
  const cron = (auth?: string) => fetch(`${BASE}/api/cron/maintenance`, { method: "POST", headers: auth ? { authorization: auth } : {} });

  it("needs the cron secret", async () => {
    expect((await cron()).status).toBe(401);
    expect((await cron("Bearer wrong")).status).toBe(401);
  });

  it("raises offline alerts and emails parents about them without anyone opening the app", async () => {
    const d = await db.device.findFirstOrThrow({ where: { childId, name: "Lia's Phone" } });
    await db.device.update({ where: { id: d.id }, data: { lastSeenAt: new Date(Date.now() - 2 * 864e5) } });
    const r = await cron(`Bearer ${CRON}`);
    expect(r.status).toBe(200);
    expect(await db.alert.count({ where: { familyId, resolveKey: `OFFLINE:${d.id}`, resolvedAt: null } })).toBe(1);
    let mails: { subject: string }[] = [];
    for (let i = 0; i < 25 && !mails.some((m) => m.subject.includes("hasn't synced")); i++) {
      mails = await inbox(email("sam"));
      await new Promise((res) => setTimeout(res, 200));
    }
    expect(mails.some((m) => m.subject.includes("hasn't synced"))).toBe(true);
    // Once only
    const count = mails.filter((m) => m.subject.includes("hasn't synced")).length;
    await cron(`Bearer ${CRON}`);
    await new Promise((res) => setTimeout(res, 500));
    expect((await inbox(email("sam"))).filter((m) => m.subject.includes("hasn't synced")).length).toBe(count);
  });

  it("deletes activity older than the family's retention period", async () => {
    const d = await db.device.findFirstOrThrow({ where: { childId } });
    const old = new Date(Date.now() - 200 * 864e5);
    await db.screenTimeDaily.create({ data: { childId, deviceId: d.id, date: old, minutes: 10 } });
    await db.configChange.create({ data: { familyId, childId, key: "BEDTIME", title: "old", actor: "test", createdAt: old } });
    await cron(`Bearer ${CRON}`);
    expect(await db.screenTimeDaily.count({ where: { childId, date: old } })).toBe(0);
    expect(await db.configChange.count({ where: { familyId, title: "old" } })).toBe(0);
  });
});

describe("account", () => {
  it("lists linked sign-ins and says whether a password is set", async () => {
    expect((await call("GET", "/me/identities", { token })).data).toEqual({ identities: [] });
    expect((await call("GET", "/me", { token })).data).toMatchObject({ hasPassword: true, twoFactor: false });
  });

  it("a parent can delete their own account; the family stays", async () => {
    const { token: jo } = await inviteAndAccept(token, "Jo Reyes", email("jo"), PASSWORD);
    expect((await call("DELETE", "/me", { token: jo, body: { password: "wrong-one-here" } })).status).toBe(403);
    expect((await call("DELETE", "/me", { token: jo, body: { password: PASSWORD } })).data).toMatchObject({ ok: true, deleted: "account" });
    expect(await db.user.count({ where: { email: email("jo") } })).toBe(0);
    expect(await db.family.count({ where: { id: familyId } })).toBe(1);
  });

  it("the family admin deleting their account deletes the family and everything in it", async () => {
    const r = await call("DELETE", "/me", { token, body: { password: `${PASSWORD}-new` } });
    expect(r.data).toMatchObject({ ok: true, deleted: "family" });
    expect(await db.family.count({ where: { id: familyId } })).toBe(0);
    expect(await db.child.count({ where: { id: childId } })).toBe(0);
    expect((await call("GET", "/me", { token })).status).toBe(401);
  });
});

describe("security headers", () => {
  it("forbids framing and hides the framework", async () => {
    const r = await fetch(`${BASE}/login`);
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(r.headers.get("x-powered-by")).toBeNull();
  });
});
