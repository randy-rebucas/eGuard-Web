import { createPrivateKey, createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canonicalJson, defaultCategories, normalizeDomain, parseDomainList } from "@/lib/browser-policy";
import { BASE, PASSWORD, call, cleanup, db, email, verifyInbox } from "./helpers";

/**
 * Browser protection policies: editing (mobile API; the web form uses the same service), versioning,
 * validation, and the signed policy the extension downloads. The server must have BROWSER_POLICY_SIGNING_KEY
 * (e.g. in .env.local); this test reads the same env files to check signatures with its public half.
 */

/** The server's signing key: from the environment, or .env.local / .env (Next skips .env.local when NODE_ENV=test). */
function signingKey() {
  if (process.env.BROWSER_POLICY_SIGNING_KEY) return process.env.BROWSER_POLICY_SIGNING_KEY;
  for (const f of [".env.local", ".env"]) {
    const m = existsSync(f) ? /^BROWSER_POLICY_SIGNING_KEY="?([A-Za-z0-9+/=]+)"?$/m.exec(readFileSync(f, "utf8")) : null;
    if (m) return m[1];
  }
  throw new Error("BROWSER_POLICY_SIGNING_KEY not found (node scripts/browser-policy-keys.mjs)");
}
const publicKey = () => createPublicKey(createPrivateKey({ key: Buffer.from(signingKey(), "base64"), format: "der", type: "pkcs8" }));

let token = "";
let familyId = "";
let childId = "";

const ext = (path: string, o: { body?: unknown; token?: string } = {}) =>
  call(o.body === undefined ? "GET" : "POST", `${BASE}/api/browser/v1${path}`, { body: o.body, token: o.token, headers: { "x-eguard-client": "chrome-extension" } });

async function pairBrowser() {
  const code = (await call("POST", `/children/${childId}/pairing-code`, { token, body: { kind: "BROWSER", deviceLabel: "Lia's Laptop" } })).data.code;
  const r = await ext("/pair", { body: { code, browser: "Chrome", browserVersion: "153", extensionVersion: "0.1.0", platform: "win" } });
  expect(r.status).toBe(201);
  return r.data as { installationId: string; accessToken: string };
}

const settings = (patch: Record<string, unknown> = {}) => ({
  safeBrowsing: true,
  safeSearch: true,
  blockedCategories: ["ADULT", "GAMING"],
  blockedDomains: ["blocked.example"],
  allowedDomains: ["school.example"],
  unknownSitesPolicy: "ALLOW",
  schedule: null,
  ...patch,
});

afterAll(cleanup);

beforeAll(async () => {
  const r = await call("POST", "/auth/register", { body: { name: "Paz Ramos", email: email("paz"), password: PASSWORD, guardian: true } });
  token = r.data.token;
  familyId = r.data.user.family.id;
  await verifyInbox(email("paz"));
  childId = (await call("POST", "/children", { token, body: { name: "Lia", age: 7 } })).data.id;
});

describe("pure rules", () => {
  it("canonical JSON matches the extension's test vector byte for byte", () => {
    // Same vector as eguard-browser/packages/policy-engine/src/policy-engine.test.ts
    expect(canonicalJson({ b: [3, { z: 1, a: "x" }], a: null, c: { y: true, x: "é" } })).toBe('{"a":null,"b":[3,{"a":"x","z":1}],"c":{"x":"é","y":true}}');
  });

  it("turns what parents type into host names", () => {
    expect(normalizeDomain("https://www.YouTube.com/watch?v=1")).toBe("www.youtube.com");
    expect(normalizeDomain("*.example.com")).toBe("example.com");
    expect(normalizeDomain("example.com:8080/x")).toBe("example.com");
    expect(normalizeDomain("Example.COM.")).toBe("example.com");
    for (const bad of ["localhost", "not a site", "http://", "-bad.com", "a..com"]) expect(normalizeDomain(bad)).toBeNull();
    expect(parseDomainList("b.com\na.com, a.com\n  \nnot a site")).toEqual({ domains: ["a.com", "b.com"], invalid: ["not a site"] });
  });

  it("defaults protect by age, always blocking security threats", () => {
    expect(defaultCategories(7)).toEqual(expect.arrayContaining(["MALWARE", "PHISHING", "ADULT", "SOCIAL_MEDIA", "DATING"]));
    expect(defaultCategories(15)).not.toContain("SOCIAL_MEDIA");
    expect(defaultCategories(15)).toEqual(expect.arrayContaining(["MALWARE", "PHISHING"]));
  });
});

