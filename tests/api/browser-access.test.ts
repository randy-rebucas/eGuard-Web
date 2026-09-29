import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { endOfDay } from "@/lib/browser-access";
import { BASE, PASSWORD, call, cleanup, db, email, verifyInbox } from "./helpers";

/**
 * A child asks from the browser's block page to open a site; a parent answers. Also: what the extension downloads
 * now carries approvals and the category lists (signature coverage is in browser-policy.test.ts).
 */

let token = "";
let familyId = "";
let childId = "";
let access = "";

const ext = (path: string, o: { body?: unknown; token?: string } = {}) =>
  call(o.body === undefined ? "GET" : "POST", `${BASE}/api/browser/v1${path}`, { body: o.body, token: o.token, headers: { "x-eguard-client": "chrome-extension" } });
const ask = (domain: string, reason?: string) => ext("/access-requests", { token: access, body: { domain, reason } });
const policy = async () => (await ext("/policy", { token: access })).data.policy;
const answer = (id: string, body: unknown, t = token) => call("POST", `/browser-access-requests/${id}`, { token: t, body });

afterAll(cleanup);

beforeAll(async () => {
  const r = await call("POST", "/auth/register", { body: { name: "Tess Lim", email: email("tess"), password: PASSWORD, guardian: true } });
  token = r.data.token;
  familyId = r.data.user.family.id;
  await verifyInbox(email("tess"));
  childId = (await call("POST", "/children", { token, body: { name: "Lia", age: 7 } })).data.id;
  const code = (await call("POST", `/children/${childId}/pairing-code`, { token, body: { kind: "BROWSER", deviceLabel: "Lia's Laptop" } })).data.code;
  access = (await ext("/pair", { body: { code, browser: "Chrome", browserVersion: "153", extensionVersion: "0.1.0", platform: "win" } })).data.accessToken;
});

describe("what the extension downloads", () => {
  it("includes the lists for blocked categories only, and no approvals yet", async () => {
    const p = await policy();
    expect(p.blockedCategories).toEqual(expect.arrayContaining(["ADULT", "SOCIAL_MEDIA"]));
    expect(Object.keys(p.categoryDomains).sort()).toEqual(expect.arrayContaining(["ADULT", "SOCIAL_MEDIA"]));
    expect(p.categoryDomains.SOCIAL_MEDIA).toContain("facebook.com");
    expect(p.categoryDomains).not.toHaveProperty("GAMING"); // not blocked for this family
    expect(p.categoryDomains).not.toHaveProperty("MALWARE"); // left to the browser's own protection
    expect(p.temporaryAllows).toEqual([]);
  });
});

describe("asking", () => {
  it("creates one request per site, tells the parents, and asking again returns the open one", async () => {
    const first = await ask("https://www.Roblox.com/games", "Playing with my cousin");
    expect(first.status).toBe(201);
    expect(first.data.request).toMatchObject({ domain: "www.roblox.com", status: "PENDING", reason: "Playing with my cousin" });
    const again = await ask("www.roblox.com");
    expect(again.status).toBe(200);
    expect(again.data.request.id).toBe(first.data.request.id);

    const alert = await db.alert.findFirst({ where: { familyId, resolveKey: `WEBREQ:${first.data.request.id}` } });
    expect(alert).toMatchObject({ title: "Website access request", body: 'Lia asked to open www.roblox.com: "Playing with my cousin"', resolvedAt: null });

    const list = await call("GET", `/children/${childId}/browser-access-requests`, { token });
    expect(list.data.pending.map((r: { domain: string }) => r.domain)).toEqual(["www.roblox.com"]);
    expect((await ext("/access-requests", { token: access })).data.requests[0]).toMatchObject({ domain: "www.roblox.com", status: "PENDING" });
  });

  it("refuses things that aren't websites, and needs a connected browser", async () => {
    expect((await ask("not a site")).status).toBe(400);
    expect((await ext("/access-requests", { body: { domain: "a.com" } })).status).toBe(401);
  });
});

