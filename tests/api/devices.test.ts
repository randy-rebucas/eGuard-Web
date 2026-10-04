import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PASSWORD, applyAndReport, call, cleanup, db, email, pairDevice } from "./helpers";

/**
 * A child's primary device and moving a device between children, against the real database: the lock-held
 * primary hand-over, what a move keeps and clears, and what the device sees on its next sync.
 */

let token = "";
let familyId = "";
let miaId = "";
let leoId = "";
let other = "";
let phone: Awaited<ReturnType<typeof pairDevice>>;
let tablet: Awaited<ReturnType<typeof pairDevice>>;

const primaries = async (childId: string) =>
  (await db.device.findMany({ where: { childId, isPrimary: true }, select: { id: true } })).map((d) => d.id);

afterAll(cleanup);

beforeAll(async () => {
  const r = await call("POST", "/auth/register", { body: { name: "Dina Reyes", email: email("dina"), password: PASSWORD, guardian: true } });
  token = r.data.token;
  familyId = r.data.user.family.id;
  // Pairing needs a verified email; two children and three devices need more than Free
  await db.user.update({ where: { id: r.data.user.id }, data: { emailVerifiedAt: new Date() } });
  await db.family.update({ where: { id: familyId }, data: { plan: "eGuard Plus", deviceLimit: 10 } });
  miaId = (await call("POST", "/children", { token, body: { name: "Mia", age: 9 } })).data.id;
  leoId = (await call("POST", "/children", { token, body: { name: "Leo", age: 15 } })).data.id;
  phone = await pairDevice(token, miaId, "ANDROID", "Mia's Phone");
  tablet = await pairDevice(token, miaId, "ANDROID", "Mia's Tablet");
  const o = await call("POST", "/auth/register", { body: { name: "Other Parent", email: email("other"), password: PASSWORD, guardian: true } });
  other = o.data.token;
});

describe("primary device", () => {
  it("the first device paired is primary, the second isn't", async () => {
    expect(await primaries(miaId)).toEqual([phone.deviceId]);
    expect((await call("GET", `/devices/${tablet.deviceId}`, { token })).data.isPrimary).toBe(false);
  });

  it("the parent makes another device primary; there's still only one", async () => {
    const r = await call("PATCH", `/devices/${tablet.deviceId}`, { token, body: { isPrimary: true } });
    expect(r.status).toBe(200);
    expect(r.data.isPrimary).toBe(true);
    expect(await primaries(miaId)).toEqual([tablet.deviceId]);
    expect(await db.auditLog.count({ where: { familyId, action: "device.primary" } })).toBe(1);
  });

  it("needs a name or isPrimary: true, and another family can't touch it", async () => {
    expect((await call("PATCH", `/devices/${phone.deviceId}`, { token, body: {} })).status).toBe(400);
    expect((await call("PATCH", `/devices/${phone.deviceId}`, { token, body: { isPrimary: false } })).status).toBe(400);
    expect((await call("PATCH", `/devices/${phone.deviceId}`, { token: other, body: { isPrimary: true } })).status).toBe(404);
  });

  it("renaming is audited", async () => {
    await call("PATCH", `/devices/${phone.deviceId}`, { token, body: { name: "Mia's Galaxy" } });
    expect(await db.auditLog.findFirst({ where: { familyId, action: "device.renamed" } })).toMatchObject({ detail: "Mia's Mia's Phone → Mia's Galaxy" });
  });
});

