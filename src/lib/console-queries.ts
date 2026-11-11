import "server-only";
import type { Platform, Prisma } from "@prisma/client";
import { db } from "./db";
import { pageByTime } from "./paging";
import { OFFLINE_AFTER_MS } from "./health";
import { CLOSED_STATES, ENTITLED_STATES, openPurchases } from "./entitlement";
import { STAFF_IDLE_MS } from "./console-host";

/**
 * What the staff console reads (docs/console.md). Account-level only: plans, members, counts, purchases, tickets
 * and organizations, plus devices' technical state (model, versions, last seen, protection check results).
 * Never a child's location, browsing, app use, screen time, photos, the contents of a parent's rules, or the text of
 * a family's alerts: those appear only as counts.
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
    // A browser eGuard disconnected for security is gone for the family too (lib/device-slots)
    db.browserInstallation.count({ where: { revokedAt: null } }),
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
      _count: { select: { children: true, devices: true, browsers: { where: { revokedAt: null } }, places: true } },
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
        family: { select: { id: true, name: true, plan: true } }, user: { select: { email: true } },
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

/** Email broadcasts (console › Email): what staff wrote and how sending went. No family's data beyond the address. */
export async function listBroadcasts(before?: Date) {
  return pageByTime(
    PAGE,
    (createdAt, take) => db.broadcast.findMany({
      where: { createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, audience: true, kind: true, subject: true, status: true, plans: true, scheduledAt: true, finishedAt: true, recipients: true, createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    (b) => b.createdAt,
    before,
  );
}

export async function broadcastDetail(id: string) {
  return db.broadcast.findUnique({ where: { id }, include: { createdBy: { select: { name: true, email: true } } } });
}

/** The latest emails that failed or were skipped, with why */
export async function broadcastProblems(broadcastId: string, take = 50) {
  return db.broadcastDelivery.findMany({
    where: { broadcastId, status: { in: ["FAILED", "SKIPPED"] } },
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, email: true, status: true, error: true, updatedAt: true },
  });
}

/* ---------- Accounts: parents, children, subscriptions ---------- */

const lastActive = { select: { lastSeenAt: true }, orderBy: { lastSeenAt: "desc" }, take: 1 } as const;

/** Parents newest first, optionally matching email, name, user id or family id. */
export async function searchParents(q: string, before?: Date) {
  const term = q.trim();
  const match: Prisma.UserWhereInput = term
    ? { OR: [{ id: term }, { familyId: term }, { email: { contains: term, mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }] }
    : {};
  return pageByTime(
    PAGE,
    (createdAt, take) => db.user.findMany({
      where: { ...match, createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, name: true, email: true, role: true, emailVerifiedAt: true, passwordSet: true, twoFactor: true, createdAt: true,
        family: { select: { id: true, name: true, plan: true } },
        identities: { select: { provider: true } },
        sessions: lastActive,
      },
    }),
    (u) => u.createdAt,
    before,
  );
}

/** Children newest first: first name, birth year and what's paired. Nothing they did. */
export async function listChildren(q: string, before?: Date) {
  const term = q.trim();
  const match: Prisma.ChildWhereInput = term
    ? { OR: [{ id: term }, { familyId: term }, { name: { contains: term, mode: "insensitive" } }, { family: { name: { contains: term, mode: "insensitive" } } }] }
    : {};
  return pageByTime(
    PAGE,
    (createdAt, take) => db.child.findMany({
      where: { ...match, createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, name: true, birthYear: true, createdAt: true,
        family: { select: { id: true, name: true, plan: true } },
        _count: { select: { devices: true, browsers: { where: { revokedAt: null } } } },
      },
    }),
    (c) => c.createdAt,
    before,
  );
}

export const SUBSCRIPTION_FILTERS = ["active", "expiring", "lapsed", "closed"] as const;
export type SubscriptionFilter = (typeof SUBSCRIPTION_FILTERS)[number];
export const isSubscriptionFilter = (v: unknown): v is SubscriptionFilter => SUBSCRIPTION_FILTERS.includes(v as SubscriptionFilter);
export const STORES = ["GOOGLE_PLAY", "PAYMONGO"] as const;
export const isStore = (v: unknown): v is (typeof STORES)[number] => STORES.includes(v as (typeof STORES)[number]);

/** In the paid period now (past_due's short grace aside: lib/entitlement isEntitled is the exact rule). */
const activeWhere = (now: Date): Prisma.StorePurchaseWhereInput => ({ state: { in: ENTITLED_STATES }, expiresAt: { gt: now } });

function subscriptionWhere(filter: SubscriptionFilter | null, now: Date): Prisma.StorePurchaseWhereInput {
  switch (filter) {
    case "active": return activeWhere(now);
    // Ends within 7 days and won't renew by itself
    case "expiring": return { ...activeWhere(now), autoRenewing: false, expiresAt: { gt: now, lte: new Date(now.getTime() + 7 * 864e5) } };
    case "lapsed": return { state: { notIn: CLOSED_STATES }, expiresAt: { lte: now } };
    case "closed": return { state: { in: CLOSED_STATES } };
    default: return {};
  }
}

export async function listSubscriptions(filter: SubscriptionFilter | null, store: string | null, before?: Date) {
  const where = { ...subscriptionWhere(filter, new Date()), ...(store ? { store } : {}) };
  return pageByTime(
    PAGE,
    (createdAt, take) => db.storePurchase.findMany({
      where: { ...where, createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, store: true, productId: true, state: true, autoRenewing: true, expiresAt: true, checkedAt: true, createdAt: true,
        family: { select: { id: true, name: true, plan: true } },
      },
    }),
    (p) => p.createdAt,
    before,
  );
}

export async function subscriptionSummary() {
  const now = new Date();
  const [byProduct, active, expiring, renewing, lapsed30] = await Promise.all([
    db.storePurchase.groupBy({ by: ["store", "productId"], where: activeWhere(now), _count: { _all: true }, orderBy: [{ store: "asc" }, { productId: "asc" }] }),
    db.storePurchase.count({ where: activeWhere(now) }),
    db.storePurchase.count({ where: subscriptionWhere("expiring", now) }),
    db.storePurchase.count({ where: { ...activeWhere(now), autoRenewing: true } }),
    db.storePurchase.count({ where: { state: { notIn: CLOSED_STATES }, expiresAt: { lte: now, gt: new Date(now.getTime() - 30 * 864e5) } } }),
  ]);
  return { active, expiring, renewing, lapsed30, byProduct: byProduct.map((r) => ({ store: r.store, productId: r.productId, n: r._count._all })) };
}

/* ---------- Devices and diagnostics: technical state only ---------- */

export const DEVICE_FILTERS = ["offline", "never", "removing"] as const;
export type DeviceFilter = (typeof DEVICE_FILTERS)[number];
export const isDeviceFilter = (v: unknown): v is DeviceFilter => DEVICE_FILTERS.includes(v as DeviceFilter);
export const PLATFORMS: Platform[] = ["ANDROID", "IOS", "WINDOWS", "MACOS"];
export const isPlatform = (v: unknown): v is Platform => PLATFORMS.includes(v as Platform);

const offlineSince = () => new Date(Date.now() - OFFLINE_AFTER_MS);

function deviceWhere(filter: DeviceFilter | null, platform: Platform | null): Prisma.DeviceWhereInput {
  const state: Prisma.DeviceWhereInput =
    filter === "offline" ? { lastSeenAt: { lt: offlineSince() } }
      : filter === "never" ? { lastSeenAt: null }
        : filter === "removing" ? { removalRequestedAt: { not: null } }
          : {};
  return { ...state, ...(platform ? { platform } : {}) };
}

export async function listDevices(filter: DeviceFilter | null, platform: Platform | null, before?: Date) {
  const where = deviceWhere(filter, platform);
  return pageByTime(
    PAGE,
    (createdAt, take) => db.device.findMany({
      where: { ...where, createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, name: true, model: true, kind: true, platform: true, osVersion: true, appVersion: true, lastSeenAt: true,
        removalRequestedAt: true, simulated: true, createdAt: true,
        child: { select: { name: true } }, family: { select: { id: true, name: true } },
      },
    }),
    (d) => d.createdAt,
    before,
  );
}

export const BROWSER_FILTERS = ["offline", "revoked"] as const;
export type BrowserFilter = (typeof BROWSER_FILTERS)[number];
export const isBrowserFilter = (v: unknown): v is BrowserFilter => BROWSER_FILTERS.includes(v as BrowserFilter);

export async function listBrowsers(filter: BrowserFilter | null, before?: Date) {
  const where: Prisma.BrowserInstallationWhereInput =
    filter === "revoked" ? { revokedAt: { not: null } }
      : filter === "offline" ? { revokedAt: null, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: offlineSince() } }] }
        : {};
  return pageByTime(
    PAGE,
    (createdAt, take) => db.browserInstallation.findMany({
      where: { ...where, createdAt },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, deviceLabel: true, browser: true, browserVersion: true, extensionVersion: true, platform: true, protectionState: true,
        appliedPolicyVersion: true, lastHealthAt: true, lastSeenAt: true, revokedAt: true, createdAt: true, deviceId: true,
        child: { select: { name: true, browserPolicy: { select: { version: true } } } }, family: { select: { id: true, name: true } },
      },
    }),
    (b) => b.createdAt,
    before,
  );
}

