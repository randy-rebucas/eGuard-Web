import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomInt } from "node:crypto";

const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/mail", async (orig) => ({
  ...(await orig<typeof import("@/lib/mail")>()),
  sendMail: async (m: { to: string; subject: string; text: string }) => { mail.sent.push(m); },
}));

import { addOrgAdmin, createOrganization, joinOrganization, removeOrgAdmin } from "@/lib/organizations";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/org-api";
import type { Actor } from "@/lib/config-service";
import * as organizationRoute from "@/app/api/org/v1/organization/route";
import * as codesRoute from "@/app/api/org/v1/codes/route";
import * as codeRoute from "@/app/api/org/v1/codes/[code]/route";
import * as cancelRoute from "@/app/api/org/v1/codes/[code]/cancel/route";
import * as batchesRoute from "@/app/api/org/v1/batches/route";
import * as activityRoute from "@/app/api/org/v1/activity/route";

/** The organization API (docs/organization-api.md), calling the route handlers directly against the real database. */

const db = new PrismaClient();
const RUN = `k${Date.now().toString(36)}`;
const DOMAIN = `${RUN}@org-api-test.example`;
const BASE = "http://localhost/api/org/v1";
const DAY = 864e5;

let owner: Actor, helper: Actor, joiner: Actor;
let orgId: string, otherOrgId: string, joinCode: string;
let readKey: string, writeKey: string;
const codes: string[] = [];

async function family(name: string, plan = "Free") {
  const f = await db.family.create({
    data: {
      name, plan, deviceLimit: 2,
      users: { create: { name: `${name} Admin`, email: `admin.${name.toLowerCase()}.${DOMAIN}`, passwordHash: "x", role: "FAMILY_ADMIN", emailVerifiedAt: new Date() } },
    },
    include: { users: true },
  });
  const u = f.users[0];
  return { id: u.id, name: u.name, familyId: f.id, role: u.role } as Actor;
}

type Route = { GET?: (req: Request, ctx: { params: Promise<never> }) => Promise<Response>; POST?: (req: Request, ctx: { params: Promise<never> }) => Promise<Response> };

async function call(route: Route, path: string, { key, method = "GET", params = {} }: { key?: string; method?: "GET" | "POST"; params?: Record<string, string> } = {}) {
  const req = new Request(`${BASE}${path}`, { method, headers: key ? { Authorization: `Bearer ${key}` } : {} });
  const res = await route[method]!(req, { params: Promise.resolve(params as never) });
  return { status: res.status, body: await res.json() };
}

/** A paid batch made directly in the database (buying is covered in organizations.test.ts). */
async function paidBatch(org: string, n: number) {
  const id = `${RUN}-${Math.random().toString(36).slice(2)}`;
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const made = Array.from({ length: n }, () => Array.from({ length: 12 }, () => abc[randomInt(abc.length)]).join(""));
  await db.voucherBatch.create({
    data: {
      id, orgId: org, plan: "PLUS", months: 3, quantity: n, amount: 44_700 * n, purchaseToken: `cs_${id}`, state: "PAID", paymentId: `pay_${id}`,
      paidAt: new Date(), createdBy: owner.id,
      vouchers: { create: made.map((code) => ({ code, expiresAt: new Date(Date.now() + 365 * DAY) })) },
    },
  });
  return made;
}

beforeAll(async () => {
  owner = await family("Delacruz");
  helper = await family("Ramos", "Family Pro");
  joiner = await family("Mendoza");
  const org = await createOrganization(owner, { name: "Mabini High School", kind: "SCHOOL" });
  orgId = org.id;
  joinCode = org.joinCode;
  otherOrgId = (await createOrganization(owner, { name: "Other School", kind: "SCHOOL" })).id;
  await addOrgAdmin(owner, orgId, `admin.ramos.${DOMAIN}`);
  codes.push(...await paidBatch(orgId, 3));
});
beforeEach(() => { mail.sent.length = 0; });
afterAll(async () => {
  const users = await db.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
  await db.organization.deleteMany({ where: { members: { some: { userId: { in: users.map((u) => u.id) } } } } });
  await db.family.deleteMany({ where: { users: { some: { email: { endsWith: DOMAIN } } } } });
  await db.$disconnect();
});