describe("moving a device to another child", () => {
  it("asks for the password, and refuses the child it already belongs to or another family's", async () => {
    expect((await call("POST", `/devices/${tablet.deviceId}/move`, { token, body: { childId: leoId, password: "nope" } })).status).toBe(403);
    expect((await call("POST", `/devices/${tablet.deviceId}/move`, { token, body: { childId: miaId, password: PASSWORD } })).status).toBe(400);
    const otherKid = (await call("POST", "/children", { token: other, body: { name: "Zed", age: 8 } })).data.id;
    expect((await call("POST", `/devices/${tablet.deviceId}/move`, { token, body: { childId: otherKid, password: PASSWORD } })).status).toBe(404);
    expect((await call("POST", `/devices/${tablet.deviceId}/move`, { token: other, body: { childId: otherKid, password: PASSWORD } })).status).toBe(404);
    expect((await db.device.findUniqueOrThrow({ where: { id: tablet.deviceId } })).childId).toBe(miaId);
  });

  it("moves the primary tablet: Leo gets it as primary, Mia's phone takes over, history stays with Mia", async () => {
    // Something the tablet recorded and reported for Mia
    await applyAndReport(tablet.send);
    const today = new Date().toISOString().slice(0, 10);
    await tablet.send("/usage", { date: today, totalMinutes: 30, apps: [{ name: "YouTube", minutes: 30 }] });
    expect(await db.deviceProtection.count({ where: { deviceId: tablet.deviceId } })).toBeGreaterThan(0);

    const r = await call("POST", `/devices/${tablet.deviceId}/move`, { token, body: { childId: leoId, password: PASSWORD } });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ childId: leoId, childName: "Leo", isPrimary: true, firstCheck: true });
    expect(await primaries(leoId)).toEqual([tablet.deviceId]);
    expect(await primaries(miaId)).toEqual([phone.deviceId]);
    // Mia keeps the 30 minutes; nothing of it is attributed to Leo
    expect((await db.screenTimeDaily.aggregate({ where: { childId: miaId }, _sum: { minutes: true } }))._sum.minutes).toBe(30);
    expect(await db.screenTimeDaily.count({ where: { childId: leoId } })).toBe(0);
    expect(await db.screenTimeDaily.count({ where: { deviceId: tablet.deviceId } })).toBe(0);
    expect(await db.deviceProtection.count({ where: { deviceId: tablet.deviceId } })).toBe(0);
    expect(await db.alert.findFirst({ where: { familyId, title: "Device moved" } })).toMatchObject({ childId: leoId, subject: "Leo's Mia's Tablet" });
    expect(await db.auditLog.findFirst({ where: { familyId, action: "device.moved" } })).toMatchObject({ detail: "Mia's Tablet: Mia → Leo" });
  });

  it("on its next sync the device is Leo's: his name, his policy, and a full report is asked for", async () => {
    const leoBedtime = (await call("GET", `/children/${leoId}/protections`, { token })).data.protections.find((p: { key: string }) => p.key === "BEDTIME").policy;
    const sync = await tablet.send("/sync");
    expect(sync.data.childName).toBe("Leo");
    expect(sync.data.fullReportRequested).toBe(true);
    expect(sync.data.policy.find((p: { key: string }) => p.key === "BEDTIME").config).toEqual(leoBedtime);
    // New usage starts a row under Leo, leaving Mia's alone
    const today = new Date().toISOString().slice(0, 10);
    await tablet.send("/usage", { date: today, totalMinutes: 45, apps: [] });
    expect((await db.screenTimeDaily.findFirstOrThrow({ where: { deviceId: tablet.deviceId } })).childId).toBe(leoId);
    expect((await db.screenTimeDaily.aggregate({ where: { childId: miaId }, _sum: { minutes: true } }))._sum.minutes).toBe(30);
  });

  it("after its report against Leo's settings, it's no longer waiting for a first check", async () => {
    await applyAndReport(tablet.send);
    expect((await call("GET", `/devices/${tablet.deviceId}`, { token })).data.firstCheck).toBe(false);
  });

  it("a device moved to a child who has a primary isn't primary there", async () => {
    const r = await call("POST", `/devices/${phone.deviceId}/move`, { token, body: { childId: leoId, password: PASSWORD } });
    expect(r.data.isPrimary).toBe(false);
    expect(await primaries(leoId)).toEqual([tablet.deviceId]);
    expect(await primaries(miaId)).toEqual([]); // Mia has no devices left
  });
});

describe("removing the primary device", () => {
  it("hands primary on to the child's oldest remaining device", async () => {
    // Leo now has the tablet (primary) and the phone, paired earlier than the tablet
    const r = await call("DELETE", `/devices/${tablet.deviceId}`, { token, body: { password: PASSWORD } });
    expect(r.status).toBe(200);
    expect(await primaries(leoId)).toEqual([phone.deviceId]);
  });
});
