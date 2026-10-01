import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

// Captures every email instead of sending it
const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/mail", async (orig) => ({
  ...(await orig<typeof import("@/lib/mail")>()),
  sendMail: async (m: { to: string; subject: string; text: string }) => { mail.sent.push(m); },
}));
import {
  addOrgAdmin, buyCodes, cancelCode, codesCsv, confirmBatchReturn, createOrganization, familyOrganizations, handOverOrganizations,
  joinOrganization, leaveOrganization, makeOrgOwner, managedOrganizations, normalizeCode, organizationView, previewJoin,
  redeemCode, removeOrgAdmin, replaceJoinCode, sponsorOf,
} from "@/lib/organizations";
import { sendCodeExpiryReminders, sendOrgDigests } from "@/lib/org-notifications";
import { handlePaymongoEvent } from "@/lib/web-billing";
import { parseWebhookEvent } from "@/lib/paymongo";
import { currentPurchase } from "@/lib/entitlement";
import { webPrice } from "@/lib/plans";
import type { Actor } from "@/lib/config-service";
import { fakePaymongo } from "../fake-paymongo";

/** Organizations, join codes and sponsor codes (docs/organizations.md), against a fake PayMongo and the real database. */

const db = new PrismaClient();
const RUN = `o${Date.now().toString(36)}`;
const DOMAIN = `${RUN}@org-test.example`;
const pm = fakePaymongo();
const opts = { cfg: pm.cfg, fetch: pm.fetch };
const DAY = 864e5;

let owner: Actor, ownerParent: Actor, helper: Actor, outsider: Actor, unverified: Actor;

async function family(name: string, { verified = true } = {}) {
  const f = await db.family.create({
    data: {
      name, plan: "Free", deviceLimit: 2,
      users: { create: [
        { name: `${name} Admin`, email: `admin.${name.toLowerCase()}.${DOMAIN}`, passwordHash: "x", role: "FAMILY_ADMIN", emailVerifiedAt: verified ? new Date() : null },
        { name: `${name} Parent`, email: `parent.${name.toLowerCase()}.${DOMAIN}`, passwordHash: "x", role: "PARENT", emailVerifiedAt: new Date() },
      ] },
    },
    include: { users: true },
  });
  const [a, p] = ["FAMILY_ADMIN", "PARENT"].map((r) => f.users.find((u) => u.role === r)!);
  return [a, p].map((u) => ({ id: u.id, name: u.name, familyId: f.id, role: u.role })) as [Actor, Actor];
}

const fam = (a: Actor) => db.family.findUniqueOrThrow({ where: { id: a.familyId } });
const event = (type: string, resource: { id: string; type: string; attributes?: object }) => parseWebhookEvent(pm.webhook(type, resource).raw)!;

/** Buys and pays for a batch; returns its codes (as shown to the organization). */
async function paidCodes(orgId: string, plan: "PLUS" | "PRO", months: number, quantity: number) {
  const { batchId } = await buyCodes(owner, orgId, { plan, months, quantity }, opts);
  const b = await db.voucherBatch.findUniqueOrThrow({ where: { id: batchId } });
  pm.pay(b.purchaseToken);
  await confirmBatchReturn(owner, orgId, batchId, opts);
  return (await db.voucher.findMany({ where: { batchId } })).map((v) => v.code);
}

beforeAll(async () => {
  [owner, ownerParent] = await family("Cruz");
  [helper] = await family("Bautista");
  [outsider] = await family("Garcia");
  [unverified] = await family("Mendoza", { verified: false });
});
afterAll(async () => {
  const users = await db.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
  await db.organization.deleteMany({ where: { members: { some: { userId: { in: users.map((u) => u.id) } } } } });
  await db.family.deleteMany({ where: { users: { some: { email: { endsWith: DOMAIN } } } } });
  await db.$disconnect();
});

