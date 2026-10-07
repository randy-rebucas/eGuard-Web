import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import type { OrgKind, VoucherBatch } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { ServiceError, conflict, forbidden, invalid, isUniqueViolation, notFound } from "./errors";
import { audit } from "./audit";
import { isPendingInvite } from "./auth";
import type { Actor } from "./config-service";
import { appUrl, requireVerifiedEmail } from "./email-verification";
import { LIMITS, enforce } from "./rate-limit";
import { shortDate } from "./format";
import { type PaidPlanId, planById, planByProduct, webPrice, webProductFor } from "./plans";
import { batchDiscount, discountedCodePrice } from "./batch-discount";
import { applyEntitlement, currentPurchase, isEntitled } from "./entitlement";
import { lockPaidTime, passMethods, type WebBillingOpts } from "./web-billing";
import { type PaymongoConfig, createCheckoutSession, getCheckoutSession, paidPayment, paymongoConfig } from "./paymongo";
import * as notify from "./org-notifications";

/**
 * Organizations (schools, communities, businesses), their join codes, and sponsor codes that pay for
 * families' plans. See docs/organizations.md. The one rule: an organization never sees a family's data,
 * only counts. Nothing here returns which family redeemed a code or joined, to an organization.
 */

/** How a redeemed sponsor code is stored as a StorePurchase. */
export const VOUCHER_STORE = "VOUCHER";

export const ORG_KINDS: Record<OrgKind, string> = { SCHOOL: "School", COMMUNITY: "Community group", BUSINESS: "Business" };
export const CODE_MONTHS = [1, 3, 6, 12] as const;
export const MAX_CODES_PER_BATCH = 200;
const MAX_ORGS_PER_USER = 10;
const MAX_ORGS_PER_FAMILY = 5;
/** Codes can be redeemed for this long after the batch is paid. */
const REDEEM_WITHIN_MONTHS = 12;
/** A checkout nobody paid within a day is abandoned. */
const ABANDONED_MS = 24 * 3600_000;

/* ---------- Codes ---------- */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = (length: number) => Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
/** "K7PQ2M9X" → "K7PQ-2M9X" */
export const formatCode = (code: string) => code.match(/.{1,4}/g)!.join("-");
/** What people type or paste: any case, spaces or dashes. */
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");
const JOIN_CODE_LENGTH = 8;
const VOUCHER_CODE_LENGTH = 12;

/* ---------- Validation ---------- */

export const OrgSchema = z.object({
  name: z.string().trim().min(2, "Enter the organization's name.").max(80, "Use a shorter name (up to 80 characters)."),
  kind: z.enum(["SCHOOL", "COMMUNITY", "BUSINESS"], { message: "Choose what kind of organization it is." }),
});

export const BatchSchema = z.object({
  plan: z.enum(["PLUS", "PRO"], { message: "Choose a plan." }),
  months: z.coerce.number().refine((m) => (CODE_MONTHS as readonly number[]).includes(m), "Choose 1, 3, 6 or 12 months."),
  quantity: z.coerce.number().int("Enter a whole number of codes.").min(1, "Buy at least 1 code.").max(MAX_CODES_PER_BATCH, `Buy up to ${MAX_CODES_PER_BATCH} codes at a time.`),
});

/**
 * Price of one code, in centavos: the plan's monthly web price for each month, less the volume discount for
 * a batch of `quantity` codes.
 */
export const codePrice = (plan: PaidPlanId, months: number, quantity = 1) => discountedCodePrice(webPrice(plan) * months, quantity);

