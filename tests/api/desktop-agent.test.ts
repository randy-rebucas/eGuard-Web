import { createPrivateKey, createPublicKey, verify } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, PASSWORD, call, childDevice, cleanup, db, email, register } from "./helpers";
import { canonicalJson } from "@/lib/browser-policy";
import { removalCode } from "@/lib/device-removal";
import { QUIET_REMOVAL_DAYS, finishQuietRemovals } from "@/lib/family-service";
import { desktopRelease } from "@/lib/desktop-release";
import { ServiceError } from "@/lib/errors";

// The server signs with the key in .env.local; read it too, so the signatures can be checked here
try { process.loadEnvFile(".env.local"); } catch { /* no local env: signatures aren't checked */ }

/**
 * The eGuard desktop agent on a Windows PC, against the real database and server: pairing as a computer, the app
 * scan (one game under two names is one app), tamper alerts, the signed catalog, and removal that only a parent can
 * start and only the computer (or a parent's code) can finish.
 */

let token = "";
let familyId = "";
let childId = "";
let deviceId = "";
let removalSecret = "";
let pc: ReturnType<typeof childDevice>;

afterAll(cleanup);

async function pairPc(name = "Gaming PC") {
  const code = await call("POST", `/children/${childId}/pairing-code`, { token });
  return call("POST", `${BASE}/api/device/v1/pair`, {
    body: { code: code.data.code, platform: "WINDOWS", name, model: "Custom build", osVersion: "Windows 11 24H2", appVersion: "0.1.0" },
  });
}