describe("API keys", () => {
  it("needs a plan with API access to create one", async () => {
    await expect(createApiKey(owner, orgId, { name: "Enrollment system", access: "READ" })).rejects.toMatchObject({ status: 403, code: "plan_required" });
    await expect(createApiKey(joiner, orgId, { name: "Enrollment system", access: "READ" })).rejects.toMatchObject({ status: 404 }); // not an admin
    await expect(createApiKey(helper, orgId, { name: "x", access: "READ" })).rejects.toThrow();
  });

  it("shows the key once, stores only its hash, and tells the other admins", async () => {
    const r = await createApiKey(helper, orgId, { name: "Enrollment system", access: "READ" });
    readKey = r.token;
    expect(readKey).toMatch(/^egk_[A-Za-z0-9_-]{43}$/);
    expect(r.prefix).toBe(readKey.slice(0, 12));
    const row = await db.orgApiKey.findUniqueOrThrow({ where: { id: r.id } });
    expect(JSON.stringify(row)).not.toContain(readKey);
    expect(mail.sent.map((m) => [m.to, m.subject])).toEqual([[`admin.delacruz.${DOMAIN}`, "New API key for Mabini High School"]]);
    expect(mail.sent[0].text).not.toContain(readKey);

    writeKey = (await createApiKey(helper, orgId, { name: "Registrar", access: "WRITE" })).token;
    expect((await listApiKeys(owner, orgId)).map((k) => [k.name, k.access, k.state])).toEqual([["Enrollment system", "READ", "ACTIVE"], ["Registrar", "WRITE", "ACTIVE"]]);
  });

  it("allows up to 5 working keys", async () => {
    const extra = [];
    for (let i = 0; i < 3; i++) extra.push(await createApiKey(helper, orgId, { name: `Spare ${i}`, access: "READ" }));
    await expect(createApiKey(helper, orgId, { name: "One too many", access: "READ" })).rejects.toMatchObject({ status: 409 });
    for (const k of extra) await revokeApiKey(owner, orgId, k.id); // any admin can revoke
    expect(await listApiKeys(owner, orgId)).toHaveLength(2);
  });
});

describe("authentication", () => {
  it("rejects a missing, malformed or unknown key", async () => {
    expect((await call(organizationRoute, "/organization")).status).toBe(401);
    expect((await call(organizationRoute, "/organization", { key: "not-a-key" })).status).toBe(401);
    const r = await call(organizationRoute, "/organization", { key: `egk_${"x".repeat(43)}` });
    expect(r).toMatchObject({ status: 401, body: { code: "unauthorized" } });
  });

  it("pauses a key while its admin's plan has no API access", async () => {
    await db.family.update({ where: { id: helper.familyId }, data: { plan: "eGuard Plus" } });
    expect(await call(organizationRoute, "/organization", { key: readKey })).toMatchObject({ status: 403, body: { code: "plan_required" } });
    expect((await listApiKeys(owner, orgId))[0].state).toBe("PAUSED");
    await db.family.update({ where: { id: helper.familyId }, data: { plan: "Family Pro" } });
    expect((await call(organizationRoute, "/organization", { key: readKey })).status).toBe(200);
  });
});

