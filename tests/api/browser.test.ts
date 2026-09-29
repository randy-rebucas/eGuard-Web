import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, PASSWORD, call, cleanup, db, email, pairDevice, verifyInbox } from "./helpers";

/**
 * The eGuard browser extension's API (/api/browser/v1): pairing with BROWSER codes, rotating refresh tokens
 * with replay detection, the policy endpoint, removal, and browsers counting toward the plan's device limit.
 */

const BROWSER_API = `${BASE}/api/browser/v1`;
let token = "";
let familyId = "";
let childId = "";

const ext = (path: string, o: { body?: unknown; token?: string; method?: string } = {}) =>
  call(o.method ?? (o.body === undefined ? "GET" : "POST"), `${BROWSER_API}${path}`, { body: o.body, token: o.token, headers: { "x-eguard-client": "chrome-extension" } });

const pairBody = (code: string) => ({ code, browser: "Chrome", browserVersion: "153.0.0.0", extensionVersion: "0.1.0", platform: "mac" });

async function browserCode(deviceLabel = "Lia's MacBook") {
  const r = await call("POST", `/children/${childId}/pairing-code`, { token, body: { kind: "BROWSER", deviceLabel } });
  expect(r.status).toBe(201);
  return r.data.code as string;
}

async function pairBrowser(deviceLabel?: string) {
  const code = await browserCode(deviceLabel);
  const r = await ext("/pair", { body: pairBody(code) });
  expect(r.status).toBe(201);
  return r.data as { installationId: string; accessToken: string; refreshToken: string; childName: string; deviceName: string; familyName: string };
}

afterAll(cleanup);

beforeAll(async () => {
  const r = await call("POST", "/auth/register", { body: { name: "Ria Santos", email: email("ria"), password: PASSWORD, guardian: true } });
  token = r.data.token;
  familyId = r.data.user.family.id;
  await verifyInbox(email("ria"));
  childId = (await call("POST", "/children", { token, body: { name: "Lia", age: 10 } })).data.id;
});

describe("pairing", () => {
  it("a browser code needs a computer name", async () => {
    const r = await call("POST", `/children/${childId}/pairing-code`, { token, body: { kind: "BROWSER", deviceLabel: " " } });
    expect(r.status).toBe(400);
  });

  it("pairs with a browser code (spaces and dashes allowed) and returns the connection details", async () => {
    const code = await browserCode();
    const r = await ext("/pair", { body: pairBody(`${code.slice(0, 4)}-${code.slice(4).toLowerCase()}`) });
    expect(r.status).toBe(201);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(r.data).toMatchObject({ childName: "Lia", deviceName: "Lia's MacBook", familyName: expect.any(String) });
    expect(r.data.accessToken).toHaveLength(43);
    expect(r.data.refreshToken).not.toBe(r.data.accessToken);

    const row = await db.browserInstallation.findUniqueOrThrow({ where: { id: r.data.installationId } });
    expect(row).toMatchObject({ familyId, childId, browser: "Chrome", platform: "mac", deviceLabel: "Lia's MacBook" });
    // Only hashes are stored
    expect(JSON.stringify(row)).not.toContain(r.data.refreshToken);
    expect(JSON.stringify(row)).not.toContain(r.data.accessToken);

    const audit = await db.auditLog.findFirst({ where: { familyId, action: "browser.paired" } });
    expect(audit?.detail).toBe("Lia's Chrome on Lia's MacBook");
    await db.browserInstallation.delete({ where: { id: r.data.installationId } });
  });

  it("a code works once", async () => {
    const code = await browserCode();
    expect((await ext("/pair", { body: pairBody(code) })).status).toBe(201);
    const again = await ext("/pair", { body: pairBody(code) });
    expect(again.status).toBe(400);
    expect(again.data.code).toBe("invalid_code");
    await db.browserInstallation.deleteMany({ where: { familyId } });
  });

  it("phone codes and browser codes can't be swapped", async () => {
    const phoneCode = (await call("POST", `/children/${childId}/pairing-code`, { token })).data.code;
    const r = await ext("/pair", { body: pairBody(phoneCode) });
    expect(r.status).toBe(400);
    expect(r.data.code).toBe("wrong_code_kind");

    const code = await browserCode();
    const asPhone = await call("POST", `${BASE}/api/device/v1/pair`, {
      body: { code, platform: "ANDROID", name: "Phone", model: "Test", kind: "PHONE", osVersion: "Android 15" },
    });
    expect(asPhone.status).toBe(400);
    expect(asPhone.data.error).toMatch(/browser extension/);
  });

  it("the parent's screen sees the browser pair", async () => {
    const code = await browserCode("Lia's desktop");
    await ext("/pair", { body: pairBody(code) });
    const inst = await db.browserInstallation.findFirstOrThrow({ where: { familyId, deviceLabel: "Lia's desktop" } });
    expect(inst.childId).toBe(childId);
    await db.browserInstallation.delete({ where: { id: inst.id } });
  });

  it("rejects malformed requests without detail", async () => {
    const r = await ext("/pair", { body: { code: "x" } });
    expect(r.status).toBe(400);
    expect(r.data).toEqual({ error: "Pairing code is invalid or expired", code: "invalid_code" });
  });
});

