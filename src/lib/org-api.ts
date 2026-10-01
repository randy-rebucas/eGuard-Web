import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { OrgApiKey, Organization, Prisma } from "@prisma/client";
import { db } from "./db";
import { newToken, sha256 } from "./auth";
import { ServiceError, conflict, notFound, planRequired } from "./errors";
import { audit } from "./audit";
import type { Actor } from "./config-service";
import { LIMITS, clientIpFrom, enforce, hit, ipKey, isLimited } from "./rate-limit";
import { entitlementsFor, planById, type PaidPlanId } from "./plans";
import { planWith } from "./plan-access";
import { ORG_KINDS, type CodeStatus, cancelOrgCode, codeStatus, formatCode, normalizeCode, requireOrgAdmin } from "./organizations";
import { ORG_EVENT_RETENTION_DAYS, notifyApiKeyCreated, notifyApiKeyRevoked } from "./org-notifications";

/**
 * The organization API (`/api/org/v1`, docs/organization-api.md): lets a school's or company's own systems
 * read its codes, batches and counts, and cancel codes. Like the organization page, it never returns anything
 * about a family: not who joined, not who redeemed a code.
 *
 * Keys belong to the organization and are created by one of its admins. A key works while that admin still
 * manages the organization and their family's plan includes API access (Family Pro).
 */

export const API_KEY_PREFIX = "egk_";
export const MAX_KEYS_PER_ORG = 5;
export type ApiAccess = "READ" | "WRITE";
export const ACCESS_LABELS: Record<ApiAccess, string> = { READ: "Read only", WRITE: "Read and cancel codes" };

const KeySchema = z.object({
  name: z.string().trim().min(2, "Name the key after what uses it, e.g. \"Enrollment system\".").max(60, "Use a shorter name (up to 60 characters)."),
  access: z.enum(["READ", "WRITE"], { message: "Choose what the key can do." }),
});

const apiPlanName = () => planWith((e) => e.apiAccess).name;

async function familyHasApiAccess(familyId: string) {
  const f = await db.family.findUnique({ where: { id: familyId }, select: { plan: true } });
  return !!f && entitlementsFor(f.plan).apiAccess;
}

/** Whether the admin can create keys: their family's plan has to include API access. */
export const canCreateApiKeys = (actor: Actor) => familyHasApiAccess(actor.familyId);

/* ---------- Keys (organization page) ---------- */

export async function createApiKey(actor: Actor, orgId: string, input: { name: string; access: string }) {
  await requireOrgAdmin(actor.id, orgId);
  const { name, access } = KeySchema.parse(input);
  if (!(await canCreateApiKeys(actor))) throw planRequired(`API keys are included with ${apiPlanName()}. Upgrade your family's plan in Settings › Subscription to create one.`);
  const token = `${API_KEY_PREFIX}${newToken(32)}`;
  const key = await db.$transaction(async (tx) => {
    // Count and create under one lock, so two admins creating keys at once can't pass the limit together
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org.keys:${orgId}`}))`;
    const active = await tx.orgApiKey.count({ where: { orgId, revokedAt: null } });
    if (active >= MAX_KEYS_PER_ORG) throw conflict(`An organization can have up to ${MAX_KEYS_PER_ORG} API keys. Revoke one you no longer use first.`);
    return tx.orgApiKey.create({
      data: { orgId, name, access, prefix: token.slice(0, API_KEY_PREFIX.length + 8), tokenHash: sha256(token), createdById: actor.id },
      include: { org: true },
    });
  });
  await audit(actor.familyId, actor.name, "org.api_key.created", `${name} (${ACCESS_LABELS[access]}) for ${key.org.name}`);
  await notifyApiKeyCreated(key.org, key, actor);
  // The only time the full key is shown
  return { id: key.id, name, prefix: key.prefix, token };
}

/** Any admin can revoke any of the organization's keys: when in doubt, turning one off should be easy. */
export async function revokeApiKey(actor: Actor, orgId: string, keyId: string) {
  await requireOrgAdmin(actor.id, orgId);
  const key = await db.orgApiKey.findFirst({ where: { id: keyId, orgId }, include: { org: true } });
  if (!key) throw notFound("API key");
  const r = await db.orgApiKey.updateMany({ where: { id: key.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!r.count) return;
  await audit(actor.familyId, actor.name, "org.api_key.revoked", `${key.name} for ${key.org.name}`);
  await notifyApiKeyRevoked(key.org, key, actor);
}

export type KeyState = "ACTIVE" | "PAUSED";

/** The organization's working keys. PAUSED: its admin's plan no longer includes API access. */
export async function listApiKeys(actor: Actor, orgId: string) {
  await requireOrgAdmin(actor.id, orgId);
  const keys = await db.orgApiKey.findMany({
    where: { orgId, revokedAt: null }, orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { id: true, name: true, family: { select: { plan: true } } } } },
  });
  return keys.map((k) => ({
    id: k.id, name: k.name, prefix: k.prefix, access: k.access as ApiAccess, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt,
    createdBy: k.createdBy.name, yours: k.createdBy.id === actor.id,
    state: (entitlementsFor(k.createdBy.family.plan).apiAccess ? "ACTIVE" : "PAUSED") as KeyState,
  }));
}