/**
 * One device's technical state, for console › Device diagnostics. Protection results come with their status and
 * message only (not the `reported` values), and change requests with their state and failure reason (not the
 * settings asked for). Whether it has a push token, never the token.
 */
export async function deviceDiagnostics(id: string) {
  const d = await db.device.findUnique({
    where: { id },
    select: {
      id: true, name: true, model: true, kind: true, platform: true, osVersion: true, appVersion: true, battery: true, isPrimary: true,
      lastSeenAt: true, checkRequestedAt: true, pushToken: true, simulated: true, removalRequestedAt: true, accounts: true, createdAt: true,
      child: { select: { id: true, name: true } },
      family: { select: { id: true, name: true, plan: true } },
      protections: { orderBy: { key: "asc" }, select: { key: true, status: true, message: true, lastVerifiedAt: true } },
      browsers: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, browser: true, browserVersion: true, extensionVersion: true, protectionState: true, appliedPolicyVersion: true,
          lastHealthAt: true, lastSeenAt: true, revokedAt: true, child: { select: { browserPolicy: { select: { version: true } } } },
        },
      },
    },
  });
  if (!d) return null;
  const [requestCounts, requests, checks] = await Promise.all([
    db.configRequest.groupBy({ by: ["status"], where: { deviceId: id }, _count: { _all: true } }),
    db.configRequest.findMany({
      where: { deviceId: id, status: { in: ["PENDING", "DELIVERED", "AWAITING_PARENT", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, key: true, mode: true, status: true, failureReason: true, createdAt: true, deliveredAt: true },
    }),
    db.checkRunResult.findMany({
      where: { deviceId: id },
      orderBy: { run: { createdAt: "desc" } },
      take: 10,
      select: { reachable: true, issues: true, reportedAt: true, run: { select: { createdAt: true, status: true } } },
    }),
  ]);
  const { pushToken, accounts, ...rest } = d;
  const list = Array.isArray(accounts) ? (accounts as { enforced?: unknown }[]) : null;
  return {
    ...rest,
    hasPushToken: !!pushToken,
    // Computers: how many Windows accounts it reported and in how many the child's rules apply (not their names)
    accounts: list ? { total: list.length, enforced: list.filter((a) => a?.enforced === true).length } : null,
    requestCounts: requestCounts.map((r) => ({ status: r.status, n: r._count._all })),
    requests,
    checks,
  };
}

/** The fleet at a glance: versions, devices gone quiet, and browsers behind on their rules. */
export async function diagnosticsSummary() {
  const since = offlineSince();
  const [platforms, appVersions, osVersions, total, offline, never, noPush, removing, browsers, browserStates, extensionVersions, behind, quiet] = await Promise.all([
    db.device.groupBy({ by: ["platform"], _count: { _all: true } }),
    db.device.groupBy({ by: ["platform", "appVersion"], _count: { _all: true }, orderBy: [{ platform: "asc" }, { appVersion: "desc" }] }),
    db.device.groupBy({ by: ["platform", "osVersion"], _count: { _all: true }, orderBy: [{ platform: "asc" }, { osVersion: "desc" }] }),
    db.device.count(),
    db.device.count({ where: { lastSeenAt: { lt: since } } }),
    db.device.count({ where: { lastSeenAt: null } }),
    // Phones and tablets wake on a push; computers' agent polls
    db.device.count({ where: { pushToken: null, kind: { not: "COMPUTER" }, simulated: false } }),
    db.device.count({ where: { removalRequestedAt: { not: null } } }),
    db.browserInstallation.count({ where: { revokedAt: null } }),
    db.browserInstallation.groupBy({ by: ["protectionState"], where: { revokedAt: null }, _count: { _all: true } }),
    db.browserInstallation.groupBy({ by: ["extensionVersion"], where: { revokedAt: null }, _count: { _all: true }, orderBy: { extensionVersion: "desc" } }),
    db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "BrowserInstallation" b JOIN "BrowserPolicy" p ON p."childId" = b."childId"
      WHERE b."revokedAt" IS NULL AND (b."appliedPolicyVersion" IS NULL OR b."appliedPolicyVersion" < p.version)`,
    // Went quiet in the last 30 days: likely still in use, worth a look
    db.device.findMany({
      where: { lastSeenAt: { lt: since, gt: new Date(Date.now() - 30 * 864e5) } },
      orderBy: { lastSeenAt: "desc" },
      take: 25,
      select: { id: true, name: true, model: true, platform: true, appVersion: true, lastSeenAt: true, family: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    total, offline, never, noPush, removing, browsers,
    platforms: platforms.map((r) => ({ platform: r.platform, n: r._count._all })),
    appVersions: appVersions.map((r) => ({ platform: r.platform, version: r.appVersion, n: r._count._all })),
    osVersions: osVersions.map((r) => ({ platform: r.platform, version: r.osVersion, n: r._count._all })),
    browserStates: browserStates.map((r) => ({ state: r.protectionState, n: r._count._all })),
    extensionVersions: extensionVersions.map((r) => ({ version: r.extensionVersion, n: r._count._all })),
    behindOnPolicy: behind[0]?.n ?? 0,
    quiet,
  };
}

/** How many children use each rule, never what the rules say (no sites, apps, times or config values). */
export async function policySummary() {
  const [children, byKey, browser, youtube, unknownSites] = await Promise.all([
    db.child.count(),
    db.childPolicy.groupBy({ by: ["key"], _count: { _all: true }, orderBy: { key: "asc" } }),
    db.$queryRaw<{ total: number; safeSearch: number; safeBrowsing: number; scheduled: number; withBlocked: number; withAllowed: number; avgCategories: number }[]>`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE "safeSearch")::int AS "safeSearch",
        count(*) FILTER (WHERE "safeBrowsing")::int AS "safeBrowsing",
        count(*) FILTER (WHERE schedule->>'enabled' = 'true')::int AS scheduled,
        count(*) FILTER (WHERE cardinality("blockedDomains") > 0)::int AS "withBlocked",
        count(*) FILTER (WHERE cardinality("allowedDomains") > 0)::int AS "withAllowed",
        coalesce(round(avg(cardinality("blockedCategories"))::numeric, 1), 0)::float AS "avgCategories"
      FROM "BrowserPolicy"`,
    db.browserPolicy.groupBy({ by: ["youtubeRestrict"], _count: { _all: true } }),
    db.browserPolicy.groupBy({ by: ["unknownSitesPolicy"], _count: { _all: true } }),
  ]);
  return {
    children,
    byKey: byKey.map((r) => ({ key: r.key, n: r._count._all })),
    browser: browser[0] ?? { total: 0, safeSearch: 0, safeBrowsing: 0, scheduled: 0, withBlocked: 0, withAllowed: 0, avgCategories: 0 },
    youtube: youtube.map((r) => ({ value: r.youtubeRestrict, n: r._count._all })),
    unknownSites: unknownSites.map((r) => ({ value: r.unknownSitesPolicy, n: r._count._all })),
  };
}

/** A change no device has picked up or confirmed in this long is stuck. */
export const STUCK_REQUEST_HOURS = 24;
const stuckWhere = (): Prisma.ConfigRequestWhereInput => ({
  status: { in: ["PENDING", "DELIVERED"] },
  createdAt: { lt: new Date(Date.now() - STUCK_REQUEST_HOURS * 3600_000) },
});

/** Configuration Health across every device: check results per protection, and how parents' changes are landing. */
export async function configHealth() {
  const week = daysAgo(7);
  const [matrix, requests, stuckCount, stuck, failed, longChecks] = await Promise.all([
    db.deviceProtection.groupBy({ by: ["key", "status"], _count: { _all: true } }),
    db.configRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.configRequest.count({ where: stuckWhere() }),
    db.configRequest.findMany({
      where: stuckWhere(),
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { id: true, key: true, mode: true, status: true, createdAt: true, device: { select: { id: true, name: true, platform: true, lastSeenAt: true } } },
    }),
    db.configRequest.groupBy({
      by: ["key", "failureReason"], where: { status: "FAILED", createdAt: { gte: week } }, _count: { _all: true },
      orderBy: { _count: { id: "desc" } }, take: 30,
    }),
    db.checkRun.count({ where: { status: "RUNNING", createdAt: { lt: new Date(Date.now() - 15 * 60_000) } } }),
  ]);
  return {
    matrix: matrix.map((r) => ({ key: r.key, status: r.status, n: r._count._all })),
    requests: requests.map((r) => ({ status: r.status, n: r._count._all })),
    stuckCount, stuck, longChecks,
    failed: failed.map((r) => ({ key: r.key, reason: r.failureReason, n: r._count._all })),
  };
}

/* ---------- Alerts: what needs staff, and families' alert volume as counts ---------- */

/** The maintenance job runs every 10 minutes; this long without a run means it stopped. */
export const MAINTENANCE_STALE_MS = 30 * 60_000;

/** Problems for the eGuard team: failed background work, stuck changes, purchases not re-checked, old open tickets. */
export async function opsAlerts() {
  const now = Date.now(), day = new Date(now - 864e5), week = daysAgo(7), twoDays = new Date(now - 2 * 864e5);
  const [lastRun, failedRuns, deadJobs, deadJobReasons, retrying, failedEmails, uncheckedPurchases, uncheckedList, stuck, revokedBrowsers, oldTickets] = await Promise.all([
    db.maintenanceRun.findFirst({ orderBy: { startedAt: "desc" }, select: { startedAt: true, ms: true, failed: true } }),
    db.maintenanceRun.findMany({ where: { startedAt: { gte: day }, failed: { isEmpty: false } }, orderBy: { startedAt: "desc" }, take: 20, select: { id: true, startedAt: true, failed: true } }),
    db.parentCareJob.count({ where: { status: "DEAD", updatedAt: { gte: week } } }),
    db.parentCareJob.groupBy({
      by: ["automationKey", "lastError"], where: { status: "DEAD", updatedAt: { gte: week } }, _count: { _all: true },
      orderBy: { _count: { id: "desc" } }, take: 10,
    }),
    db.parentCareJob.count({ where: { status: "PENDING", attempts: { gt: 0 } } }),
    db.broadcastDelivery.groupBy({ by: ["broadcastId"], where: { status: "FAILED", updatedAt: { gte: week } }, _count: { _all: true } }),
    db.storePurchase.count({ where: { ...openPurchases(), checkedAt: { lt: twoDays } } }),
    db.storePurchase.findMany({
      where: { ...openPurchases(), checkedAt: { lt: twoDays } }, orderBy: { checkedAt: "asc" }, take: 10,
      select: { id: true, store: true, productId: true, state: true, checkedAt: true, family: { select: { id: true, name: true } } },
    }),
    db.configRequest.count({ where: stuckWhere() }),
    db.browserInstallation.count({ where: { revokedAt: { gte: week } } }),
    db.supportTicket.count({ where: { status: "OPEN", createdAt: { lt: twoDays } } }),
  ]);
  const subjects = failedEmails.length
    ? new Map((await db.broadcast.findMany({ where: { id: { in: failedEmails.map((f) => f.broadcastId) } }, select: { id: true, subject: true } })).map((b) => [b.id, b.subject]))
    : new Map<string, string>();
  return {
    lastRun,
    cronStale: !lastRun || now - lastRun.startedAt.getTime() > MAINTENANCE_STALE_MS,
    failedRuns,
    deadJobs, retrying,
    deadJobReasons: deadJobReasons.map((r) => ({ automation: r.automationKey, error: r.lastError, n: r._count._all })),
    failedEmails: failedEmails.map((f) => ({ broadcastId: f.broadcastId, subject: subjects.get(f.broadcastId) ?? "(deleted)", n: f._count._all })),
    uncheckedPurchases, uncheckedList, stuck, revokedBrowsers, oldTickets,
  };
}

/** Families' alerts as counts by category and severity: never a title, body or who it was about. */
export async function familyAlertVolume() {
  const [day, week, unresolved] = await Promise.all([
    db.alert.groupBy({ by: ["category", "severity"], where: { createdAt: { gte: daysAgo(1) } }, _count: { _all: true } }),
    db.alert.groupBy({ by: ["category", "severity"], where: { createdAt: { gte: daysAgo(7) } }, _count: { _all: true } }),
    db.alert.groupBy({ by: ["severity"], where: { resolvedAt: null, severity: { in: ["CRITICAL", "ACTION_REQUIRED"] } }, _count: { _all: true } }),
  ]);
  const flat = (rows: typeof day) => rows.map((r) => ({ category: r.category, severity: r.severity, n: r._count._all }));
  return { day: flat(day), week: flat(week), unresolved: unresolved.map((r) => ({ severity: r.severity, n: r._count._all })) };
}

/* ---------- Platform: security, flags, status ---------- */

export async function securityOverview() {
  const now = new Date();
  const [staff, sessions, logins, staffLimits, parents, twoFactor, admins, adminsTwoFactor, noPassword, providers, scopes] = await Promise.all([
    db.staffUser.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, active: true, lastLoginAt: true, createdAt: true } }),
    db.staffSession.findMany({
      where: { expiresAt: { gt: now }, lastSeenAt: { gt: new Date(now.getTime() - STAFF_IDLE_MS) } },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, userAgent: true, ip: true, createdAt: true, lastSeenAt: true, expiresAt: true, staff: { select: { name: true, email: true } } },
    }),
    db.staffAuditLog.count({ where: { action: "staff.login", createdAt: { gte: daysAgo(7) } } }),
    // Failed staff sign-ins still counting: by email (staff:acct:…) or by address (staff:ip:…)
    db.rateLimit.findMany({ where: { key: { startsWith: "staff:" }, resetAt: { gt: now } }, orderBy: { count: "desc" }, take: 50, select: { key: true, count: true, resetAt: true } }),
    db.user.count(),
    db.user.count({ where: { twoFactor: true } }),
    db.user.count({ where: { role: "FAMILY_ADMIN" } }),
    db.user.count({ where: { role: "FAMILY_ADMIN", twoFactor: true } }),
    db.user.count({ where: { passwordSet: false } }),
    db.oAuthIdentity.groupBy({ by: ["provider"], _count: { _all: true } }),
    // Which limits are in force across the site right now, by scope (login, signup, …): no keys, so no emails or addresses
    db.$queryRaw<{ scope: string; n: number }[]>`
      SELECT split_part(key, ':', 1) AS scope, count(*)::int AS n FROM "RateLimit" WHERE "resetAt" > now() GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
  ]);
  return {
    staff, sessions, logins, staffLimits, scopes,
    parents: { total: parents, twoFactor, admins, adminsTwoFactor, noPassword, providers: providers.map((p) => ({ provider: p.provider, n: p._count._all })) },
  };
}