describe("reading", () => {
  it("returns the organization with counts, and records when the key was used", async () => {
    await joinOrganization(joiner, joinCode);
    const r = await call(organizationRoute, "/organization", { key: readKey });
    expect(r.status).toBe(200);
    expect(r.body.organization).toMatchObject({
      id: orgId, name: "Mabini High School", kind: "SCHOOL", kindLabel: "School", families: 1,
      codes: { total: 3, available: 3, redeemed: 0, cancelled: 0, expired: 0 },
      key: { name: "Enrollment system", access: "READ" },
    });
    expect(r.body.organization.joinCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect((await listApiKeys(owner, orgId))[0].lastUsedAt).not.toBeNull();
  });

  it("lists codes by status, a page at a time", async () => {
    const first = await call(codesRoute, "/codes?limit=2", { key: readKey });
    expect(first.status).toBe(200);
    expect(first.body.codes).toHaveLength(2);
    expect(first.body.codes[0]).toMatchObject({ status: "AVAILABLE", plan: "PLUS", planName: "eGuard Plus", months: 3, redeemedAt: null });
    expect(first.body.next).toBe(first.body.codes[1].code);
    const second = await call(codesRoute, `/codes?limit=2&after=${first.body.next}`, { key: readKey });
    expect(second.body.codes).toHaveLength(1);
    expect(second.body.next).toBeNull();
    expect((await call(codesRoute, "/codes?status=REDEEMED", { key: readKey })).body.codes).toEqual([]);
    expect(await call(codesRoute, "/codes?status=USED", { key: readKey })).toMatchObject({ status: 400, body: { code: "invalid" } });
    expect((await call(codesRoute, "/codes?limit=501", { key: readKey })).status).toBe(400);
  });

  it("finds one code by id or by the code as typed, only in its own organization", async () => {
    const typed = codes[0].toLowerCase().replace(/(.{4})(?=.)/g, "$1-");
    const r = await call(codeRoute, `/codes/${typed}`, { key: readKey, params: { code: typed } });
    expect(r.status).toBe(200);
    expect((await call(codeRoute, `/codes/${r.body.code.id}`, { key: readKey, params: { code: r.body.code.id } })).body.code.code).toBe(r.body.code.code);

    const [elsewhere] = await paidBatch(otherOrgId, 1);
    expect((await call(codeRoute, `/codes/${elsewhere}`, { key: readKey, params: { code: elsewhere } })).status).toBe(404);
  });

  it("lists batches with their code counts", async () => {
    const r = await call(batchesRoute, "/batches", { key: readKey });
    expect(r.body.batches).toEqual([expect.objectContaining({ plan: "PLUS", months: 3, quantity: 3, currency: "PHP", state: "PAID", codes: expect.objectContaining({ total: 3 }) })]);
  });

  it("reports daily activity as counts", async () => {
    const r = await call(activityRoute, "/activity?days=7", { key: readKey });
    expect(r.body.days).toHaveLength(7);
    expect(r.body.days.at(-1)).toMatchObject({ joined: 1, left: 0, redeemed: 0, cancelled: 0 });
    expect((await call(activityRoute, "/activity?days=31", { key: readKey })).status).toBe(400);
    expect((await call(activityRoute, "/activity?timezone=Mars/Base", { key: readKey })).status).toBe(400);
  });
});

describe("cancelling codes", () => {
  it("needs a key with write access", async () => {
    const code = codes[1];
    expect(await call(cancelRoute, `/codes/${code}/cancel`, { key: readKey, method: "POST", params: { code } })).toMatchObject({ status: 403, body: { code: "forbidden" } });
    const r = await call(cancelRoute, `/codes/${code}/cancel`, { key: writeKey, method: "POST", params: { code } });
    expect(r).toMatchObject({ status: 200, body: { code: { status: "CANCELLED" } } });
    expect(r.body.code.cancelledAt).not.toBeNull();
    expect((await call(cancelRoute, `/codes/${code}/cancel`, { key: writeKey, method: "POST", params: { code } })).status).toBe(409);
    expect((await db.auditLog.findFirstOrThrow({ where: { familyId: helper.familyId, action: "org.code.cancelled" } })).actor).toBe('API key "Registrar"');
  });
});

describe("privacy", () => {
  it("never returns anything about a family", async () => {
    // A family redeems a code, so there's something to leak
    const v = await db.voucher.findUniqueOrThrow({ where: { code: codes[2] } });
    await db.voucher.update({ where: { id: v.id }, data: { redeemedAt: new Date(), familyId: joiner.familyId } });
    const bodies = JSON.stringify([
      (await call(organizationRoute, "/organization", { key: readKey })).body,
      (await call(codesRoute, "/codes", { key: readKey })).body,
      (await call(codeRoute, `/codes/${codes[2]}`, { key: readKey, params: { code: codes[2] } })).body,
      (await call(batchesRoute, "/batches", { key: readKey })).body,
      (await call(activityRoute, "/activity", { key: readKey })).body,
    ]);
    expect(bodies).toContain('"REDEEMED"');
    for (const needle of [joiner.familyId, joiner.id, "Mendoza", `admin.mendoza.${DOMAIN}`, "familyId"]) expect(bodies).not.toContain(needle);
  });
});

describe("revoking", () => {
  it("stops a key when it's revoked, or when its admin stops managing the organization", async () => {
    const keys = await listApiKeys(owner, orgId);
    await revokeApiKey(owner, orgId, keys.find((k) => k.name === "Registrar")!.id);
    expect(mail.sent.map((m) => m.subject)).toEqual(["API key revoked for Mabini High School"]);
    expect((await call(organizationRoute, "/organization", { key: writeKey })).status).toBe(401);

    expect((await call(organizationRoute, "/organization", { key: readKey })).status).toBe(200);
    await removeOrgAdmin(owner, orgId, helper.id);
    expect((await call(organizationRoute, "/organization", { key: readKey })).status).toBe(401);
    expect(await db.orgApiKey.count({ where: { orgId, revokedAt: null } })).toBe(0);
  });
});