describe("answering", () => {
  const requestFor = async (domain: string) => (await ask(domain)).data.request.id as string;

  it("approving for an hour sends a new policy version the browser can use until then", async () => {
    const before = (await policy()).version;
    const id = (await ask("www.roblox.com")).data.request.id;
    const r = await answer(id, { decision: "APPROVE", duration: "1H" });
    expect(r.status).toBe(200);
    expect(r.data.request).toMatchObject({ status: "APPROVED", duration: "1H", decidedBy: "Tess Lim" });

    const p = await policy();
    expect(p.version).toBe(before + 1);
    expect(p.temporaryAllows).toHaveLength(1);
    expect(p.temporaryAllows[0].domain).toBe("www.roblox.com");
    const minutes = (Date.parse(p.temporaryAllows[0].until) - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(58);
    expect(minutes).toBeLessThanOrEqual(60);

    expect((await db.alert.findFirst({ where: { resolveKey: `WEBREQ:${id}` } }))?.resolvedAt).not.toBeNull();
    expect(await db.auditLog.findFirst({ where: { familyId, action: "browser.access.approved" } })).toMatchObject({ detail: "Lia: www.roblox.com (1 hour)" });
    expect((await ext("/access-requests", { token: access })).data.requests[0]).toMatchObject({ status: "APPROVED", duration: "1H" });
  });

  it("each request is answered once", async () => {
    const id = (await call("GET", `/children/${childId}/browser-access-requests`, { token })).data.recent[0].id;
    const r = await answer(id, { decision: "DENY" });
    expect(r.status).toBe(409);
    expect(r.data.code).toBe("already_decided");
  });

  it("a parent's later edit keeps the approval in force", async () => {
    const current = (await call("GET", `/children/${childId}/browser-policy`, { token })).data;
    await call("PUT", `/children/${childId}/browser-policy`, {
      token,
      body: { safeBrowsing: true, safeSearch: false, blockedCategories: current.blockedCategories, blockedDomains: [], allowedDomains: [], unknownSitesPolicy: "ALLOW", schedule: null },
    });
    expect((await policy()).temporaryAllows.map((t: { domain: string }) => t.domain)).toEqual(["www.roblox.com"]);
  });

  it("'always' moves the site to the allowed list (and off the blocked list)", async () => {
    const current = (await call("GET", `/children/${childId}/browser-policy`, { token })).data;
    await call("PUT", `/children/${childId}/browser-policy`, { token, body: { ...current, categories: undefined, version: undefined, updatedBy: undefined, updatedAt: undefined, blockedDomains: ["khanacademy.org"] } });
    const id = await requestFor("khanacademy.org");
    await answer(id, { decision: "APPROVE", duration: "ALWAYS" });
    const p = await policy();
    expect(p.allowedDomains).toContain("khanacademy.org");
    expect(p.blockedDomains).not.toContain("khanacademy.org");
  });

  it("'rest of today' ends at midnight in the family's time zone", async () => {
    const id = await requestFor("pbskids.org");
    await answer(id, { decision: "APPROVE", duration: "TODAY" });
    const until = Date.parse((await policy()).temporaryAllows.find((t: { domain: string }) => t.domain === "pbskids.org").until);
    const family = await db.family.findUniqueOrThrow({ where: { id: familyId } });
    expect(Math.abs(until - endOfDay(family.timezone).getTime())).toBeLessThan(60_000);
  });

  it("declining changes nothing in the policy", async () => {
    const before = (await policy()).version;
    const id = await requestFor("tiktok.com");
    const r = await answer(id, { decision: "DENY" });
    expect(r.data.request.status).toBe("DENIED");
    expect((await policy()).version).toBe(before);
    expect(await db.auditLog.count({ where: { familyId, action: "browser.access.denied" } })).toBe(1);
  });

  it("another family can't see or answer requests", async () => {
    const other = await call("POST", "/auth/register", { body: { name: "Other", email: email("tess-other"), password: PASSWORD, guardian: true } });
    const id = await requestFor("example.org");
    expect((await answer(id, { decision: "APPROVE", duration: "ALWAYS" }, other.data.token)).status).toBe(404);
    expect((await call("GET", `/children/${childId}/browser-access-requests`, { token: other.data.token })).status).toBe(404);
  });

  it("rejects malformed answers", async () => {
    const id = await requestFor("example.net");
    expect((await answer(id, { decision: "APPROVE" })).status).toBe(400);
    expect((await answer(id, { decision: "APPROVE", duration: "FOREVER" })).status).toBe(400);
  });
});

describe("limits", () => {
  it("a browser can ask about 10 new sites an hour", async () => {
    await db.rateLimit.deleteMany({ where: { key: { startsWith: "webreq:" } } });
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await ask(`site${i}.example.com`)).status);
    expect(codes.slice(0, 10).every((c) => c === 201)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});

describe("endOfDay", () => {
  it("is the next local midnight", () => {
    const now = new Date("2026-09-29T10:30:00Z"); // 18:30 in Manila
    expect(endOfDay("Asia/Manila", now).toISOString()).toBe("2026-09-29T16:00:00.000Z");
    expect(endOfDay("UTC", now).toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });
});
