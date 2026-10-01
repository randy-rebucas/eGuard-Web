import { randomInt, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { type PaidPlanId, planById, webPrice, webProductFor } from "../src/lib/plans";

/**
 * The demo organization (a school) with an owner account, a joined family, and two paid batches of sponsor
 * codes, three of them redeemed by small sponsored families. Used by prisma/seed.ts (local development).
 * Only creates rows; callers decide what, if anything, to delete first. Organizations aren't deleted with a
 * family, so delete them separately.
 */

const TZ = "Asia/Manila";
const DAY = 864e5;
/** Same alphabet as src/lib/organizations.ts (no 0, 1, I or O) */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = (length: number) => Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const addMonths = (d: Date, months: number) => { const r = new Date(d); r.setMonth(r.getMonth() + months); return r; };

/** The families that redeemed a code. Each has one parent (Family Admin) and no children yet. */
const SPONSORED = [
  { family: "Reyes Family", email: "reyes@example.com", name: "Carlo Reyes", daysAgo: 18 },
  { family: "Garcia Family", email: "garcia@example.com", name: "Liza Garcia", daysAgo: 12 },
  { family: "Bautista Family", email: "bautista@example.com", name: "Jun Bautista", daysAgo: 4 },
];

export type DemoOrganizationInput = {
  /** The organization owner, in their own new family */
  owner: { email: string; name: string; passwordHash: string };
  /** Existing users added as admins */
  adminUserIds?: string[];
  /** Existing families that joined with the join code */
  joinedFamilyIds?: string[];
  /** Fixed join code (8 characters from the alphabet above), or random */
  joinCode?: string;
};

export async function createDemoOrganization(db: PrismaClient, { owner, adminUserIds = [], joinedFamilyIds = [], joinCode }: DemoOrganizationInput) {
  const ago = (days: number) => new Date(Date.now() - days * DAY);

  // The owner is a parent too: organization admins stay in their own family
  const ownerFamily = await db.family.create({ data: { name: `${owner.name.split(" ").pop()} Family`, timezone: TZ } });
  const ownerUser = await db.user.create({
    data: {
      familyId: ownerFamily.id, email: owner.email, name: owner.name, passwordHash: owner.passwordHash,
      role: "FAMILY_ADMIN", emailVerifiedAt: new Date(),
    },
  });

  const org = await db.organization.create({
    data: {
      name: "San Isidro Elementary School", kind: "SCHOOL", joinCode: joinCode ?? randomCode(8), createdAt: ago(30),
      members: {
        create: [
          { userId: ownerUser.id, role: "OWNER", createdAt: ago(30) },
          ...adminUserIds.map((userId) => ({ userId, role: "ADMIN" as const, createdAt: ago(25) })),
        ],
      },
      memberships: { create: joinedFamilyIds.map((familyId) => ({ familyId, joinedAt: ago(21) })) },
    },
  });

  const batch = async (plan: PaidPlanId, months: number, quantity: number, paidDaysAgo: number) => {
    const paidAt = ago(paidDaysAgo);
    const id = randomUUID();
    const codes = new Set<string>();
    while (codes.size < quantity) codes.add(randomCode(12));
    await db.voucherBatch.create({
      data: {
        id, orgId: org.id, plan, months, quantity, amount: webPrice(plan) * months * quantity,
        purchaseToken: `cs_demo_${id}`, state: "PAID", paymentId: `pay_demo_${id}`, paidAt,
        createdBy: ownerUser.id, checkedAt: paidAt, createdAt: paidAt,
        vouchers: { create: [...codes].map((code) => ({ code, expiresAt: addMonths(paidAt, 12) })) },
      },
    });
    return db.voucher.findMany({ where: { batchId: id }, orderBy: { code: "asc" } });
  };

  // eGuard Plus for 3 months × 10: three redeemed, one cancelled, six available
  const plus = await batch("PLUS", 3, 10, 20);
  const plusPlan = planById("PLUS");
  for (const [i, s] of SPONSORED.entries()) {
    const redeemedAt = ago(s.daysAgo);
    const expiresAt = addMonths(redeemedAt, 3);
    const family = await db.family.create({
      data: {
        name: s.family, timezone: TZ, plan: plusPlan.name, deviceLimit: plusPlan.entitlements.deviceLimit, renewsAt: expiresAt,
        createdAt: redeemedAt,
        users: { create: { email: s.email, name: s.name, passwordHash: owner.passwordHash, role: "FAMILY_ADMIN", emailVerifiedAt: redeemedAt, notifyEmail: false } },
        orgMemberships: { create: { orgId: org.id, joinedAt: redeemedAt } },
        alerts: {
          create: {
            severity: "INFO", category: "SYSTEM", icon: "crown", subject: "Subscription", createdAt: redeemedAt,
            title: `Welcome to ${plusPlan.name}`,
            body: `Your family can now protect up to ${plusPlan.entitlements.childLimit} children on ${plusPlan.entitlements.deviceLimit} devices.`,
          },
        },
      },
    });
    const v = plus[i];
    await db.voucher.update({ where: { id: v.id }, data: { redeemedAt, familyId: family.id } });
    await db.storePurchase.create({
      data: {
        familyId: family.id, store: "VOUCHER", productId: webProductFor("PLUS", false).id,
        purchaseToken: `voucher:${v.id}`, state: "PAID", autoRenewing: false, expiresAt, checkedAt: redeemedAt, createdAt: redeemedAt,
      },
    });
  }
  await db.voucher.update({ where: { id: plus[SPONSORED.length].id }, data: { revokedAt: ago(10) } });

  // Family Pro for 1 month × 5, bought this week: all available
  const pro = await batch("PRO", 1, 5, 2);

  // Activity for the admins' daily email (no digest sent yet, so the next maintenance run sends one)
  await db.orgEvent.createMany({
    data: [
      ...joinedFamilyIds.map(() => ({ orgId: org.id, kind: "JOINED", createdAt: ago(21) })),
      ...SPONSORED.flatMap((s) => [
        { orgId: org.id, kind: "JOINED", createdAt: ago(s.daysAgo) },
        { orgId: org.id, kind: "REDEEMED", createdAt: ago(s.daysAgo) },
      ]),
      { orgId: org.id, kind: "CANCELLED", createdAt: ago(10) },
    ],
  });

  return {
    org, owner: ownerUser,
    availablePlusCode: plus[SPONSORED.length + 1].code,
    availableProCode: pro[0].code,
  };
}