describe("tokens", () => {
  it("the access token opens the policy endpoint, which says plainly that nothing is set up yet", async () => {
    const p = await pairBrowser();
    const r = await ext("/policy", { token: p.accessToken });
    expect(r.status).toBe(404);
    expect(r.data).toEqual({ error: "Browser protection settings for Lia aren't set up in eGuard yet.", code: "policy_not_configured" });
    expect((await ext("/policy", { token: "not-a-token" })).status).toBe(401);
    expect((await ext("/policy")).status).toBe(401);
    // The refresh token isn't an access token
    expect((await ext("/policy", { token: p.refreshToken })).status).toBe(401);
    await db.browserInstallation.delete({ where: { id: p.installationId } });
  });

  it("refresh rotates both tokens; the old access token stops working", async () => {
    const p = await pairBrowser();
    const r = await ext("/token", { body: { installationId: p.installationId, refreshToken: p.refreshToken } });
    expect(r.status).toBe(200);
    expect(r.data.refreshToken).not.toBe(p.refreshToken);
    expect((await ext("/policy", { token: p.accessToken })).status).toBe(401);
    expect((await ext("/policy", { token: r.data.accessToken })).status).toBe(404);
    // The new refresh token works in turn
    expect((await ext("/token", { body: { installationId: p.installationId, refreshToken: r.data.refreshToken } })).status).toBe(200);
    await db.browserInstallation.delete({ where: { id: p.installationId } });
  });

  it("an expired access token is refused", async () => {
    const p = await pairBrowser();
    await db.browserInstallation.update({ where: { id: p.installationId }, data: { accessTokenExpiresAt: new Date(Date.now() - 1000) } });
    expect((await ext("/policy", { token: p.accessToken })).status).toBe(401);
    await db.browserInstallation.delete({ where: { id: p.installationId } });
  });

  it("a refresh retried right after a lost response still works", async () => {
    const p = await pairBrowser();
    const first = await ext("/token", { body: { installationId: p.installationId, refreshToken: p.refreshToken } });
    const retry = await ext("/token", { body: { installationId: p.installationId, refreshToken: p.refreshToken } });
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect((await ext("/policy", { token: retry.data.accessToken })).status).toBe(404);
    const row = await db.browserInstallation.findUniqueOrThrow({ where: { id: p.installationId } });
    expect(row.revokedAt).toBeNull();
    await db.browserInstallation.delete({ where: { id: p.installationId } });
  });

  it("a copied refresh token used later disconnects the browser and tells the family", async () => {
    const p = await pairBrowser("Lia's laptop");
    const rotated = await ext("/token", { body: { installationId: p.installationId, refreshToken: p.refreshToken } });
    expect(rotated.status).toBe(200);
    await db.browserInstallation.update({ where: { id: p.installationId }, data: { refreshRotatedAt: new Date(Date.now() - 3 * 60_000) } });

    const replay = await ext("/token", { body: { installationId: p.installationId, refreshToken: p.refreshToken } });
    expect(replay.status).toBe(401);
    // Everything stops working, including the legitimate latest tokens
    expect((await ext("/policy", { token: rotated.data.accessToken })).status).toBe(401);
    expect((await ext("/token", { body: { installationId: p.installationId, refreshToken: rotated.data.refreshToken } })).status).toBe(401);

    const row = await db.browserInstallation.findUniqueOrThrow({ where: { id: p.installationId } });
    expect(row.revokedAt).not.toBeNull();
    const alert = await db.alert.findFirst({ where: { familyId, resolveKey: `BROWSER_REVOKED:${p.installationId}` } });
    expect(alert).toMatchObject({ severity: "ACTION_REQUIRED", title: "Browser disconnected for security" });
    expect(await db.auditLog.count({ where: { familyId, action: "browser.token.reuse_detected" } })).toBe(1);
    await db.browserInstallation.delete({ where: { id: p.installationId } });
  });

  it("an unknown installation or token gets a plain 401", async () => {
    const r = await ext("/token", { body: { installationId: "nope", refreshToken: "x".repeat(43) } });
    expect(r.status).toBe(401);
    expect(r.data.code).toBe("unauthorized");
  });
});