/* ---------- Authentication (API requests) ---------- */

export type ApiCaller = { key: OrgApiKey; org: Organization };

const unauthorized = () => new ServiceError(401, "Missing or invalid API key. Send it as Authorization: Bearer egk_…", "unauthorized");

/** How often a key's "last used" time is written: often enough to be useful, not on every request. */
const LAST_USED_EVERY_MS = 60_000;

export async function authOrgKey(req: Request, { write = false } = {}): Promise<ApiCaller> {
  const ipLimit = ipKey("orgapi", clientIpFrom(req.headers));
  if (await isLimited(ipLimit, LIMITS.orgApiBadKeyIp)) throw new ServiceError(429, "Too many requests with a wrong key. Wait a few minutes.", "rate_limited");
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const key = token.startsWith(API_KEY_PREFIX)
    ? await db.orgApiKey.findUnique({ where: { tokenHash: sha256(token) }, include: { org: true, createdBy: { include: { family: true } } } })
    : null;
  if (!key || key.revokedAt) {
    await hit(ipLimit, LIMITS.orgApiBadKeyIp);
    throw unauthorized();
  }
  // Checked on every request, so a removed admin's or a lapsed plan's key stops at once
  const member = await db.orgMember.findUnique({ where: { orgId_userId: { orgId: key.orgId, userId: key.createdById } } });
  if (!member) throw unauthorized();
  if (!entitlementsFor(key.createdBy.family.plan).apiAccess) {
    throw planRequired(`This key's admin (${key.createdBy.name}) is no longer on a plan with API access. It works again once their family is on ${apiPlanName()}, or another admin can create a new key.`);
  }
  if (write && key.access !== "WRITE") throw new ServiceError(403, "This key is read-only. Create a key with \"Read and cancel codes\" access to do this.", "forbidden");
  await enforce(`orgapi:key:${key.id}`, LIMITS.orgApiKey, "Too many requests for this key. Slow down and try again in a few minutes.");
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_EVERY_MS) {
    await db.orgApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  }
  return { key, org: key.org };
}

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const errorJson = (status: number, error: string, code?: string) => json({ error, ...(code ? { code } : {}) }, status);

type Ctx<P> = { params: Promise<P> };

/** Route handler for `/api/org/v1`. `write` routes need a key with WRITE access. */
export function orgApi<P = Record<string, never>>(fn: (c: { req: Request; caller: ApiCaller; params: P }) => Promise<unknown>, { write = false } = {}) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const caller = await authOrgKey(req, { write });
      return json(await fn({ req, caller, params: await ctx.params }));
    } catch (e) {
      if (e instanceof ServiceError) return errorJson(e.status, e.message, e.code);
      if (e instanceof z.ZodError) {
        const issue = e.issues[0];
        return errorJson(400, `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`, "invalid");
      }
      console.error("[org-api]", e);
      return errorJson(500, "Something went wrong. Try again.", "server_error");
    }
  };
}

export const queryOf = <S extends z.ZodType>(req: Request, schema: S): z.infer<S> => schema.parse(Object.fromEntries(new URL(req.url).searchParams));

/* ---------- What the API returns ---------- */

const CODE_STATUSES = ["AVAILABLE", "REDEEMED", "CANCELLED", "EXPIRED"] as const;

/** Paid (or refunded) batches only: a checkout nobody paid has no codes. */
const codesOf = (orgId: string): Prisma.VoucherWhereInput => ({ batch: { orgId, state: { in: ["PAID", "VOIDED"] } } });

function statusWhere(s: CodeStatus, now: Date): Prisma.VoucherWhereInput {
  switch (s) {
    case "REDEEMED": return { redeemedAt: { not: null } };
    case "CANCELLED": return { redeemedAt: null, revokedAt: { not: null } };
    case "EXPIRED": return { redeemedAt: null, revokedAt: null, expiresAt: { lte: now } };
    case "AVAILABLE": return { redeemedAt: null, revokedAt: null, expiresAt: { gt: now } };
  }
}

async function codeCounts(where: Prisma.VoucherWhereInput, now: Date) {
  const entries = await Promise.all(CODE_STATUSES.map(async (s) => [s.toLowerCase(), await db.voucher.count({ where: { AND: [where, statusWhere(s, now)] } })] as const));
  const counts = Object.fromEntries(entries) as Record<Lowercase<CodeStatus>, number>;
  return { total: Object.values(counts).reduce((a, b) => a + b, 0), ...counts };
}

type VoucherRow = Prisma.VoucherGetPayload<{ include: { batch: true } }>;

/** A code as the API shows it. Deliberately has no family. */
export const codeJson = (v: VoucherRow, now = Date.now()) => ({
  id: v.id,
  code: formatCode(v.code),
  status: codeStatus(v, now),
  plan: v.batch.plan,
  planName: planById(v.batch.plan as PaidPlanId).name,
  months: v.batch.months,
  batchId: v.batchId,
  redeemBy: v.expiresAt,
  redeemedAt: v.redeemedAt,
  cancelledAt: v.redeemedAt ? null : v.revokedAt,
});