/** The signature the agent checks, with the public key built into it (here, derived from the server's key). */
function verifies(payload: object, signature: string) {
  const pub = createPublicKey(createPrivateKey({ key: Buffer.from(process.env.BROWSER_POLICY_SIGNING_KEY!, "base64"), format: "der", type: "pkcs8" }));
  return verify("sha256", Buffer.from(canonicalJson(payload)), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64"));
}

beforeAll(async () => {
  const r = await register({ name: "Carla Diaz", email: email("carla"), password: PASSWORD, guardian: true });
  token = r.data.token;
  familyId = r.data.user.family.id;
  await db.user.update({ where: { id: r.data.user.id }, data: { emailVerifiedAt: new Date() } });
  await db.family.update({ where: { id: familyId }, data: { plan: "eGuard Plus", deviceLimit: 10 } });
  childId = (await call("POST", "/children", { token, body: { name: "Mia", age: 12 } })).data.id;
  const pair = await pairPc();
  expect(pair.status).toBe(201);
  deviceId = pair.data.deviceId;
  removalSecret = pair.data.removalSecret;
  pc = childDevice(pair.data.token);
});

describe("pairing a computer", () => {
  it("is a COMPUTER on WINDOWS, with a removal secret only computers get", async () => {
    expect(removalSecret).toMatch(/^[\w-]{40,}$/);
    expect(await db.device.findUnique({ where: { id: deviceId } })).toMatchObject({ platform: "WINDOWS", kind: "COMPUTER", removalSecret });
  });

  it("a phone can't claim to be a computer", async () => {
    const code = await call("POST", `/children/${childId}/pairing-code`, { token });
    const r = await call("POST", `${BASE}/api/device/v1/pair`, { body: { code: code.data.code, platform: "ANDROID", kind: "COMPUTER", name: "x", model: "x", osVersion: "Android 15" } });
    expect(r.status).toBe(400);
  });

  it("sync sends the server's clock, app ids and no uninstall command, and asks again within a minute", async () => {
    const s = await pc("/sync");
    expect(s.status).toBe(200);
    expect(Math.abs(Date.parse(s.data.serverTime) - Date.now())).toBeLessThan(60_000);
    expect(s.data.uninstall).toBeNull();
    // No push wakes a computer: it syncs every minute, so a parent's "allow" or "more time" arrives quickly
    expect(s.data.nextSyncSeconds).toBe(60);
  });

  it("a protection the computer leaves out of a full report isn't applied yet, in a computer's words", async () => {
    const r = await pc("/report", { full: true, protections: [{ key: "UNINSTALL_PROTECTION", config: { enabled: false }, error: "Not on yet." }] });
    expect(r.status).toBe(200);
    const p = await db.deviceProtection.findUnique({ where: { deviceId_key: { deviceId, key: "SCREEN_TIME" } } });
    expect(p?.message).toContain("eGuard for this computer doesn't apply it yet");
  });

  it("reports which Windows accounts the child's rules apply in, and the parent sees them", async () => {
    const accounts = [{ name: "Mia", enforced: true }, { name: "Carla", enforced: false }];
    expect((await pc("/report", { protections: [], accounts })).status).toBe(200);
    const d = await call("GET", `/devices/${deviceId}`, { token });
    expect(d.data.accounts).toEqual(accounts);
    // Not a list of anything else
    expect((await pc("/report", { protections: [], accounts: [{ name: "", enforced: true }] })).status).toBe(400);
  });

  it("the device page shows Windows capabilities: apps and time, not location", async () => {
    const d = await call("GET", `/devices/${deviceId}`, { token });
    const cap = (k: string) => d.data.protections.find((p: { key: string }) => p.key === k).capability;
    expect([cap("SCREEN_TIME"), cap("APP_APPROVAL"), cap("UNINSTALL_PROTECTION"), cap("LOCATION")]).toEqual(["AVAILABLE", "AVAILABLE", "GUIDED", "UNSUPPORTED"]);
    expect(d.data.removalCode).toBeNull();
  });
});

describe("apps on the computer", () => {
  it("the first scan adds what it found with one alert, not one per app; with App Approval on (a 12-year-old's profile) they wait", async () => {
    const r = await pc("/events", { type: "APPS_FOUND", apps: [
      { app: "Counter-Strike 2", ids: [{ kind: "STEAM", value: "730" }], source: "CATALOG", category: "GAMES" },
      { app: "Roblox", ids: [{ kind: "EXE", value: "roblox corporation|roblox" }], source: "CATALOG", category: "GAMES" },
      { app: "Pixel Quest", ids: [{ kind: "EXE", value: "|pixel quest" }], source: "UNKNOWN_PUBLISHER", category: "GAMES" },
    ] });
    expect(r.status).toBe(200);
    const apps = await db.childApp.findMany({ where: { childId }, orderBy: { name: "asc" } });
    expect(apps.map((a) => [a.name, a.source, a.approval])).toEqual([
      ["Counter-Strike 2", "CATALOG", "PENDING"], ["Pixel Quest", "UNKNOWN_PUBLISHER", "PENDING"], ["Roblox", "CATALOG", "PENDING"],
    ]);
    const alerts = await db.alert.findMany({ where: { familyId, title: "Apps found on a computer" } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].body).toContain("3 games");
    expect(alerts[0].body).toContain("1 from a publisher eGuard can't verify");
    expect(alerts[0].body).toContain("blocked until you allow them");
  });

  it("with App Approval off, found apps stay allowed", async () => {
    await db.childPolicy.updateMany({ where: { childId, key: "APP_APPROVAL" }, data: { config: { enabled: false } } });
    await db.childPolicy.updateMany({ where: { childId, key: "DOWNLOADS" }, data: { config: { requireApproval: false } } });
    await pc("/events", { type: "APPS_FOUND", apps: [{ app: "Terraria", ids: [{ kind: "STEAM", value: "105600" }], source: "LAUNCHER", category: "GAMES" }] });
    expect(await db.childApp.findUnique({ where: { childId_name: { childId, name: "Terraria" } } })).toMatchObject({ approval: "ALLOWED", source: "LAUNCHER" });
  });

  it("the same game under another name is the same app: usage adds up under the listed name", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = await pc("/usage", { date: today, totalMinutes: 50, apps: [
      { name: "cs2.exe", minutes: 30, ids: [{ kind: "STEAM", value: "730" }] },
      { name: "Counter-Strike 2", minutes: 15, ids: [{ kind: "STEAM", value: "730" }] },
    ] });
    expect(r.status).toBe(200);
    const usage = await db.appUsageDaily.findMany({ where: { deviceId } });
    expect(usage.map((u) => [u.app, u.minutes])).toEqual([["Counter-Strike 2", 45]]);
    expect(await db.childApp.count({ where: { childId, name: "cs2.exe" } })).toBe(0);
  });

  it("a known game installed again isn't news, and sync hands back its ids", async () => {
    const before = await db.alert.count({ where: { familyId, category: "APPS" } });
    await pc("/events", { type: "APP_INSTALLED", app: "CS2", ids: [{ kind: "STEAM", value: "730" }], source: "CATALOG" });
    expect(await db.alert.count({ where: { familyId, category: "APPS" } })).toBe(before);
    const s = await pc("/sync");
    expect(s.data.apps.find((a: { name: string }) => a.name === "Counter-Strike 2")).toMatchObject({ category: "GAMES", ids: [{ kind: "STEAM", value: "730" }] });
  });

  it("with App Approval on, a new game from an unknown publisher waits for the parent", async () => {
    await db.childPolicy.upsert({ where: { childId_key: { childId, key: "APP_APPROVAL" } }, create: { childId, key: "APP_APPROVAL", config: { enabled: true } }, update: { config: { enabled: true } } });
    await pc("/events", { type: "APP_INSTALLED", app: "Shady Shooter", ids: [{ kind: "EXE", value: "|shady shooter" }], source: "UNKNOWN_PUBLISHER" });
    expect(await db.childApp.findUnique({ where: { childId_name: { childId, name: "Shady Shooter" } } })).toMatchObject({ approval: "PENDING" });
    const alert = await db.alert.findFirst({ where: { familyId, title: "App approval requested" }, orderBy: { createdAt: "desc" } });
    expect(alert?.body).toContain("Its publisher isn't verified");
    // The scan found it; the child didn't ask
    expect(alert?.body).toMatch(/^Shady Shooter was found on Mia's Gaming PC and waits for you\./);
  });

  it("with App Approval off but web filtering on, a browser eGuard can't filter waits; other apps stay allowed", async () => {
    await db.childPolicy.updateMany({ where: { childId, key: "APP_APPROVAL" }, data: { config: { enabled: false } } });
    await db.childPolicy.upsert({ where: { childId_key: { childId, key: "WEB" } }, create: { childId, key: "WEB", config: { mode: "FILTER", blockedSites: 0 } }, update: { config: { mode: "FILTER", blockedSites: 0 } } });
    await pc("/events", { type: "APPS_FOUND", apps: [
      { app: "Opera", ids: [{ kind: "EXE", value: "opera norway as|opera" }], source: "UNKNOWN_PUBLISHER", category: "BROWSERS" },
      { app: "Stardew Valley", ids: [{ kind: "STEAM", value: "413150" }], source: "LAUNCHER", category: "GAMES" },
    ] });
    const approval = async (name: string) => (await db.childApp.findUnique({ where: { childId_name: { childId, name } } }))?.approval;
    expect(await approval("Opera")).toBe("PENDING");
    expect(await approval("Stardew Valley")).toBe("ALLOWED");
    const found = await db.alert.findFirst({ where: { familyId, title: "Apps found on a computer" }, orderBy: { createdAt: "desc" } });
    expect(found).toMatchObject({ severity: "ATTENTION" });
    expect(found?.body).toContain("except a web browser, which waits for you");
    await pc("/events", { type: "APP_INSTALLED", app: "Brave", ids: [{ kind: "EXE", value: "brave software, inc.|brave" }], source: "UNKNOWN_PUBLISHER", category: "BROWSERS" });
    expect(await approval("Brave")).toBe("PENDING");
    // Web filtering off: a browser is an app like any other
    await db.childPolicy.updateMany({ where: { childId, key: "WEB" }, data: { config: { mode: "OFF", blockedSites: 0 } } });
    await pc("/events", { type: "APP_INSTALLED", app: "Vivaldi", ids: [{ kind: "EXE", value: "vivaldi technologies as|vivaldi" }], source: "UNKNOWN_PUBLISHER", category: "BROWSERS" });
    expect(await approval("Vivaldi")).toBe("ALLOWED");
    await db.childPolicy.updateMany({ where: { childId, key: "APP_APPROVAL" }, data: { config: { enabled: true } } });
  });

  it("an app the child asks for keeps what the computer knows about it: its category, source and ids", async () => {
    const r = await pc("/events", { type: "APP_REQUESTED", app: "Other Browser", ids: [{ kind: "EXE", value: "|other browser" }], source: "UNKNOWN_PUBLISHER", category: "BROWSERS" });
    expect(r.status).toBe(200);
    expect(await db.childApp.findUnique({ where: { childId_name: { childId, name: "Other Browser" } } })).toMatchObject({ approval: "PENDING", category: "BROWSERS", source: "UNKNOWN_PUBLISHER" });
    // Its id is known now: the same exe under another name is the same app
    const s = await pc("/sync");
    expect(s.data.apps.find((a: { name: string }) => a.name === "Other Browser")).toMatchObject({ ids: [{ kind: "EXE", value: "|other browser" }] });
    // A phone's request has none of them, as before
    expect((await pc("/events", { type: "APP_REQUESTED", app: "Plain Request" })).status).toBe(200);
  });
});

describe("the catalog", () => {
  it("is signed, and unchanged when the agent has the newest", async () => {
    const r = await call("GET", `${BASE}/api/device/v1/catalog`, { token: (await pairPc("Catalog PC")).data.token });
    expect(r.status).toBe(200);
    expect(r.data.catalog.type).toBe("eguard.desktop.catalog");
    expect(r.data.catalog.entries).toContainEqual(expect.objectContaining({ kind: "GAME", matchType: "LAUNCHER_ID", match: "steam:730", displayName: "Counter-Strike 2" }));
    expect(r.data.catalog.entries).toContainEqual(expect.objectContaining({ kind: "TRUSTED_PUBLISHER", match: "microsoft corporation" }));
    expect(r.data.catalog.entries).toContainEqual(expect.objectContaining({ kind: "TRUSTED_PUBLISHER", match: "seiko epson corporation" }));
    if (process.env.BROWSER_POLICY_SIGNING_KEY) expect(verifies(r.data.catalog, r.data.signature)).toBe(true);
  });

  it("the version follows every change, a removed entry too, and an agent with the current one gets `unchanged`", async () => {
    const t = (await pairPc("Catalog PC 2")).data.token;
    const get = (since?: string) => call("GET", `${BASE}/api/device/v1/catalog${since ? `?since=${since}` : ""}`, { token: t });
    const v1 = (await get()).data.catalog.version as string;
    expect(v1).toMatch(/^[0-9a-f]{16}$/);
    expect((await get(v1)).data).toEqual({ version: v1, unchanged: true });
    const added = await db.desktopCatalogEntry.create({ data: { kind: "GAME", matchType: "EXE_NAME", match: `qa-${Date.now()}.exe`, displayName: "QA Game", category: "GAMES" } });
    const v2 = (await get(v1)).data.catalog.version;
    expect(v2).not.toBe(v1);
    await db.desktopCatalogEntry.delete({ where: { id: added.id } });
    // Removing it goes back to what agents had before, which they must hear about too
    expect((await get(v2)).data.catalog.version).toBe(v1);
  });

  it("each catalog carries when it was issued, under the signature, so an agent can refuse an older one", async () => {
    const t = (await pairPc("Catalog PC 3")).data.token;
    const before = Date.now();
    const r = await call("GET", `${BASE}/api/device/v1/catalog`, { token: t });
    expect(r.data.catalog.issuedAt).toBeGreaterThanOrEqual(before);
    if (process.env.BROWSER_POLICY_SIGNING_KEY) {
      expect(verifies(r.data.catalog, r.data.signature)).toBe(true);
      expect(verifies({ ...r.data.catalog, issuedAt: r.data.catalog.issuedAt + 1 }, r.data.signature)).toBe(false);
    }
  });
});

describe("updates", () => {
  const file = (name: string) => ({ name, size: 10, sha256: "a".repeat(64), url: `https://dl.eguard.family/0.2.0/${name}` });
  const release = { version: "0.2.0", files: [file("eguard-service.exe"), file("eguard-agent.exe"), file("eguard-guard.exe")] };

  it("DESKTOP_RELEASE: unset offers nothing, and a malformed one is refused rather than taken for none", () => {
    expect(desktopRelease("")).toBeNull();
    expect(desktopRelease(undefined)).toBeNull();
    expect(desktopRelease(JSON.stringify(release))).toEqual(release);
    const bad = [
      "{",
      { ...release, version: "0.2.0-beta" },
      { ...release, files: release.files.slice(0, 2) },
      { ...release, files: [file("eguard-agent.exe"), file("eguard-agent.exe"), file("eguard-guard.exe")] },
      { ...release, files: [file("eguard-service.exe"), file("eguard-agent.exe"), file("..\\evil.exe")] },
      { ...release, files: [{ ...file("eguard-service.exe"), sha256: "A".repeat(64) }, file("eguard-agent.exe"), file("eguard-guard.exe")] },
      { ...release, files: [{ ...file("eguard-service.exe"), url: "ftp://x/y.exe" }, file("eguard-agent.exe"), file("eguard-guard.exe")] },
    ];
    for (const b of bad) expect(() => desktopRelease(typeof b === "string" ? b : JSON.stringify(b))).toThrow(ServiceError);
  });

  it("a computer gets the release signed with when it was issued, or no manifest when none is set", async () => {
    const t = (await pairPc("Update PC")).data.token;
    expect((await call("GET", `${BASE}/api/device/v1/update`)).status).toBe(401);
    const before = Date.now();
    const r = await call("GET", `${BASE}/api/device/v1/update`, { token: t });
    expect(r.status).toBe(200);
    // The server reads its own environment; this test reads the same .env.local
    const configured = desktopRelease();
    if (!configured) {
      expect(r.data).toEqual({ manifest: null });
      return;
    }
    expect(r.data.manifest).toMatchObject({ type: "eguard.desktop.update", version: configured.version, files: configured.files });
    expect(r.data.manifest.issuedAt).toBeGreaterThanOrEqual(before);
    if (process.env.BROWSER_POLICY_SIGNING_KEY) {
      expect(verifies(r.data.manifest, r.data.signature)).toBe(true);
      expect(verifies({ ...r.data.manifest, version: "9.9.9" }, r.data.signature)).toBe(false);
    }
  });
});

describe("tampering", () => {
  it("an uninstall attempt raises an action-required alert, once an hour", async () => {
    await pc("/events", { type: "TAMPER", kind: "UNINSTALL_BLOCKED" });
    await pc("/events", { type: "TAMPER", kind: "UNINSTALL_BLOCKED" });
    const alerts = await db.alert.findMany({ where: { familyId, title: "Someone tried to uninstall eGuard" } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "ACTION_REQUIRED", deviceId });
  });

  it("a new Windows account on the computer is worth the parent's attention", async () => {
    await pc("/events", { type: "TAMPER", kind: "NEW_ACCOUNT" });
    const alert = await db.alert.findFirst({ where: { familyId, title: "A new account was added to the computer" } });
    expect(alert).toMatchObject({ severity: "ATTENTION", deviceId });
    expect(alert?.body).toContain("isn't limited");
  });

  it("the service stopped and started again is worth the parent's attention", async () => {
    await pc("/events", { type: "TAMPER", kind: "SERVICE_RESTARTED" });
    const alert = await db.alert.findFirst({ where: { familyId, title: "eGuard was stopped and started again" } });
    expect(alert).toMatchObject({ severity: "ATTENTION", deviceId });
    expect(alert?.body).toContain("takes an administrator account");
  });

  it("someone guessing the removal code raises an action-required alert", async () => {
    await pc("/events", { type: "TAMPER", kind: "REMOVAL_CODE_GUESSED" });
    const alert = await db.alert.findFirst({ where: { familyId, title: "Someone is guessing eGuard's removal code" } });
    expect(alert).toMatchObject({ severity: "ACTION_REQUIRED", deviceId });
  });

  it("the computer can't uninstall itself unless a parent asked", async () => {
    expect((await pc("/events", { type: "UNINSTALL_ACK" })).status).toBe(409);
    expect((await pc("/events", { type: "UNINSTALL_ACK", code: "AAAAAAAA" })).status).toBe(409);
    expect(await db.device.count({ where: { id: deviceId } })).toBe(1);
  });
});

describe("browsers on the computer", () => {
  const ext = (body: object) => call("POST", `${BASE}/api/browser/v1/pair`, { body, headers: { "x-eguard-client": "chrome-extension" } });
  const browserCode = async (childFor = childId) => (await call("POST", `/children/${childFor}/pairing-code`, { token, body: { kind: "BROWSER", deviceLabel: "Laptop" } })).data.code as string;
  const pairBody = (code: string, deviceLink?: string) => ({ code, browser: "Chrome", browserVersion: "153.0.0.0", extensionVersion: "0.1.0", platform: "win", deviceLink });
  let link = "";

  it("sync hands the computer a link for its browsers", async () => {
    const s = await pc("/sync");
    link = s.data.browserLink.value;
    expect(link.startsWith(`${deviceId}.`)).toBe(true);
    expect(Date.parse(s.data.browserLink.expiresAt) - Date.now()).toBeGreaterThan(29 * 864e5);
  });

  it("a browser paired with it is part of the computer and takes no device slot, even on a full plan", async () => {
    const used = (await db.device.count({ where: { familyId } })) + (await db.browserInstallation.count({ where: { familyId, deviceId: null } }));
    await db.family.update({ where: { id: familyId }, data: { deviceLimit: used } });
    const r = await ext(pairBody(await browserCode(), link));
    expect(r.status).toBe(201);
    expect(await db.browserInstallation.findUnique({ where: { id: r.data.installationId } })).toMatchObject({ deviceId, deviceLabel: "Gaming PC" });
    // Without the link, the same full plan has no room
    expect((await ext(pairBody(await browserCode()))).status).toBe(409);
    // A forged or tampered link is just an ordinary browser
    const forged = `${link.slice(0, -4)}AAAA`;
    expect((await ext(pairBody(await browserCode(), forged))).status).toBe(409);
    await db.family.update({ where: { id: familyId }, data: { deviceLimit: 10 } });
  });

  it("a link for another child's computer doesn't count", async () => {
    const leo = (await call("POST", "/children", { token, body: { name: "Leo", age: 10 } })).data.id;
    const r = await ext(pairBody(await browserCode(leo), link));
    expect(r.status).toBe(201);
    expect(await db.browserInstallation.findUnique({ where: { id: r.data.installationId } })).toMatchObject({ deviceId: null, childId: leo });
  });

  it("a link only counts for a browser on that kind of computer", async () => {
    const r = await ext({ ...pairBody(await browserCode(), link), platform: "mac" });
    expect(r.status).toBe(201);
    expect(await db.browserInstallation.findUnique({ where: { id: r.data.installationId } })).toMatchObject({ deviceId: null });
  });

  it("one computer carries at most 5 browsers for free: a copied link can't pair more", async () => {
    while (await db.browserInstallation.count({ where: { deviceId } }) < 5) expect((await ext(pairBody(await browserCode(), link))).status).toBe(201);
    const r = await ext(pairBody(await browserCode(), link));
    expect(r.status).toBe(201);
    expect(await db.browserInstallation.findUnique({ where: { id: r.data.installationId } })).toMatchObject({ deviceId: null });
  });

  it("moving the computer to another child moves its browsers too, with a policy version they'll accept", async () => {
    const leo = (await db.child.findFirstOrThrow({ where: { familyId, name: "Leo" } })).id;
    // The browsers enforced Mia's policy at version 9; Leo's is at 1, which the extension would refuse as older
    await db.browserInstallation.updateMany({ where: { deviceId }, data: { appliedPolicyVersion: 9 } });
    await call("GET", `/children/${leo}/browser-policy`, { token });
    expect((await call("POST", `/devices/${deviceId}/move`, { token, body: { childId: leo, password: PASSWORD } })).status).toBe(200);
    expect(new Set((await db.browserInstallation.findMany({ where: { deviceId }, select: { childId: true } })).map((b) => b.childId))).toEqual(new Set([leo]));
    expect((await db.browserPolicy.findUniqueOrThrow({ where: { childId: leo } })).version).toBeGreaterThan(9);
    await call("POST", `/devices/${deviceId}/move`, { token, body: { childId, password: PASSWORD } });
  });
});

describe("removal", () => {
  it("a parent's removal waits for the computer, which gets a signed uninstall command on sync", async () => {
    const r = await call("DELETE", `/devices/${deviceId}`, { token, body: { password: PASSWORD } });
    expect(r.status).toBe(200);
    expect(r.data.pending).toBe(true);
    expect(await db.device.count({ where: { id: deviceId } })).toBe(1);
    const s = await pc("/sync");
    expect(s.data.nextSyncSeconds).toBe(60);
    expect(s.data.uninstall.command).toMatchObject({ type: "eguard.device.uninstall", deviceId });
    if (process.env.BROWSER_POLICY_SIGNING_KEY) expect(verifies(s.data.uninstall.command, s.data.uninstall.signature)).toBe(true);
    const d = await call("GET", `/devices/${deviceId}`, { token });
    expect(d.data.removalCode.code).toBe(removalCode(removalSecret, deviceId).code);
  });

  it("the parent can keep it after all", async () => {
    const r = await call("POST", `/devices/${deviceId}/keep`, { token });
    expect(r.status).toBe(200);
    expect(r.data.removalRequestedAt).toBeNull();
    expect((await pc("/sync")).data.uninstall).toBeNull();
  });

  it("after the parent kept it, a removal code they'd seen no longer removes it, and they hear it was used", async () => {
    const r = await pc("/events", { type: "UNINSTALL_ACK", code: removalCode(removalSecret, deviceId).code });
    expect(r.status).toBe(409);
    expect(await db.device.count({ where: { id: deviceId } })).toBe(1);
    const alert = await db.alert.findFirst({ where: { familyId, title: "A removal code was used after you kept the computer" } });
    expect(alert).toMatchObject({ severity: "ACTION_REQUIRED", deviceId });
  });

  it("an offline removal code typed into the computer removes it", async () => {
    // The parent removes it on the dashboard while it's offline, and reads the code to whoever is at the computer
    await call("DELETE", `/devices/${deviceId}`, { token, body: { password: PASSWORD } });
    const r = await pc("/events", { type: "UNINSTALL_ACK", code: removalCode(removalSecret, deviceId).code.toLowerCase() });
    expect(r.status).toBe(200);
    expect(await db.device.count({ where: { id: deviceId } })).toBe(0);
    expect((await pc("/sync")).status).toBe(401);
    // Its browsers went with it
    expect(await db.browserInstallation.count({ where: { familyId, deviceLabel: "Gaming PC" } })).toBe(0);
  });

  it("a removal that waited a week with no word from the computer is finished; one the computer checked in after waits", async () => {
    const quiet = await pairPc("Old PC");
    const alive = await pairPc("Desk PC");
    const weekAgo = new Date(Date.now() - (QUIET_REMOVAL_DAYS * 864e5 + 60_000));
    await db.device.update({ where: { id: quiet.data.deviceId }, data: { removalRequestedAt: weekAgo, removalRequestedBy: "Carla", lastSeenAt: new Date(weekAgo.getTime() - 60_000) } });
    await db.device.update({ where: { id: alive.data.deviceId }, data: { removalRequestedAt: weekAgo, removalRequestedBy: "Carla", lastSeenAt: new Date() } });
    expect(await finishQuietRemovals()).toBeGreaterThanOrEqual(1);
    expect(await db.device.count({ where: { id: quiet.data.deviceId } })).toBe(0);
    expect(await db.device.count({ where: { id: alive.data.deviceId } })).toBe(1);
    const alert = await db.alert.findFirst({ where: { familyId, title: "Device removed", subject: "Mia's Old PC" } });
    expect(alert?.body).toContain("hasn't checked in since Carla asked to remove it 7 days ago");
    await db.device.update({ where: { id: alive.data.deviceId }, data: { removalRequestedAt: null, removalRequestedBy: null } });
  });

  it("the computer confirming the signed command finishes the removal", async () => {
    const pair = await pairPc("Laptop");
    const laptop = childDevice(pair.data.token);
    await call("DELETE", `/devices/${pair.data.deviceId}`, { token, body: { password: PASSWORD, deleteHistory: true } });
    expect((await laptop("/events", { type: "UNINSTALL_ACK" })).status).toBe(200);
    expect(await db.device.count({ where: { id: pair.data.deviceId } })).toBe(0);
    const alert = await db.alert.findFirst({ where: { familyId, title: "Device removed" }, orderBy: { createdAt: "desc" } });
    expect(alert?.body).toContain("confirmed it uninstalled eGuard");
  });
});
