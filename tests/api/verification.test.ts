import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword, issueSession, newToken, sha256 } from "@/lib/auth";
import { processReport } from "@/lib/engine";
import { requestConfigs, type Actor } from "@/lib/config-service";
import { createChild, createPairingCode, pairingCodeStatus, removeDevice, setAppApproval } from "@/lib/family-service";
import { childLocation, recordLocation, visitsPage } from "@/lib/location";
import { limitOn } from "@/lib/queries";
import { ServiceError } from "@/lib/errors";
import { POST as deviceEvent } from "@/app/api/device/v1/events/route";
import { POST as pairDevice } from "@/app/api/device/v1/pair/route";
import { GET as listApps } from "@/app/api/mobile/v1/children/[id]/apps/route";

/**
 * What parents are told about their children's devices: tamper alerts while a change is in flight, and a
 * child's requests for blocked apps. Calls the engine and route handlers directly, against the real database.
 */

const db = new PrismaClient();
const RUN = `v${Date.now().toString(36)}`;
let admin: Actor;
let childId = "";
let parentToken = "";

async function device(name: string) {
  const token = newToken();
  const d = await db.device.create({
    data: { familyId: admin.familyId, childId, name, model: "Test", platform: "ANDROID", osVersion: "Android 15", tokenHash: sha256(token), lastSeenAt: new Date() },
  });
  const event = (body: unknown) => deviceEvent(new Request("http://test/api/device/v1/events", {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { id: d.id, event };
}

const apps = async (filter: string) => {
  const res = await listApps(
    new Request(`http://test/api/mobile/v1/children/${childId}/apps?filter=${filter}`, { headers: { authorization: `Bearer ${parentToken}` } }),
    { params: Promise.resolve({ id: childId }) },
  );
  return (await res.json()) as { counts: { pending: number }; apps: { id: string; name: string; approval: string; requested: boolean }[] };
};

const PASSWORD = "CorrectHorse123!";

beforeAll(async () => {
  // eGuard Plus: these tests pair more devices than Free covers and need location sharing
  const f = await db.family.create({
    data: { name: "Reyes", plan: "eGuard Plus", deviceLimit: 10, users: { create: {
      name: "Sam Reyes", email: `sam.${RUN}@verification-test.example`, passwordHash: await hashPassword(PASSWORD), role: "FAMILY_ADMIN", emailVerifiedAt: new Date(),
    } } },
    include: { users: true },
  });
  const u = f.users[0];
  admin = { id: u.id, name: u.name, familyId: f.id, role: u.role };
  childId = (await createChild(admin, { name: "Lia", birthYear: new Date().getFullYear() - 11 })).id;
  parentToken = (await issueSession(u.id, null)).token;
});
afterAll(async () => {
  await db.family.deleteMany({ where: { users: { some: { email: { endsWith: `.${RUN}@verification-test.example` } } } } });
  await db.$disconnect();
});

describe("tampering while a parent's change is in flight", () => {
  it("a fresh change holds back the tamper alert, but an old open request doesn't silence it", async () => {
    const phone = await device("Lia's Phone");
    const policy = await db.childPolicy.findUniqueOrThrow({ where: { childId_key: { childId, key: "SCREEN_TIME" } } });
    const original = { ...(policy.config as Record<string, unknown>) };
    delete original.key;
    const report = (config: Record<string, unknown>) => processReport(phone.id, { protections: [{ key: "SCREEN_TIME", config }] });
    const tampered = { dailyMinutes: 900, weekendMinutes: 900 };
    const alerts = () => db.alert.count({ where: { deviceId: phone.id, resolveKey: `SCREEN_TIME:${phone.id}` } });

    await report(original);
    expect((await db.deviceProtection.findUniqueOrThrow({ where: { deviceId_key: { deviceId: phone.id, key: "SCREEN_TIME" } } })).status).toBe("PASS");

    // The parent just asked for a change: a report that matches neither is the device mid-change
    await requestConfigs(admin, childId, [{ key: "SCREEN_TIME", dailyMinutes: 60, weekendMinutes: 90 }], "test", { strict: true });
    await report(tampered);
    expect(await alerts()).toBe(0);

    // Back to the policy; then the request sits open for hours (the device never picked it up)
    await report(original);
    await db.configRequest.updateMany({
      where: { deviceId: phone.id, status: { in: ["PENDING", "DELIVERED", "AWAITING_PARENT"] } },
      data: { createdAt: new Date(Date.now() - 7 * 3600_000) },
    });
    await report(tampered);
    expect(await alerts()).toBe(1);
  });
});

const code = (e: unknown) => (e instanceof ServiceError ? e.code : String(e));

describe("removing a device", () => {
  it("needs the parent's password, revokes the device and tells the family", async () => {
    const tab = await device("Old Tablet");
    const token = await db.device.findUniqueOrThrow({ where: { id: tab.id }, select: { tokenHash: true } });
    await expect(removeDevice(admin, tab.id, { password: "wrong" }).catch(code)).resolves.toBe("wrong_password");
    await expect(removeDevice(admin, tab.id, { password: "" }).catch(code)).resolves.toBe("wrong_password");
    expect(await db.device.count({ where: { id: tab.id } })).toBe(1);

    await removeDevice(admin, tab.id, { password: PASSWORD });
    expect(await db.device.count({ where: { tokenHash: token.tokenHash } })).toBe(0);
    expect(await db.alert.count({ where: { familyId: admin.familyId, title: "Device removed", subject: "Lia's Old Tablet", severity: "ATTENTION", category: "DEVICES" } })).toBe(1);
    // Already gone: 404, before any password check
    await expect(removeDevice(admin, tab.id, { password: "" }).catch(code)).resolves.toBe("not_found");
  });

  it("can't touch another family's device", async () => {
    const tab = await device("Lia's Kindle");
    const eve = await db.family.create({
      data: { name: "Eve", users: { create: { name: "Eve", email: `eve.${RUN}@verification-test.example`, passwordHash: await hashPassword(PASSWORD), role: "FAMILY_ADMIN" } } },
      include: { users: true },
    });
    const intruder: Actor = { id: eve.users[0].id, name: "Eve", familyId: eve.id, role: "FAMILY_ADMIN" };
    await expect(removeDevice(intruder, tab.id, { password: PASSWORD }).catch(code)).resolves.toBe("not_found");
    expect(await db.device.count({ where: { id: tab.id } })).toBe(1);
  });
});

describe("pairing codes", () => {
  const pair = (c: string) => pairDevice(new Request("http://test/api/device/v1/pair", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: c, platform: "ANDROID", name: "Lia's New Phone", model: "Test", kind: "PHONE", osVersion: "Android 15" }),
  }));

  it("only the newest code for a child works, and the parent sees when it's used", async () => {
    const first = await createPairingCode(admin, childId);
    const second = await createPairingCode(admin, childId);
    expect(await pairingCodeStatus(admin, first.code)).toMatchObject({ status: "replaced" });
    expect((await pair(first.code)).status).toBe(400);
    expect(await pairingCodeStatus(admin, second.code)).toMatchObject({ status: "waiting" });

    const res = await pair(second.code);
    expect(res.status).toBe(201);
    const { deviceId } = await res.json();
    expect(await pairingCodeStatus(admin, second.code)).toEqual({ status: "paired", device: { id: deviceId, name: "Lia's New Phone" } });
  });

  it("says when a code expired, and hides other families' codes", async () => {
    const c = await createPairingCode(admin, childId);
    await db.pairingCode.updateMany({ where: { code: c.code }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await pairingCodeStatus(admin, c.code)).toMatchObject({ status: "expired" });
    expect(await pairingCodeStatus({ ...admin, familyId: "someone-else" }, c.code)).toEqual({ status: "replaced" });
  });

  it("limits how many codes a parent makes", async () => {
    await db.rateLimit.deleteMany({ where: { key: `paircode:${admin.id}` } });
    for (let i = 0; i < 20; i++) await createPairingCode(admin, childId);
    await expect(createPairingCode(admin, childId).catch(code)).resolves.toBe("rate_limited");
    await db.rateLimit.deleteMany({ where: { key: `paircode:${admin.id}` } });
  });
});

describe("location sharing", () => {
  it("follows the device's LOCATION report, forgets the position when it's turned off, and ignores stray fixes", async () => {
    const phone = await device("Lia's Watch");
    const dev = { id: phone.id, childId, familyId: admin.familyId };
    const row = () => db.deviceLocation.findUniqueOrThrow({ where: { deviceId: phone.id } });
    await recordLocation(dev, { lat: 14.6, lng: 121.0, accuracyM: 20, placeLabel: "School" });
    expect(await row()).toMatchObject({ sharing: true, lat: 14.6, placeLabel: "School" });

    await processReport(phone.id, { protections: [{ key: "LOCATION", config: { sharing: false } }] });
    expect(await row()).toMatchObject({ sharing: false, lat: null, lng: null, accuracyM: null, placeLabel: null, locatedAt: null });
    await recordLocation(dev, { lat: 14.61, lng: 121.01 });
    expect(await row()).toMatchObject({ sharing: false, lat: null });

    await processReport(phone.id, { protections: [{ key: "LOCATION", config: { sharing: true } }] });
    await recordLocation(dev, { lat: 14.62, lng: 121.02 });
    expect(await row()).toMatchObject({ sharing: true, lat: 14.62 });
  });
});

describe("location history pages", () => {
  it("pages through visits newest first, with no gaps or repeats", async () => {
    const phone = await device("Lia's History Phone");
    const t0 = Date.now() - 10 * 3600_000;
    await db.locationVisit.createMany({
      data: Array.from({ length: 7 }, (_, i) => ({
        deviceId: phone.id, childId, lat: 14.6 + i / 100, lng: 121, placeLabel: `Place ${i}`,
        arrivedAt: new Date(t0 + i * 60_000), lastSeenAt: new Date(t0 + i * 60_000 + 30_000),
      })),
    });
    const seen: string[] = [];
    let before: Date | undefined;
    for (let pages = 0; pages < 5; pages++) {
      const p = await visitsPage(childId, { before, limit: 3 });
      seen.push(...p.visits.filter((v) => v.deviceId === phone.id).map((v) => v.placeLabel!));
      if (!p.nextBefore) break;
      before = p.nextBefore;
    }
    expect(seen).toEqual(["Place 6", "Place 5", "Place 4", "Place 3", "Place 2", "Place 1", "Place 0"]);
  });
});

describe("where a child is (childLocation)", () => {
  const now = Date.parse("2026-09-28T10:00:00Z");
  const min = 60_000;
  const loc = (at: number, o: Partial<{ sharing: boolean; lat: number | null; accuracyM: number | null }> = {}) => ({
    sharing: true, lat: 14.6, lng: 121.0, accuracyM: 20, placeLabel: "Home", locatedAt: new Date(at), updatedAt: new Date(at), ...o,
  });
  const dev = (id: string, location: ReturnType<typeof loc> | null, o: { seen?: number; protections?: { key: string; status: string; reported: unknown }[] } = {}) =>
    ({ id, name: id, lastSeenAt: new Date(o.seen ?? now), location, protections: o.protections ?? [] });

  it("is live only when recent and from a device that still syncs", () => {
    expect(childLocation([dev("a", loc(now - 2 * min))], now)).toMatchObject({ state: "located", fresh: true });
    expect(childLocation([dev("a", loc(now - 20 * min))], now)).toMatchObject({ state: "located", fresh: false });
    expect(childLocation([dev("a", loc(now - 2 * min), { seen: now - 2 * 864e5 })], now).fresh).toBe(false);
  });
  it("uses the newest fix across the child's devices", () => {
    const l = childLocation([dev("phone", loc(now - 30 * min)), dev("tablet", loc(now - 3 * min))], now);
    expect(l.device?.id).toBe("tablet");
  });
  it("tells waiting, sharing off and no devices apart", () => {
    expect(childLocation([], now).state).toBe("no_devices");
    expect(childLocation([dev("a", loc(now, { lat: null }))], now).state).toBe("waiting");
    expect(childLocation([dev("a", loc(now, { sharing: false, lat: null }))], now)).toMatchObject({ state: "sharing_off", offDevice: { id: "a" } });
  });
  it("sees sharing turned off in the LOCATION report even before any location arrived", () => {
    const off = dev("a", null, { protections: [{ key: "LOCATION", status: "WARNING", reported: { key: "LOCATION", sharing: false } }] });
    expect(childLocation([off], now)).toMatchObject({ state: "sharing_off", offDevice: { id: "a" } });
    const on = dev("b", null, { protections: [{ key: "LOCATION", status: "PASS", reported: { key: "LOCATION", sharing: true } }] });
    expect(childLocation([on], now).state).toBe("waiting");
  });
  it("marks rough fixes as approximate", () => {
    expect(childLocation([dev("a", loc(now, { accuracyM: 1500 }))], now).approximate).toBe(true);
    expect(childLocation([dev("a", loc(now, { accuracyM: 30 }))], now).approximate).toBe(false);
  });
});

describe("screen-time limit for a day", () => {
  it("uses the weekend limit on Saturday and Sunday only", () => {
    const c = { dailyLimitMinutes: 120, weekendLimitMinutes: 180 };
    expect(limitOn(c, "2026-09-25")).toBe(120); // Friday
    expect(limitOn(c, "2026-09-26")).toBe(180); // Saturday
    expect(limitOn(c, "2026-09-27")).toBe(180); // Sunday
    expect(limitOn(c, "2026-09-28")).toBe(120); // Monday
  });
});

describe("a child asking for a blocked app", () => {
  it("can't unblock it, and the parent answers the request like any other", async () => {
    const phone = await device("Lia's Tablet");
    const app = await db.childApp.create({ data: { childId, name: "Fortnite", approval: "BLOCKED" } });
    const resolveKey = `APPREQ:${childId}:Fortnite`;

    for (let i = 0; i < 3; i++) {
      expect(await (await phone.event({ type: "APP_REQUESTED", app: "Fortnite" })).json()).toMatchObject({ ok: true, approval: "BLOCKED" });
    }
    expect((await db.childApp.findUniqueOrThrow({ where: { id: app.id } })).approval).toBe("BLOCKED");
    expect(await db.alert.count({ where: { resolveKey } })).toBe(1);

    // Shown as a request waiting for the parent, still blocked
    const pending = await apps("pending");
    expect(pending.apps.find((a) => a.name === "Fortnite")).toMatchObject({ approval: "BLOCKED", requested: true });
    expect(pending.counts.pending).toBe(1);

    // Declining an app that is already blocked still answers the request
    await setAppApproval(admin, app.id, "BLOCKED", "test");
    expect(await db.alert.count({ where: { resolveKey, resolvedAt: null } })).toBe(0);
    expect((await apps("pending")).apps.some((a) => a.name === "Fortnite")).toBe(false);

    // Asking straight away again doesn't raise another alert (at most one a day)
    await phone.event({ type: "APP_REQUESTED", app: "Fortnite" });
    expect(await db.alert.count({ where: { resolveKey } })).toBe(1);
  });

  it("a new app still waits as PENDING, and approving it resolves the request", async () => {
    const phone = await device("Lia's Laptop");
    await phone.event({ type: "APP_REQUESTED", app: "Duolingo" });
    const app = await db.childApp.findUniqueOrThrow({ where: { childId_name: { childId, name: "Duolingo" } } });
    expect(app.approval).toBe("PENDING");
    expect((await apps("pending")).apps.find((a) => a.name === "Duolingo")).toMatchObject({ requested: true });
    await setAppApproval(admin, app.id, "ALLOWED", "test");
    expect(await db.alert.count({ where: { resolveKey: `APPREQ:${childId}:Duolingo`, resolvedAt: null } })).toBe(0);
  });
});