export type CodeStatus = "AVAILABLE" | "REDEEMED" | "CANCELLED" | "EXPIRED";
export const codeStatus = (v: { redeemedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = Date.now()): CodeStatus =>
  v.redeemedAt ? "REDEEMED" : v.revokedAt ? "CANCELLED" : v.expiresAt.getTime() <= now ? "EXPIRED" : "AVAILABLE";

/* ---------- Access ---------- */

/** The caller's role in the organization. Anyone else gets "not found", so organizations can't be probed. */
export async function requireOrgAdmin(userId: string, orgId: string, { owner = false } = {}) {
  const m = await db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
  if (!m) throw notFound("Organization");
  if (owner && m.role !== "OWNER") throw forbidden("Only an owner of this organization can do this.");
  return m;
}

const requireFamilyAdmin = (actor: Actor, what: string) => {
  if (actor.role !== "FAMILY_ADMIN") throw forbidden(`Only the family admin can ${what}.`);
};

/* ---------- Organizations ---------- */

export async function createOrganization(actor: Actor, input: z.infer<typeof OrgSchema>) {
  const { name, kind } = OrgSchema.parse(input);
  await requireVerifiedEmail(actor.id, "create an organization");
  for (let attempt = 0; ; attempt++) {
    try {
      const org = await db.$transaction(async (tx) => {
        // Count and create under one lock per person, so two tabs can't both pass the limit
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org.manage:${actor.id}`}))`;
        if ((await tx.orgMember.count({ where: { userId: actor.id } })) >= MAX_ORGS_PER_USER) throw conflict(`You can manage up to ${MAX_ORGS_PER_USER} organizations.`);
        return tx.organization.create({
          data: { name, kind, joinCode: randomCode(JOIN_CODE_LENGTH), members: { create: { userId: actor.id, role: "OWNER" } } },
        });
      });
      await audit(actor.familyId, actor.name, "org.created", `${org.name} (${org.id})`);
      return org;
    } catch (e) {
      if (!isUniqueViolation(e) || attempt >= 3) throw e;
    }
  }
}

/** Replaces the join code. Families who already joined stay; the old code stops working. */
export async function replaceJoinCode(actor: Actor, orgId: string) {
  await requireOrgAdmin(actor.id, orgId);
  for (let attempt = 0; ; attempt++) {
    try {
      const org = await db.organization.update({ where: { id: orgId }, data: { joinCode: randomCode(JOIN_CODE_LENGTH) } });
      await notify.notifyJoinCodeReplaced(org, formatCode(org.joinCode), actor);
      return { joinCode: formatCode(org.joinCode) };
    } catch (e) {
      if (!isUniqueViolation(e) || attempt >= 3) throw e;
    }
  }
}

/** Owners add another eGuard user, by the email they sign in with, as an admin. */
export async function addOrgAdmin(actor: Actor, orgId: string, email: string) {
  await requireOrgAdmin(actor.id, orgId, { owner: true });
  const address = z.string().trim().toLowerCase().email("Enter a valid email address.").parse(email);
  const user = await db.user.findUnique({ where: { email: address } });
  // An invitation they haven't accepted isn't an account they can sign in with
  if (!user || isPendingInvite(user)) throw invalid("There's no eGuard account with that email. Ask them to sign up first, then add them.");
  const existing = await db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId: user.id } } });
  if (existing) throw conflict(`${user.name} already manages this organization.`);
  const managed = await db.orgMember.count({ where: { userId: user.id } });
  if (managed >= MAX_ORGS_PER_USER) throw conflict(`${user.name} already manages ${MAX_ORGS_PER_USER} organizations.`);
  const { org } = await db.orgMember.create({ data: { orgId, userId: user.id, role: "ADMIN" }, include: { org: true } }).catch((e) => {
    // Added at the same moment by another owner or tab
    if (isUniqueViolation(e)) throw conflict(`${user.name} already manages this organization.`);
    throw e;
  });
  await notify.notifyAdminAdded(org, user.id, actor);
  return { name: user.name };
}

/** Owners remove anyone; admins can remove themselves. The last owner stays, so an organization is never orphaned. */
export async function removeOrgAdmin(actor: Actor, orgId: string, userId: string) {
  const me = await requireOrgAdmin(actor.id, orgId);
  if (userId !== actor.id && me.role !== "OWNER") throw forbidden("Only an owner of this organization can remove admins.");
  const target = await db.$transaction(async (tx) => {
    // One change to the admin list at a time: two owners removing each other at once would otherwise both see
    // "another owner is left" and leave the organization, and its paid codes, with no owner
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org.members:${orgId}`}))`;
    const t = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } }, include: { org: true, user: true } });
    if (!t) throw notFound("Admin");
    if (t.role === "OWNER" && (await tx.orgMember.count({ where: { orgId, role: "OWNER" } })) <= 1) {
      throw conflict("An organization needs at least one owner. Make someone else an owner first.");
    }
    await tx.orgMember.delete({ where: { orgId_userId: { orgId, userId } } });
    return t;
  });
  // Their API keys stop working with them
  await db.orgApiKey.updateMany({ where: { orgId, createdById: userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await notify.notifyAdminRemoved(target.org, target.user, actor);
}

/** Owners make another admin an owner too. */
export async function makeOrgOwner(actor: Actor, orgId: string, userId: string) {
  await requireOrgAdmin(actor.id, orgId, { owner: true });
  const target = await db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } }, include: { org: true } });
  if (!target) throw notFound("Admin");
  if (target.role === "OWNER") return;
  await db.orgMember.update({ where: { orgId_userId: { orgId, userId } }, data: { role: "OWNER" } });
  await notify.notifyOwnerMade(target.org, userId, actor);
}