describe("removal and plan limits", () => {
  it("the parent sees and removes a browser (with password); its tokens stop working", async () => {
    const p = await pairBrowser();
    const list = await call("GET", "/browsers", { token });
    expect(list.data.browsers).toEqual([
      expect.objectContaining({ id: p.installationId, childName: "Lia", browser: "Chrome", deviceLabel: "Lia's MacBook", connected: true }),
    ]);
    expect((await call("DELETE", `/browsers/${p.installationId}`, { token, body: { password: "wrong" } })).status).toBe(403);
    expect((await call("DELETE", `/browsers/${p.installationId}`, { token, body: { password: PASSWORD } })).status).toBe(200);
    expect((await ext("/policy", { token: p.accessToken })).status).toBe(401);
    expect((await ext("/token", { body: { installationId: p.installationId, refreshToken: p.refreshToken } })).status).toBe(401);
    expect(await db.auditLog.count({ where: { familyId, action: "browser.removed" } })).toBe(1);
  });

  it("another family can't see or remove the browser", async () => {
    const p = await pairBrowser();
    const other = await call("POST", "/auth/register", { body: { name: "Other Parent", email: email("other"), password: PASSWORD, guardian: true } });
    expect((await call("GET", "/browsers", { token: other.data.token })).data.browsers).toEqual([]);
    expect((await call("DELETE", `/browsers/${p.installationId}`, { token: other.data.token, body: { password: PASSWORD } })).status).toBe(404);
    await db.browserInstallation.delete({ where: { id: p.installationId } });
  });

  it("browsers count toward the plan's device limit (Free: 2)", async () => {
    await pairBrowser();
    await pairDevice(token, childId, "ANDROID", "Lia's Phone");
    const full = await call("POST", `/children/${childId}/pairing-code`, { token, body: { kind: "BROWSER", deviceLabel: "Another" } });
    expect(full.status).toBe(409);
    expect(full.data.code).toBe("plan_limit");
    const sub = await call("GET", "/subscription", { token });
    expect(sub.data.usage).toMatchObject({ devicesUsed: 2, deviceLimit: 2 });
  });

  it("a browser disconnected for security frees its slot", async () => {
    await db.browserInstallation.updateMany({ where: { familyId }, data: { revokedAt: new Date() } });
    expect((await call("POST", `/children/${childId}/pairing-code`, { token, body: { kind: "BROWSER", deviceLabel: "Replacement" } })).status).toBe(201);
  });
});