describe("editing", () => {
  it("starts from age-based defaults at version 1", async () => {
    const r = await call("GET", `/children/${childId}/browser-policy`, { token });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ version: 1, safeSearch: true, unknownSitesPolicy: "ALLOW", updatedBy: "eGuard defaults" });
    expect(r.data.blockedCategories).toContain("SOCIAL_MEDIA");
    expect(r.data.categories).toHaveLength(14);
  });

  it("saves a change as a new version, normalising the lists", async () => {
    const r = await call("PUT", `/children/${childId}/browser-policy`, {
      token,
      body: settings({ blockedDomains: ["https://www.Blocked.example/page", "blocked.example", "*.games.example"], schedule: { enabled: true, startTime: "21:00", endTime: "06:00" } }),
    });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ version: 2, updatedBy: "Paz Ramos", blockedDomains: ["blocked.example", "games.example", "www.blocked.example"], schedule: { enabled: true, startTime: "21:00" } });

    const versions = await db.browserPolicyVersion.findMany({ where: { policy: { childId } }, orderBy: { version: "asc" } });
    expect(versions.map((v) => [v.version, v.createdBy])).toEqual([[1, "eGuard defaults"], [2, "Paz Ramos"]]);
    expect(await db.auditLog.findFirst({ where: { familyId, action: "browser.policy.updated" } })).toMatchObject({ detail: "Lia: v1 → v2" });
    const change = await db.configChange.findFirst({ where: { familyId, key: "WEB" }, orderBy: { createdAt: "desc" } });
    expect(change?.actor).toContain("applies on next browser sync");
  });

  it("saving the same settings again doesn't create a version", async () => {
    const current = (await call("GET", `/children/${childId}/browser-policy`, { token })).data;
    const r = await call("PUT", `/children/${childId}/browser-policy`, {
      token,
      body: settings({ blockedDomains: current.blockedDomains, schedule: current.schedule, blockedCategories: [...current.blockedCategories].reverse() }),
    });
    expect(r.data.version).toBe(current.version);
  });

  it("explains invalid input and changes nothing", async () => {
    const before = (await call("GET", `/children/${childId}/browser-policy`, { token })).data.version;
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ blockedDomains: ["not a site"] }, /isn't a website address/],
      [{ blockedDomains: ["x.example"], allowedDomains: ["x.example"] }, /in both lists/],
      [{ schedule: { enabled: true, startTime: "09:00", endTime: "09:00" } }, /different start and end/],
      [{ schedule: { enabled: true, startTime: "25:00", endTime: "09:00" } }, /time like/],
      [{ unknownSitesPolicy: "MAYBE" }, /./],
      [{ blockedCategories: ["NOPE"] }, /./],
    ];
    for (const [patch, msg] of cases) {
      const r = await call("PUT", `/children/${childId}/browser-policy`, { token, body: settings(patch) });
      expect(r.status, JSON.stringify(patch)).toBe(400);
      expect(r.data.error).toMatch(msg);
    }
    expect((await call("GET", `/children/${childId}/browser-policy`, { token })).data.version).toBe(before);
  });

  it("another family can't read or change it", async () => {
    const other = await call("POST", "/auth/register", { body: { name: "Other", email: email("paz-other"), password: PASSWORD, guardian: true } });
    expect((await call("GET", `/children/${childId}/browser-policy`, { token: other.data.token })).status).toBe(404);
    expect((await call("PUT", `/children/${childId}/browser-policy`, { token: other.data.token, body: settings() })).status).toBe(404);
  });
});

describe("what the extension downloads", () => {
  it("is the current policy for this installation, signed with eGuard's key over canonical JSON", async () => {
    const b = await pairBrowser();
    const r = await ext("/policy", { token: b.accessToken });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    const { policy, signature, keyId } = r.data;
    const current = (await call("GET", `/children/${childId}/browser-policy`, { token })).data;
    expect(policy).toMatchObject({
      childId, installationId: b.installationId, version: current.version,
      blockedDomains: current.blockedDomains, schedule: { enabled: true, startTime: "21:00", endTime: "06:00", timezone: expect.any(String) },
    });
    expect(keyId).toMatch(/^[0-9a-f]{16}$/);
    const ok = (p: unknown) => verify("sha256", Buffer.from(canonicalJson(p)), { key: publicKey(), dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64"));
    expect(ok(policy)).toBe(true);
    expect(ok({ ...policy, blockedDomains: [] })).toBe(false);
    expect(ok({ ...policy, installationId: "someone-else" })).toBe(false);
  });

  it("a parent's change reaches the extension as the next version", async () => {
    const b = await pairBrowser();
    const before = (await ext("/policy", { token: b.accessToken })).data.policy.version;
    await call("PUT", `/children/${childId}/browser-policy`, { token, body: settings({ safeSearch: false, schedule: null }) });
    const after = (await ext("/policy", { token: b.accessToken })).data.policy;
    expect(after.version).toBe(before + 1);
    expect(after).toMatchObject({ safeSearch: false, schedule: null });
  });
});