/**
 * Before users are deleted: an organization whose only owner is leaving gets its longest-serving admin as
 * owner, so paid codes are never stranded. With no one left, the organization stays for support to handle.
 */
export async function handOverOrganizations(userIds: string[]) {
  const owned = await db.orgMember.findMany({ where: { userId: { in: userIds }, role: "OWNER" } });
  for (const { orgId } of owned) {
    const remaining = await db.orgMember.findMany({ where: { orgId, userId: { notIn: userIds } }, orderBy: { createdAt: "asc" } });
    if (remaining.some((m) => m.role === "OWNER") || !remaining.length) continue;
    const { org } = await db.orgMember.update({ where: { orgId_userId: { orgId, userId: remaining[0].userId } }, data: { role: "OWNER" }, include: { org: true } });
    await notify.notifyOwnerMade(org, remaining[0].userId, null, userIds);
  }
}

/** Organizations the user manages, with counts only. */
export async function managedOrganizations(userId: string) {
  const rows = await db.orgMember.findMany({
    where: { userId }, orderBy: { createdAt: "asc" },
    include: { org: { include: { _count: { select: { memberships: true } } } } },
  });
  return rows.map((m) => ({ id: m.org.id, name: m.org.name, kind: m.org.kind, role: m.role, families: m.org._count.memberships }));
}

/** Everything an organization admin sees: counts, codes and admins. Never which family joined or redeemed. */
export async function organizationView(actor: Actor, orgId: string) {
  const me = await requireOrgAdmin(actor.id, orgId);
  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      _count: { select: { memberships: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      batches: {
        where: { state: { in: ["PAID", "VOIDED", "PENDING"] } }, orderBy: { createdAt: "desc" },
        include: { vouchers: { orderBy: { code: "asc" }, select: { id: true, code: true, expiresAt: true, redeemedAt: true, revokedAt: true } } },
      },
    },
  });
  const now = Date.now();
  const status = (v: { redeemedAt: Date | null; revokedAt: Date | null; expiresAt: Date }) => codeStatus(v, now);
  const batches = org.batches.map((b) => ({
    id: b.id, plan: planById(b.plan as PaidPlanId).name, months: b.months, quantity: b.quantity, amount: b.amount,
    state: b.state, paidAt: b.paidAt, createdAt: b.createdAt,
    codes: b.vouchers.map((v) => ({ id: v.id, code: formatCode(v.code), expiresAt: v.expiresAt, redeemedAt: v.redeemedAt, status: status(v) })),
  }));
  const codes = batches.flatMap((b) => b.codes);
  return {
    id: org.id, name: org.name, kind: org.kind, joinCode: formatCode(org.joinCode), role: me.role,
    families: org._count.memberships,
    totals: {
      bought: codes.length,
      redeemed: codes.filter((c) => c.status === "REDEEMED").length,
      available: codes.filter((c) => c.status === "AVAILABLE").length,
    },
    batches,
    admins: org.members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role, you: m.userId === actor.id })),
  };
}

/* ---------- Joining ---------- */

async function orgByJoinCode(actor: Actor, code: string) {
  await enforce(`joincode:${actor.id}`, LIMITS.joinCodeUser, "You've tried several codes. Wait a few minutes and try again.");
  const joinCode = normalizeCode(code);
  const org = joinCode.length === JOIN_CODE_LENGTH ? await db.organization.findUnique({ where: { joinCode } }) : null;
  if (!org) throw invalid("That code doesn't match an organization. Check it with whoever gave it to you.");
  return org;
}