export async function organizationJson({ org, key }: ApiCaller) {
  const now = new Date();
  const [families, codes] = await Promise.all([
    db.orgMembership.count({ where: { orgId: org.id } }),
    codeCounts(codesOf(org.id), now),
  ]);
  return {
    id: org.id, name: org.name, kind: org.kind, kindLabel: ORG_KINDS[org.kind], joinCode: formatCode(org.joinCode), createdAt: org.createdAt,
    families, codes,
    key: { name: key.name, access: key.access },
  };
}

export const CodesQuery = z.object({
  status: z.enum(CODE_STATUSES, { message: "status must be AVAILABLE, REDEEMED, CANCELLED or EXPIRED." }).optional(),
  batchId: z.string().optional(),
  limit: z.coerce.number().int().min(1, "limit must be 1 to 500.").max(500, "limit must be 1 to 500.").default(100),
  /** The `next` value from the previous page */
  after: z.string().optional(),
});

export async function listCodes(orgId: string, q: z.infer<typeof CodesQuery>) {
  const now = new Date();
  const rows = await db.voucher.findMany({
    where: {
      AND: [
        codesOf(orgId),
        q.status ? statusWhere(q.status, now) : {},
        q.batchId ? { batchId: q.batchId } : {},
        q.after ? { code: { gt: normalizeCode(q.after) } } : {},
      ],
    },
    orderBy: { code: "asc" }, take: q.limit + 1, include: { batch: true },
  });
  const page = rows.slice(0, q.limit);
  return { codes: page.map((v) => codeJson(v, now.getTime())), next: rows.length > q.limit ? formatCode(page.at(-1)!.code) : null };
}

/** By id, or by the code itself (any case, with or without dashes). */
export async function findCode(orgId: string, idOrCode: string) {
  const v = await db.voucher.findFirst({
    where: { AND: [codesOf(orgId), { OR: [{ id: idOrCode }, { code: normalizeCode(idOrCode) }] }] },
    include: { batch: true },
  });
  if (!v) throw notFound("Code");
  return v;
}

export async function cancelCodeByApi({ org, key }: ApiCaller, idOrCode: string) {
  const v = await findCode(org.id, idOrCode);
  await cancelOrgCode(org.id, v.id);
  const creator = await db.user.findUnique({ where: { id: key.createdById }, select: { familyId: true } });
  if (creator) await audit(creator.familyId, `API key "${key.name}"`, "org.code.cancelled", `${formatCode(v.code)} for ${org.name}`);
  return codeJson(await findCode(org.id, v.id));
}

export async function listBatches(orgId: string) {
  const now = new Date();
  const batches = await db.voucherBatch.findMany({ where: { orgId, state: { not: "EXPIRED" } }, orderBy: { createdAt: "desc" } });
  return {
    batches: await Promise.all(batches.map(async (b) => ({
      id: b.id, plan: b.plan, planName: planById(b.plan as PaidPlanId).name, months: b.months, quantity: b.quantity,
      /** Centavos */
      amount: b.amount, currency: "PHP",
      state: b.state, createdAt: b.createdAt, paidAt: b.paidAt,
      codes: b.state === "PENDING" ? null : await codeCounts({ batchId: b.id }, now),
    }))),
  };
}

const dayKey = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const ActivityQuery = z.object({
  days: z.coerce.number().int().min(1, `days must be 1 to ${ORG_EVENT_RETENTION_DAYS}.`).max(ORG_EVENT_RETENTION_DAYS, `days must be 1 to ${ORG_EVENT_RETENTION_DAYS}.`).default(ORG_EVENT_RETENTION_DAYS),
  timezone: z.string().default("Asia/Manila").refine((tz) => { try { dayKey(new Date(), tz); return true; } catch { return false; } }, "timezone must be an IANA time zone, e.g. Asia/Manila."),
});

/** Daily counts of families joining and leaving and codes redeemed and cancelled. Counts only; no families. */
export async function activity(orgId: string, q: z.infer<typeof ActivityQuery>, now = new Date()) {
  const keys = Array.from({ length: q.days }, (_, i) => dayKey(new Date(now.getTime() - (q.days - 1 - i) * 864e5), q.timezone));
  const since = new Date(now.getTime() - (q.days + 1) * 864e5);
  const events = await db.orgEvent.findMany({ where: { orgId, createdAt: { gte: since } }, select: { kind: true, createdAt: true } });
  const days = new Map(keys.map((date) => [date, { date, joined: 0, left: 0, redeemed: 0, cancelled: 0 }]));
  const field = { JOINED: "joined", LEFT: "left", REDEEMED: "redeemed", CANCELLED: "cancelled" } as const;
  for (const e of events) {
    const d = days.get(dayKey(e.createdAt, q.timezone));
    const f = field[e.kind as keyof typeof field];
    if (d && f) d[f]++;
  }
  return { timezone: q.timezone, days: [...days.values()] };
}