export async function listFlags() {
  return db.featureFlag.findMany({
    orderBy: { key: "asc" },
    select: { key: true, description: true, enabled: true, rollout: true, updatedAt: true, createdAt: true, updatedBy: { select: { name: true } } },
  });
}

/** Whether each setting the server depends on is present. Never the values. */
export function configReadiness(env: Record<string, string | undefined> = process.env) {
  const has = (...keys: string[]) => keys.every((k) => !!env[k]?.trim());
  return [
    { name: "Two-step codes (TWO_FACTOR_KEY)", ok: has("TWO_FACTOR_KEY"), required: true },
    { name: "Maintenance job secret (CRON_SECRET)", ok: has("CRON_SECRET"), required: true },
    { name: "Email (RESEND_API_KEY or SMTP_URL)", ok: has("RESEND_API_KEY") || has("SMTP_URL"), required: true },
    { name: "Browser policy signing (BROWSER_POLICY_SIGNING_KEY)", ok: has("BROWSER_POLICY_SIGNING_KEY"), required: true },
    { name: "Push notifications (FCM_SERVICE_ACCOUNT)", ok: has("FCM_SERVICE_ACCOUNT"), required: false },
    { name: "PayMongo (PAYMONGO_SECRET_KEY, PAYMONGO_PUBLIC_KEY)", ok: has("PAYMONGO_SECRET_KEY", "PAYMONGO_PUBLIC_KEY"), required: false },
    { name: "PayMongo webhooks (PAYMONGO_WEBHOOK_SECRET)", ok: has("PAYMONGO_WEBHOOK_SECRET"), required: false },
    { name: "Google Play (GOOGLE_PLAY_PACKAGE_NAME, GOOGLE_PLAY_SERVICE_ACCOUNT)", ok: has("GOOGLE_PLAY_PACKAGE_NAME", "GOOGLE_PLAY_SERVICE_ACCOUNT"), required: false },
    { name: "reCAPTCHA (RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY)", ok: has("RECAPTCHA_SITE_KEY", "RECAPTCHA_SECRET_KEY"), required: false },
    { name: "Write with AI (ANTHROPIC_API_KEY or OPENAI_API_KEY)", ok: has("ANTHROPIC_API_KEY") || has("OPENAI_API_KEY"), required: false },
  ];
}