/** A join code as typed by the parent (dashes and spaces allowed; normalizeCode cleans it). */
export const JoinCodeInput = z.object({ code: z.string().trim().min(1, "Enter the code you were given.").max(40) });

/** What joining shares. Shown before joining and on the family's list, on the web and in the app. */
export const ORG_PRIVACY = "An organization only ever sees how many families joined, never anything about yours.";
export const joinNotice = (org: string) =>
  `${org} will see that one more family joined. It never sees your family's name, children, devices, settings, activity or location. You can leave at any time.`;

/** Step 1 of joining: who the code belongs to, so the family admin can confirm. */
export async function previewJoin(actor: Actor, code: string) {
  requireFamilyAdmin(actor, "join an organization");
  const org = await orgByJoinCode(actor, code);
  const joined = await db.orgMembership.findUnique({ where: { orgId_familyId: { orgId: org.id, familyId: actor.familyId } } });
  return { name: org.name, kind: ORG_KINDS[org.kind], kindKey: org.kind, alreadyJoined: !!joined };
}

/** Step 2: join. Joining again is fine. */
export async function joinOrganization(actor: Actor, code: string) {
  requireFamilyAdmin(actor, "join an organization");
  const org = await orgByJoinCode(actor, code);
  const existing = await db.orgMembership.findUnique({ where: { orgId_familyId: { orgId: org.id, familyId: actor.familyId } } });
  if (existing) return { name: org.name };
  try {
    await db.$transaction(async (tx) => {
      // Count and join under one lock per family: two codes entered at once can't both pass the limit
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org.join:${actor.familyId}`}))`;
      if ((await tx.orgMembership.count({ where: { familyId: actor.familyId } })) >= MAX_ORGS_PER_FAMILY) {
        throw conflict(`A family can join up to ${MAX_ORGS_PER_FAMILY} organizations. Leave one to join another.`);
      }
      await tx.orgMembership.create({ data: { orgId: org.id, familyId: actor.familyId } });
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return { name: org.name }; // joined at the same moment in another request, which tells everyone
  }
  await audit(actor.familyId, actor.name, "org.joined", org.name);
  await notify.notifyFamilyJoined(org, actor);
  return { name: org.name };
}

export async function leaveOrganization(actor: Actor, orgId: string) {
  requireFamilyAdmin(actor, "leave an organization");
  const m = await db.orgMembership.findUnique({ where: { orgId_familyId: { orgId, familyId: actor.familyId } }, include: { org: true } });
  if (!m) throw notFound("Organization");
  const r = await db.orgMembership.deleteMany({ where: { orgId, familyId: actor.familyId } });
  if (!r.count) return { name: m.org.name }; // left at the same moment in another request
  await audit(actor.familyId, actor.name, "org.left", m.org.name);
  await notify.notifyFamilyLeft(m.org, actor);
  return { name: m.org.name };
}

/** The organizations a family joined, for its own settings page. */
export async function familyOrganizations(familyId: string) {
  const rows = await db.orgMembership.findMany({ where: { familyId }, include: { org: true }, orderBy: { joinedAt: "asc" } });
  return rows.map((m) => ({ id: m.org.id, name: m.org.name, kind: m.org.kind, kindLabel: ORG_KINDS[m.org.kind], joinedAt: m.joinedAt }));
}

/* ---------- Buying codes ---------- */

const cfgOf = (o: WebBillingOpts) => (o.cfg !== undefined ? o.cfg : paymongoConfig());
function requireConfig(o: WebBillingOpts): PaymongoConfig {
  const cfg = cfgOf(o);
  if (!cfg) throw new ServiceError(501, "Online payment isn't set up on this server yet.", "billing_not_configured");
  return cfg;
}

/** Starts a PayMongo checkout for a batch of sponsor codes. Codes are created once it's paid. */
export async function buyCodes(actor: Actor, orgId: string, input: { plan: string; months: number | string; quantity: number | string }, o: WebBillingOpts = {}) {
  await requireOrgAdmin(actor.id, orgId);
  const cfg = requireConfig(o);
  // PayMongo sends the receipt to this address: a mistyped, unverified one would lose it
  await requireVerifiedEmail(actor.id, "buy sponsor codes");
  const { plan, months, quantity } = BatchSchema.parse(input);
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  const p = planById(plan);
  const each = codePrice(plan, months, quantity);
  const discount = batchDiscount(quantity);
  const id = randomUUID();
  const length = `${months} month${months === 1 ? "" : "s"}`;
  const cs = await createCheckoutSession(cfg, {
    name: `${p.name} sponsor code: ${length}`,
    description: `${quantity} code${quantity === 1 ? "" : "s"} for ${org.name}. Each gives one family ${p.name} for ${length}.${discount ? ` Includes a ${discount}% volume discount.` : ""}`,
    amount: each, quantity,
    methods: passMethods(),
    email: user.email,
    reference: id,
    successUrl: `${appUrl()}/organizations/${orgId}?batch=${id}`,
    cancelUrl: `${appUrl()}/organizations/${orgId}`,
    metadata: { orgId, batchId: id },
  }, o.fetch);
  await db.voucherBatch.create({
    data: { id, orgId, plan, months, quantity, amount: each * quantity, purchaseToken: cs.id, createdBy: actor.id },
  });
  return { batchId: id, checkoutUrl: cs.attributes.checkout_url };
}

/** Re-reads a pending batch's checkout. On payment, creates its codes exactly once. */
export async function syncBatch(b: VoucherBatch, o: WebBillingOpts = {}) {
  if (b.state !== "PENDING") return;
  const cfg = requireConfig(o);
  const now = o.now ?? new Date();
  const cs = (await getCheckoutSession(cfg, b.purchaseToken, o.fetch)).attributes;
  const pay = paidPayment(cs);
  // Codes only for the full price: a payment for less (never expected from our own checkout) makes none
  if (pay && pay.attributes.amount < b.amount) {
    console.error(`Batch ${b.id}: PayMongo payment ${pay.id} is ${pay.attributes.amount} centavos, the batch costs ${b.amount}. No codes created.`);
    await db.voucherBatch.update({ where: { id: b.id }, data: { checkedAt: now } });
  } else if (pay) {
    const expiresAt = addMonths(now, REDEEM_WITHIN_MONTHS);
    // Conditional, so the webhook and the admin's return from checkout can't both create codes
    const won = await db.$transaction(async (tx) => {
      const won = await tx.voucherBatch.updateMany({ where: { id: b.id, state: "PENDING" }, data: { state: "PAID", paymentId: pay.id, paidAt: now, checkedAt: now } });
      if (!won.count) return false;
      const codes = new Set<string>();
      while (codes.size < b.quantity) codes.add(randomCode(VOUCHER_CODE_LENGTH));
      await tx.voucher.createMany({ data: [...codes].map((code) => ({ batchId: b.id, code, expiresAt })) });
      return true;
    });
    if (won) await notify.notifyBatchPaid(b.id);
  } else if (cs.status === "expired" || now.getTime() - b.createdAt.getTime() > ABANDONED_MS) {
    const r = await db.voucherBatch.updateMany({ where: { id: b.id, state: "PENDING" }, data: { state: "EXPIRED", checkedAt: now } });
    if (r.count) await notify.notifyBatchExpired(await db.voucherBatch.findUniqueOrThrow({ where: { id: b.id }, include: { org: true } }));
  } else {
    await db.voucherBatch.update({ where: { id: b.id }, data: { checkedAt: now } });
  }
}

/** Back from checkout (/organizations/{id}?batch=…): checks the payment now rather than waiting for the webhook. */
export async function confirmBatchReturn(actor: Actor, orgId: string, batchId: string, o: WebBillingOpts = {}) {
  await requireOrgAdmin(actor.id, orgId);
  const b = await db.voucherBatch.findFirst({ where: { id: batchId, orgId } });
  if (!b) return null;
  if (b.state === "PENDING") {
    try {
      await syncBatch(b, o);
    } catch (e) {
      if (!(e instanceof ServiceError)) throw e;
    }
  }
  const latest = await db.voucherBatch.findUniqueOrThrow({ where: { id: b.id } });
  return { status: latest.state === "PAID" ? "paid" as const : latest.state === "PENDING" ? "pending" as const : "failed" as const, quantity: latest.quantity };
}

/** For the maintenance job: batches whose payment we haven't seen yet, re-checked at most every 10 minutes. */
export async function refreshPendingBatches(o: WebBillingOpts = {}) {
  if (!cfgOf(o)) return 0;
  const now = o.now ?? new Date();
  const due = await db.voucherBatch.findMany({ where: { state: "PENDING", checkedAt: { lt: new Date(now.getTime() - 10 * 60_000) } } });
  for (const b of due) {
    try {
      await syncBatch(b, o);
    } catch (e) {
      if (!(e instanceof ServiceError)) throw e;
    }
  }
  return due.length;
}

/** PayMongo webhook for a checkout session: returns true if it was a batch of codes. */
export async function handleBatchCheckout(checkoutId: string, o: WebBillingOpts = {}) {
  const b = await db.voucherBatch.findUnique({ where: { purchaseToken: checkoutId } });
  if (!b) return false;
  await syncBatch(b, o);
  return true;
}

/**
 * A refund of a batch's payment: the batch is voided and its unused codes cancelled. Plans already
 * redeemed keep running; a family shouldn't lose protection over something between us and the organization.
 */
export async function handleBatchRefund(paymentId: string, now = new Date()) {
  const batches = await db.voucherBatch.findMany({ where: { paymentId, state: { not: "VOIDED" } }, include: { org: true } });
  for (const b of batches) {
    const [voided, cancelled] = await db.$transaction([
      db.voucherBatch.updateMany({ where: { id: b.id, state: { not: "VOIDED" } }, data: { state: "VOIDED", checkedAt: now } }),
      db.voucher.updateMany({ where: { batchId: b.id, redeemedAt: null, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    // Refund webhooks can arrive more than once; tell admins the first time
    if (voided.count) await notify.notifyBatchRefunded(b, cancelled.count);
  }
  return batches.length > 0;
}

/** Cancels a code that hasn't been used, e.g. one shared by mistake. There's no refund for it. */
export async function cancelCode(actor: Actor, orgId: string, voucherId: string, now = new Date()) {
  await requireOrgAdmin(actor.id, orgId);
  await cancelOrgCode(orgId, voucherId, now);
}

/** For callers that already checked access to the organization (the page, or an API key). */
export async function cancelOrgCode(orgId: string, voucherId: string, now = new Date()) {
  const r = await db.voucher.updateMany({ where: { id: voucherId, batch: { orgId }, redeemedAt: null, revokedAt: null }, data: { revokedAt: now } });
  if (!r.count) throw conflict("That code was already used or cancelled.");
  await notify.recordCodeCancelled(orgId);
}

/** The organization's paid codes as CSV (code, plan, months, status, redeem by). Never who redeemed them. */
export async function codesCsv(actor: Actor, orgId: string) {
  const view = await organizationView(actor, orgId);
  const tz = (await db.family.findUniqueOrThrow({ where: { id: actor.familyId } })).timezone;
  const rows = [["Code", "Plan", "Months", "Status", "Redeem by", "Redeemed on"]];
  for (const b of view.batches) {
    if (b.state === "PENDING") continue;
    for (const c of b.codes) {
      rows.push([c.code, b.plan, String(b.months), c.status.toLowerCase(), shortDate(c.expiresAt, tz), c.redeemedAt ? shortDate(c.redeemedAt, tz) : ""]);
    }
  }
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return { name: view.name, csv: rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n" };
}

/* ---------- Redeeming ---------- */

/**
 * Adds whole months in one step, keeping the day of month where it exists (Nov 30 + 3 = Feb 28, but
 * Dec 30 + 3 = Mar 30). Adding one month at a time would clamp at every short month and lose days.
 */
function addMonths(from: Date, months: number) {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * A family redeems a sponsor code. It becomes a paid StorePurchase (store VOUCHER), so the plan, alerts and
 * the downgrade when it ends all work like a pass. It follows the pass rules: it extends paid time on the same
 * plan, and waits for paid time on another plan, Google Play or auto-renew to end.
 */
export async function redeemCode(actor: Actor, code: string, o: { now?: Date } = {}) {
  requireFamilyAdmin(actor, "redeem a sponsor code");
  await enforce(`voucher:family:${actor.familyId}`, LIMITS.voucherFamily, "You've tried several codes. Wait a few minutes and try again.");
  await enforce(`voucher:user:${actor.id}`, LIMITS.voucherUser, "You've tried several codes. Wait a few minutes and try again.");
  const now = o.now ?? new Date();
  const value = normalizeCode(code);
  const v = value.length === VOUCHER_CODE_LENGTH
    ? await db.voucher.findUnique({ where: { code: value }, include: { batch: { include: { org: true } } } })
    : null;
  if (!v || v.batch.state === "PENDING" || v.batch.state === "EXPIRED") throw invalid("That code isn't valid. Check it with whoever gave it to you.");
  if (v.redeemedAt) throw conflict(v.familyId === actor.familyId ? "Your family already redeemed this code." : "This code has already been used.");
  if (v.revokedAt || v.batch.state === "VOIDED") throw conflict("This code was cancelled by the organization that gave it out.");
  if (v.expiresAt <= now) throw conflict("This code has expired. Ask whoever gave it to you for a new one.");

  const plan = planById(v.batch.plan as PaidPlanId);
  const family = await db.family.findUniqueOrThrow({ where: { id: actor.familyId } });
  const current = await currentPurchase(actor.familyId);
  if (current) {
    const until = shortDate(current.expiresAt!, family.timezone);
    if (current.store === "GOOGLE_PLAY") throw conflict("Your plan is billed through Google Play. Cancel it in the Play Store app, then redeem this code after it ends.");
    if (current.autoRenewing) throw conflict(`Auto-renew is on. Turn it off in Settings › Subscription first; the code's months will start when your paid time ends on ${until}.`);
    const currentPlan = planByProduct(current.productId);
    if (currentPlan && currentPlan.id !== plan.id) throw conflict(`This code is for ${plan.name}, and your ${currentPlan.name} runs until ${until}. Redeem it after that date.`);
  }

  const expiresAt = await db.$transaction(async (tx) => {
    // One at a time per family, with passes too: two codes (or a code and a pass) at once would both start from
    // the same paid-until date and overlap, instead of one starting when the other ends
    await lockPaidTime(tx, actor.familyId);
    const won = await tx.voucher.updateMany({ where: { id: v.id, redeemedAt: null, revokedAt: null }, data: { redeemedAt: now, familyId: actor.familyId } });
    if (!won.count) throw conflict("This code has already been used.");
    // Starts when the family's paid time on the same plan ends, so no paid days are lost
    const same = (await tx.storePurchase.findMany({ where: { familyId: actor.familyId, state: { not: "REPLACED" } } }))
      .filter((p) => planByProduct(p.productId)?.id === plan.id && isEntitled(p, now.getTime()));
    const start = new Date(Math.max(now.getTime(), ...same.map((p) => p.expiresAt!.getTime())));
    const expiresAt = addMonths(start, v.batch.months);
    await tx.storePurchase.create({
      data: {
        familyId: actor.familyId, store: VOUCHER_STORE, productId: webProductFor(plan.id as PaidPlanId, false).id,
        purchaseToken: `voucher:${v.id}`, state: "PAID", autoRenewing: false, expiresAt, checkedAt: now,
      },
    });
    return expiresAt;
  });
  const length = `${v.batch.months} month${v.batch.months === 1 ? "" : "s"}`;
  await audit(actor.familyId, actor.name, "voucher.redeemed", `${plan.name}, ${length}, from ${v.batch.org.name}`);
  await applyEntitlement(actor.familyId);
  await notify.notifyCodeRedeemed(v.batch.org, actor, { plan: plan.name, months: v.batch.months, expiresAt });
  return { plan: plan.name, months: v.batch.months, expiresAt, sponsor: v.batch.org.name };
}

/** Who sponsors the family's current plan, if it comes from a code (for Settings › Subscription). */
export async function sponsorOf(purchase: { store: string; purchaseToken: string } | null) {
  if (!purchase || purchase.store !== VOUCHER_STORE) return null;
  const v = await db.voucher.findUnique({ where: { id: purchase.purchaseToken.replace(/^voucher:/, "") }, include: { batch: { include: { org: true } } } });
  return v?.batch.org.name ?? null;
}
