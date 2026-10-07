import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { pageByTime } from "./paging";

/**
 * What the staff console reads (docs/console.md). Account-level only: plans, members, counts, purchases, tickets
 * and organizations. Never a child's location, browsing, app use, alerts or photos.
 */

export const PAGE = 50;

/** Ticket states staff can set. Parents' tickets start OPEN. */
export const TICKET_STATUSES = ["OPEN", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const isTicketStatus = (v: unknown): v is TicketStatus => TICKET_STATUSES.includes(v as TicketStatus);

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

export async function overview() {
  const [families, parents, children, devices, browsers, plans, week, month, openTickets, organizations] = await Promise.all([
    db.family.count(),
    db.user.count(),
    db.child.count(),
    db.device.count(),
    db.browserInstallation.count(),
    db.family.groupBy({ by: ["plan"], _count: { _all: true }, orderBy: { plan: "asc" } }),
    db.family.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    db.family.count({ where: { createdAt: { gte: daysAgo(30) } } }),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.organization.count(),
  ]);
  return {
    families, parents, children, devices, browsers, week, month, openTickets, organizations,
    plans: plans.map((p) => ({ plan: p.plan, families: p._count._all })),
  };
}

/** Families newest first, optionally matching a parent's email or name, or the family's name or id. */
export async function searchFamilies(q: string, before?: Date) {
  const term = q.trim();
  const match: Prisma.FamilyWhereInput = term
    ? {
      OR: [
        { id: term },
        { name: { contains: term, mode: "insensitive" } },
        { users: { some: { OR: [{ email: { contains: term, mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }] } } },
      ],
    }
    : {};
  return pageByTime(
    PAGE,
    (createdAt, take) => db.family.findMany({
      where: { ...match, createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, name: true, plan: true, createdAt: true,
        users: { select: { email: true, role: true }, orderBy: { createdAt: "asc" } },
        _count: { select: { children: true, devices: true } },
      },
    }),
    (f) => f.createdAt,
    before,
  );
}

export async function familyDetail(id: string) {
  return db.family.findUnique({
    where: { id },
    select: {
      id: true, name: true, plan: true, deviceLimit: true, renewsAt: true, timezone: true, createdAt: true,
      paymongoCustomerId: true, keepLocationHistory: true, retentionDays: true,
      users: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, name: true, email: true, role: true, emailVerifiedAt: true, passwordSet: true, twoFactor: true, createdAt: true,
          identities: { select: { provider: true } },
          sessions: { select: { lastSeenAt: true }, orderBy: { lastSeenAt: "desc" }, take: 1 },
        },
      },
      _count: { select: { children: true, devices: true, browsers: true, places: true } },
      devices: { select: { platform: true, kind: true } },
      purchases: {
        orderBy: { createdAt: "desc" },
        select: { id: true, store: true, productId: true, state: true, autoRenewing: true, expiresAt: true, createdAt: true },
      },
      supportTickets: { orderBy: { createdAt: "desc" }, select: { id: true, subject: true, category: true, status: true, createdAt: true } },
      orgMemberships: { select: { joinedAt: true, org: { select: { id: true, name: true } } } },
      vouchers: { select: { code: true, redeemedAt: true, revokedAt: true, batch: { select: { plan: true, months: true, org: { select: { id: true, name: true } } } } } },
    },
  });
}

export async function listTickets(status: TicketStatus | null, before?: Date) {
  return pageByTime(
    PAGE,
    (createdAt, take) => db.supportTicket.findMany({
      where: { ...(status ? { status } : {}), createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, subject: true, category: true, status: true, createdAt: true,
        family: { select: { id: true, name: true } }, user: { select: { email: true } },
      },
    }),
    (t) => t.createdAt,
    before,
  );
}

export async function ticketDetail(id: string) {
  return db.supportTicket.findUnique({
    where: { id },
    select: {
      id: true, subject: true, category: true, message: true, status: true, createdAt: true,
      family: { select: { id: true, name: true, plan: true } }, user: { select: { name: true, email: true } },
    },
  });
}

export async function listOrganizations(before?: Date) {
  return pageByTime(
    PAGE,
    (createdAt, take) => db.organization.findMany({
      where: { createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, name: true, kind: true, createdAt: true, _count: { select: { members: true, memberships: true, batches: true } } },
    }),
    (o) => o.createdAt,
    before,
  );
}

export async function organizationDetail(id: string) {
  const org = await db.organization.findUnique({
    where: { id },
    select: {
      id: true, name: true, kind: true, joinCode: true, createdAt: true,
      members: { orderBy: { createdAt: "asc" }, select: { role: true, createdAt: true, user: { select: { name: true, email: true, familyId: true } } } },
      _count: { select: { memberships: true, apiKeys: true } },
      batches: {
        orderBy: { createdAt: "desc" },
        select: { id: true, plan: true, months: true, quantity: true, amount: true, state: true, paidAt: true, createdAt: true },
      },
    },
  });
  if (!org) return null;
  const used = await db.voucher.groupBy({
    by: ["batchId"],
    where: { batchId: { in: org.batches.map((b) => b.id) }, redeemedAt: { not: null } },
    _count: { _all: true },
  });
  const redeemed = new Map(used.map((u) => [u.batchId, u._count._all]));
  return { ...org, batches: org.batches.map((b) => ({ ...b, redeemed: redeemed.get(b.id) ?? 0 })) };
}

export async function listAudit(before?: Date) {
  return pageByTime(
    PAGE,
    (createdAt, take) => db.staffAuditLog.findMany({
      where: { createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, action: true, target: true, detail: true, createdAt: true, staff: { select: { name: true, email: true } } },
    }),
    (a) => a.createdAt,
    before,
  );
}