describe("organizations and admins", () => {
  let orgId: string;

  it("needs a verified email to create one; the creator becomes the owner", async () => {
    await expect(createOrganization(unverified, { name: "Barangay Uno", kind: "COMMUNITY" })).rejects.toMatchObject({ status: 403 });
    await expect(createOrganization(owner, { name: "x", kind: "SCHOOL" })).rejects.toThrow();
    const org = await createOrganization(owner, { name: "San Isidro Elementary", kind: "SCHOOL" });
    orgId = org.id;
    expect(org.joinCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(await managedOrganizations(owner.id)).toEqual([expect.objectContaining({ id: orgId, role: "OWNER", families: 0 })]);
  });

  it("hides the organization from anyone who doesn't manage it", async () => {
    await expect(organizationView(outsider, orgId)).rejects.toMatchObject({ status: 404 });
    await expect(buyCodes(outsider, orgId, { plan: "PLUS", months: 1, quantity: 1 }, opts)).rejects.toMatchObject({ status: 404 });
    await expect(codesCsv(outsider, orgId)).rejects.toMatchObject({ status: 404 });
  });

  it("lets owners add admins by the email of an existing account", async () => {
    await expect(addOrgAdmin(owner, orgId, `nobody.${DOMAIN}`)).rejects.toMatchObject({ status: 400 });
    expect(await addOrgAdmin(owner, orgId, `admin.bautista.${DOMAIN}`)).toEqual({ name: "Bautista Admin" });
    await expect(addOrgAdmin(owner, orgId, `admin.bautista.${DOMAIN}`)).rejects.toMatchObject({ status: 409 });
    // Admins can't add or remove others
    await expect(addOrgAdmin(helper, orgId, `admin.garcia.${DOMAIN}`)).rejects.toMatchObject({ status: 403 });
    await expect(removeOrgAdmin(helper, orgId, owner.id)).rejects.toMatchObject({ status: 403 });
    expect((await organizationView(helper, orgId)).admins.map((a) => a.role)).toEqual(["OWNER", "ADMIN"]);
  });

  it("never leaves an organization without an owner", async () => {
    await expect(removeOrgAdmin(owner, orgId, owner.id)).rejects.toMatchObject({ status: 409 });
    await makeOrgOwner(owner, orgId, helper.id);
    await removeOrgAdmin(helper, orgId, helper.id); // an owner can step down once there's another
    // The only owner's account is deleted: the longest-serving admin takes over
    await addOrgAdmin(owner, orgId, `parent.cruz.${DOMAIN}`);
    await handOverOrganizations([owner.id]);
    expect((await db.orgMember.findUniqueOrThrow({ where: { orgId_userId: { orgId, userId: ownerParent.id } } })).role).toBe("OWNER");
    await removeOrgAdmin(owner, orgId, ownerParent.id);
  });
});

describe("joining", () => {
  let orgId: string, code: string;
  beforeAll(async () => {
    const org = await createOrganization(owner, { name: "Parish Youth Ministry", kind: "COMMUNITY" });
    orgId = org.id;
    code = `${org.joinCode.slice(0, 4).toLowerCase()} - ${org.joinCode.slice(4)}`; // how people type it
  });

  it("shows who the code belongs to, then joins; only the family admin can", async () => {
    await expect(previewJoin(ownerParent, code)).rejects.toMatchObject({ status: 403 });
    expect(await previewJoin(helper, code)).toEqual({ name: "Parish Youth Ministry", kind: "Community group", alreadyJoined: false });
    await joinOrganization(helper, code);
    await joinOrganization(helper, code); // again: no error, no duplicate
    expect(await familyOrganizations(helper.familyId)).toEqual([expect.objectContaining({ id: orgId, name: "Parish Youth Ministry" })]);
    expect((await organizationView(owner, orgId)).families).toBe(1);
    await expect(joinOrganization(outsider, "ZZZZ-ZZZZ")).rejects.toMatchObject({ status: 400 });
  });

  it("stops accepting a replaced code, without removing families who joined", async () => {
    const { joinCode } = await replaceJoinCode(owner, orgId);
    await expect(joinOrganization(outsider, code)).rejects.toMatchObject({ status: 400 });
    await joinOrganization(outsider, joinCode);
    expect((await organizationView(owner, orgId)).families).toBe(2);
  });

  it("lets a family leave", async () => {
    await leaveOrganization(helper, orgId);
    expect(await familyOrganizations(helper.familyId)).toEqual([]);
    await expect(leaveOrganization(helper, orgId)).rejects.toMatchObject({ status: 404 });
  });

  it("normalizes typed codes", () => {
    expect(normalizeCode(" k7pq-2m9x ")).toBe("K7PQ2M9X");
  });
});

describe("sponsor codes", () => {
  let orgId: string;
  beforeAll(async () => { orgId = (await createOrganization(owner, { name: "Acme Foods", kind: "BUSINESS" })).id; });

  it("charges quantity × months × monthly price, and creates codes only once paid", async () => {
    await expect(buyCodes(owner, orgId, { plan: "PLUS", months: 2, quantity: 1 }, opts)).rejects.toThrow();
    await expect(buyCodes(owner, orgId, { plan: "PLUS", months: 1, quantity: 201 }, opts)).rejects.toThrow();
    const { batchId, checkoutUrl } = await buyCodes(owner, orgId, { plan: "PLUS", months: 3, quantity: 4 }, opts);
    expect(checkoutUrl).toMatch(/^https:\/\/checkout\.paymongo\.test\//);
    const b = await db.voucherBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(b.amount).toBe(webPrice("PLUS") * 3 * 4);
    expect(await confirmBatchReturn(owner, orgId, batchId, opts)).toEqual({ status: "pending", quantity: 4 });
    expect(await db.voucher.count({ where: { batchId } })).toBe(0);

    const paymentId = pm.pay(b.purchaseToken);
    // The webhook and the admin's return both arrive: codes are created once
    await Promise.all([
      handlePaymongoEvent(event("checkout_session.payment.paid", { id: b.purchaseToken, type: "checkout_session" }), opts),
      confirmBatchReturn(owner, orgId, batchId, opts),
    ]);
    await handlePaymongoEvent(event("checkout_session.payment.paid", { id: b.purchaseToken, type: "checkout_session" }), opts);
    const paid = await db.voucherBatch.findUniqueOrThrow({ where: { id: batchId }, include: { vouchers: true } });
    expect(paid).toMatchObject({ state: "PAID", paymentId });
    expect(paid.vouchers).toHaveLength(4);
    expect(paid.vouchers.every((v) => /^[A-Z2-9]{12}$/.test(v.code))).toBe(true);
    // Redeemable for 12 months
    expect(paid.vouchers[0].expiresAt.getTime() - Date.now()).toBeGreaterThan(360 * DAY);
    const view = await organizationView(owner, orgId);
    expect(view.totals).toEqual({ bought: 4, redeemed: 0, available: 4 });
    expect(view.batches[0].codes[0].code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("expires a checkout nobody paid", async () => {
    const { batchId } = await buyCodes(owner, orgId, { plan: "PRO", months: 1, quantity: 1 }, opts);
    await db.voucherBatch.update({ where: { id: batchId }, data: { createdAt: new Date(Date.now() - 2 * DAY) } });
    expect(await confirmBatchReturn(owner, orgId, batchId, opts)).toEqual({ status: "failed", quantity: 1 });
    expect((await db.voucherBatch.findUniqueOrThrow({ where: { id: batchId } })).state).toBe("EXPIRED");
  });

  it("gives a family the plan for the code's months, and stacks codes for the same plan", async () => {
    const [a, b] = await paidCodes(orgId, "PLUS", 3, 2);
    await expect(redeemCode(ownerParent, a)).rejects.toMatchObject({ status: 403 });
    await expect(redeemCode(helper, "AAAA-BBBB-CCCC")).rejects.toMatchObject({ status: 400 });

    const r = await redeemCode(helper, a.toLowerCase().replace(/(.{4})/g, "$1 "));
    expect(r).toMatchObject({ plan: "eGuard Plus", months: 3, sponsor: "Acme Foods" });
    const f = await fam(helper);
    expect(f).toMatchObject({ plan: "eGuard Plus", deviceLimit: 10 });
    const days = (r.expiresAt.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(88);
    expect(days).toBeLessThan(93);
    expect(await sponsorOf(await currentPurchase(helper.familyId))).toBe("Acme Foods");
    expect(await db.alert.count({ where: { familyId: helper.familyId, title: "Welcome to eGuard Plus" } })).toBe(1);

    await expect(redeemCode(helper, a)).rejects.toMatchObject({ status: 409, message: "Your family already redeemed this code." });
    await expect(redeemCode(outsider, a)).rejects.toMatchObject({ status: 409, message: "This code has already been used." });

    const second = await redeemCode(helper, b);
    expect(Math.round((second.expiresAt.getTime() - r.expiresAt.getTime()) / DAY)).toBeGreaterThanOrEqual(89);
    expect((await organizationView(owner, orgId)).totals.redeemed).toBe(2);
  });

  it("refuses a code for another plan while paid time runs, and over auto-renew or Google Play", async () => {
    const [pro] = await paidCodes(orgId, "PRO", 1, 1);
    await expect(redeemCode(helper, pro)).rejects.toMatchObject({ status: 409 });

    const [played] = await family("Reyes");
    await db.storePurchase.create({ data: { familyId: played.familyId, store: "GOOGLE_PLAY", productId: "eguard_pro", purchaseToken: `gp.${RUN}`, state: "SUBSCRIPTION_STATE_ACTIVE", autoRenewing: true, expiresAt: new Date(Date.now() + 20 * DAY) } });
    await expect(redeemCode(played, pro)).rejects.toMatchObject({ status: 409 });

    const [renewing] = await family("Villanueva");
    await db.storePurchase.create({ data: { familyId: renewing.familyId, store: "PAYMONGO", productId: "pro_monthly", purchaseToken: `subs.${RUN}`, state: "active", autoRenewing: true, expiresAt: new Date(Date.now() + 20 * DAY) } });
    await expect(redeemCode(renewing, pro)).rejects.toMatchObject({ status: 409 });

    // A free family can use it
    expect((await redeemCode(outsider, pro)).plan).toBe("Family Pro");
  });

  it("won't redeem a cancelled or expired code", async () => {
    const [x, y] = await paidCodes(orgId, "PLUS", 1, 2);
    const [free] = await family("Torres");
    const vx = await db.voucher.findUniqueOrThrow({ where: { code: x } });
    await cancelCode(owner, orgId, vx.id);
    await expect(cancelCode(owner, orgId, vx.id)).rejects.toMatchObject({ status: 409 });
    await expect(redeemCode(free, x)).rejects.toMatchObject({ status: 409 });
    await db.voucher.update({ where: { code: y }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(redeemCode(free, y)).rejects.toMatchObject({ status: 409 });
    expect((await fam(free)).plan).toBe("Free");
  });

  it("on refund, cancels unused codes and keeps plans already redeemed", async () => {
    const [used, unused] = await paidCodes(orgId, "PLUS", 1, 2);
    const [free] = await family("Aquino");
    await redeemCode(free, used);
    const batch = await db.voucherBatch.findFirstOrThrow({ where: { vouchers: { some: { code: used } } } });
    // A partial refund changes nothing: the codes stay usable
    expect(await handlePaymongoEvent(event("refund.succeeded", pm.refund(batch.paymentId!, 1000)), opts)).toEqual({ handled: true, partial: true });
    expect((await db.voucherBatch.findUniqueOrThrow({ where: { id: batch.id } })).state).toBe("PAID");
    const r = await handlePaymongoEvent(event("refund.succeeded", pm.refund(batch.paymentId!, batch.amount - 1000)), opts);
    expect(r).toEqual({ handled: true });
    expect((await db.voucherBatch.findUniqueOrThrow({ where: { id: batch.id } })).state).toBe("VOIDED");
    expect((await db.voucher.findUniqueOrThrow({ where: { code: unused } })).revokedAt).not.toBeNull();
    expect((await fam(free)).plan).toBe("eGuard Plus");
    const [another] = await family("Ramos");
    await expect(redeemCode(another, unused)).rejects.toMatchObject({ status: 409 });
  });

  it("never shows the organization who joined or redeemed", async () => {
    const view = JSON.stringify(await organizationView(owner, orgId));
    const csv = (await codesCsv(owner, orgId)).csv;
    const families = await db.family.findMany({ where: { users: { some: { email: { endsWith: DOMAIN } } } }, include: { users: true } });
    for (const f of families) {
      if (f.id === owner.familyId) continue;
      for (const needle of [f.id, f.name, ...f.users.flatMap((u) => [u.email, u.name])]) {
        expect(view).not.toContain(needle);
        expect(csv).not.toContain(needle);
      }
    }
    expect(csv.split("\r\n")[0]).toBe("Code,Plan,Months,Status,Redeem by,Redeemed on");
  });
});

describe("notifications", () => {
  let orgId: string, joinCode: string;
  let lead: Actor, deputy: Actor, member: Actor;
  const addr = (who: string) => `${who}.${DOMAIN}`;
  const inbox = (email: string) => mail.sent.filter((m) => m.to === email).map((m) => m.subject);
  const alerts = (a: Actor) => db.alert.findMany({ where: { familyId: a.familyId }, orderBy: { createdAt: "asc" } }).then((r) => r.map((x) => x.title));

  beforeAll(async () => {
    [lead] = await family("Lim");
    [deputy] = await family("Tan");
    [member] = await family("Santos");
    const org = await createOrganization(lead, { name: "Barangay Malinis", kind: "COMMUNITY" });
    orgId = org.id;
    joinCode = org.joinCode;
  });
  beforeEach(() => { mail.sent.length = 0; });

  it("tells admins when who manages the organization changes", async () => {
    await addOrgAdmin(lead, orgId, addr("admin.tan"));
    expect(inbox(addr("admin.tan"))).toEqual(["You're now an admin of Barangay Malinis on eGuard"]);
    expect(inbox(addr("admin.lim"))).toEqual([]); // not the one who did it

    mail.sent.length = 0;
    const { joinCode: fresh } = await replaceJoinCode(lead, orgId);
    joinCode = fresh;
    expect(inbox(addr("admin.tan"))).toEqual(["Barangay Malinis has a new join code"]);
    expect(mail.sent[0].text).toContain(fresh);

    mail.sent.length = 0;
    await makeOrgOwner(lead, orgId, deputy.id);
    await makeOrgOwner(lead, orgId, deputy.id); // already an owner: nothing new to say
    expect(inbox(addr("admin.tan"))).toEqual(["You're now an owner of Barangay Malinis on eGuard"]);

    mail.sent.length = 0;
    await removeOrgAdmin(deputy, orgId, lead.id);
    expect(inbox(addr("admin.lim"))).toEqual(["You no longer manage Barangay Malinis on eGuard"]);
    await addOrgAdmin(deputy, orgId, addr("admin.lim"));
  });

  it("tells the family, not the organization, who joined and left", async () => {
    await joinOrganization(member, joinCode);
    await joinOrganization(member, joinCode); // again: no second alert
    expect(await alerts(member)).toEqual(["Joined Barangay Malinis"]);
    expect(inbox(addr("parent.santos"))).toEqual(["eGuard: Joined Barangay Malinis"]); // the other parent
    expect(inbox(addr("admin.santos"))).toEqual([]); // the one who joined
    expect(inbox(addr("admin.tan"))).toEqual([]); // admins hear in the daily email

    await leaveOrganization(member, orgId);
    expect((await alerts(member)).at(-1)).toBe("Left Barangay Malinis");
    await joinOrganization(member, joinCode);
  });

  it("tells admins about payments once, and the buyer about unpaid checkouts", async () => {
    const { batchId } = await buyCodes(deputy, orgId, { plan: "PLUS", months: 3, quantity: 2 }, opts);
    const b = await db.voucherBatch.findUniqueOrThrow({ where: { id: batchId } });
    pm.pay(b.purchaseToken);
    await Promise.all([
      handlePaymongoEvent(event("checkout_session.payment.paid", { id: b.purchaseToken, type: "checkout_session" }), opts),
      confirmBatchReturn(deputy, orgId, batchId, opts),
    ]);
    expect(inbox(addr("admin.tan"))).toEqual(["Your 2 codes for Barangay Malinis are ready"]);
    expect(inbox(addr("admin.lim"))).toEqual(["Your 2 codes for Barangay Malinis are ready"]);

    mail.sent.length = 0;
    const unpaid = await buyCodes(deputy, orgId, { plan: "PRO", months: 1, quantity: 1 }, opts);
    await db.voucherBatch.update({ where: { id: unpaid.batchId }, data: { createdAt: new Date(Date.now() - 2 * DAY) } });
    await confirmBatchReturn(deputy, orgId, unpaid.batchId, opts);
    await confirmBatchReturn(deputy, orgId, unpaid.batchId, opts);
    expect(inbox(addr("admin.tan"))).toEqual(["Your order of sponsor codes for Barangay Malinis wasn't completed"]);
    expect(inbox(addr("admin.lim"))).toEqual([]);
  });

  it("confirms a redeemed code to the whole family", async () => {
    const [code] = (await db.voucher.findMany({ where: { batch: { orgId, state: "PAID" }, redeemedAt: null } })).map((v) => v.code);
    await redeemCode(member, code);
    expect(await alerts(member)).toContain("eGuard Plus sponsored by Barangay Malinis");
    expect(inbox(addr("admin.santos"))).toEqual(["eGuard: eGuard Plus sponsored by Barangay Malinis"]);
    expect(inbox(addr("parent.santos"))).toEqual(["eGuard: eGuard Plus sponsored by Barangay Malinis"]);
    expect(mail.sent.filter((m) => m.to.startsWith("admin.tan") || m.to.startsWith("admin.lim"))).toEqual([]);
  });

  it("sends admins one daily email with counts, never names", async () => {
    await db.user.update({ where: { id: lead.id }, data: { notifyEmail: false } }); // turned email alerts off
    await sendOrgDigests();
    const digest = mail.sent.filter((m) => m.to === addr("admin.tan"));
    expect(digest.map((m) => m.subject)).toEqual(["Barangay Malinis: 2 families joined, 1 family left, 1 sponsor code was redeemed"]);
    expect(digest[0].text).toContain("now has 1 family and 1 code ready to hand out");
    for (const needle of ["Santos", member.familyId, addr("admin.santos")]) expect(digest[0].text).not.toContain(needle);
    expect(inbox(addr("admin.lim"))).toEqual([]);

    mail.sent.length = 0;
    await sendOrgDigests(); // nothing new, and not a day later
    expect(inbox(addr("admin.tan"))).toEqual([]);
    await db.user.update({ where: { id: lead.id }, data: { notifyEmail: true } });
  });

  it("warns admins once before unused codes stop working", async () => {
    const soon = new Date(Date.now() + 10 * DAY);
    await db.voucher.updateMany({ where: { batch: { orgId, state: "PAID" }, redeemedAt: null }, data: { expiresAt: soon } });
    await sendCodeExpiryReminders();
    expect(inbox(addr("admin.tan"))).toEqual([expect.stringMatching(/^1 code for Barangay Malinis must be redeemed by /)]);
    mail.sent.length = 0;
    await sendCodeExpiryReminders();
    expect(inbox(addr("admin.tan"))).toEqual([]);
  });

  it("tells admins about a refund and how many codes it cancelled", async () => {
    const batch = await db.voucherBatch.findFirstOrThrow({ where: { orgId, state: "PAID" } });
    const full = pm.refund(batch.paymentId!);
    const refund = () => handlePaymongoEvent(event("refund.succeeded", full), opts);
    await refund();
    await refund(); // delivered twice
    expect(inbox(addr("admin.tan"))).toEqual(["Refund for Barangay Malinis's sponsor codes"]);
    expect(mail.sent.find((m) => m.to === addr("admin.tan"))!.text).toContain("1 code that hadn't been used was cancelled");
  });
});