export async function systemStatus() {
  const t = performance.now();
  let dbMs: number | null = null;
  try { await db.$queryRaw`SELECT 1`; dbMs = Math.round(performance.now() - t); } catch { /* shown as unreachable */ }
  const [runs, migration, unfinished] = dbMs === null ? [[], [], []] : await Promise.all([
    db.maintenanceRun.findMany({ orderBy: { startedAt: "desc" }, take: 30, select: { id: true, startedAt: true, ms: true, failed: true, result: true } }),
    db.$queryRaw<{ name: string; at: Date }[]>`
      SELECT migration_name AS name, finished_at AS at FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC LIMIT 1`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
  ]);
  const last = runs[0] ?? null;
  return {
    dbMs, runs,
    cronStale: !last || Date.now() - last.startedAt.getTime() > MAINTENANCE_STALE_MS,
    migration: migration[0] ?? null,
    unfinishedMigrations: unfinished[0]?.n ?? 0,
    config: configReadiness(),
    deployment: {
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
  };
}

/** The Overview's operational tiles. */
export async function overviewOps() {
  const now = new Date();
  const [activeSubs, offline, lastRun, flagsOn, stuck] = await Promise.all([
    db.storePurchase.count({ where: activeWhere(now) }),
    db.device.count({ where: { lastSeenAt: { lt: offlineSince() } } }),
    db.maintenanceRun.findFirst({ orderBy: { startedAt: "desc" }, select: { startedAt: true, failed: true } }),
    db.featureFlag.count({ where: { enabled: true } }),
    db.configRequest.count({ where: stuckWhere() }),
  ]);
  return { activeSubs, offline, lastRun, flagsOn, stuck, cronStale: !lastRun || now.getTime() - lastRun.startedAt.getTime() > MAINTENANCE_STALE_MS };
}

/* ---------- Charts: counts per day (console › Dashboard, Alerts) ---------- */

/** Days are counted in Philippine time, as every console time is shown (app/console/format). */
const CONSOLE_TZ = "Asia/Manila";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: CONSOLE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** The last `n` days as YYYY-MM-DD, oldest first, today last. */
export function lastDays(n: number, now = new Date()) {
  return Array.from({ length: n }, (_, i) => dayKey.format(new Date(now.getTime() - (n - 1 - i) * 864e5)));
}

/** Tables counted per day by createdAt: a fixed list, so the name put in the SQL is never input. */
type PerDayTable = "Family" | "Device" | "SupportTicket";
const daySql = `to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE '${CONSOLE_TZ}', 'YYYY-MM-DD')`;

async function perDay(table: PerDayTable, days: number) {
  const rows = await db.$queryRawUnsafe<{ d: string; n: number }[]>(
    `SELECT ${daySql} AS d, count(*)::int AS n FROM "${table}" WHERE "createdAt" >= $1 GROUP BY 1`,
    new Date(Date.now() - (days + 1) * 864e5),
  );
  const by = new Map(rows.map((r) => [r.d, r.n]));
  return lastDays(days).map((day) => ({ day, n: by.get(day) ?? 0 }));
}

/** The Dashboard's charts: sign-ups, pairings and tickets per day for 30 days, and devices by platform. */
export async function overviewTrends(days = 30) {
  const [families, devices, tickets, platforms] = await Promise.all([
    perDay("Family", days),
    perDay("Device", days),
    perDay("SupportTicket", days),
    db.device.groupBy({ by: ["platform"], _count: { _all: true } }),
  ]);
  return { families, devices, tickets, platforms: platforms.map((p) => ({ platform: p.platform, n: p._count._all })) };
}

/** Families' alerts per day by severity: counts only. */
export async function alertsPerDay(days = 14) {
  const rows = await db.$queryRawUnsafe<{ d: string; severity: string; n: number }[]>(
    `SELECT ${daySql} AS d, severity::text AS severity, count(*)::int AS n FROM "Alert" WHERE "createdAt" >= $1 GROUP BY 1, 2`,
    new Date(Date.now() - (days + 1) * 864e5),
  );
  const by = new Map<string, Record<string, number>>();
  for (const r of rows) by.set(r.d, { ...by.get(r.d), [r.severity]: r.n });
  return lastDays(days).map((day) => ({ day, values: by.get(day) ?? {} }));
}
