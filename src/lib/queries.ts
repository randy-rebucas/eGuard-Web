import "server-only";
import { cache } from "react";
import { db } from "./db";
import { computeHealth, deviceState } from "./health";

/** YYYY-MM-DD for a date in the family's timezone */
export function dayKey(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export const dateFromKey = (k: string) => new Date(`${k}T00:00:00.000Z`);

export function lastNDays(n: number, tz: string, end = new Date()) {
  const todayKey = dayKey(end, tz);
  const base = dateFromKey(todayKey).getTime();
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * 864e5).toISOString().slice(0, 10));
}

export const getFamily = cache(async (familyId: string) => {
  return db.family.findUniqueOrThrow({ where: { id: familyId } });
});

/** Everything the shell and most pages need about children and devices. */
export const getFamilyGraph = cache(async (familyId: string) => {
  const children = await db.child.findMany({
    where: { familyId },
    orderBy: { createdAt: "asc" },
    include: {
      policies: true,
      devices: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        include: { protections: true, location: true },
      },
    },
  });
  const devices = children.flatMap((c) => c.devices.map((d) => ({ ...d, child: { id: c.id, name: c.name, hue: c.hue } })));
  const now = Date.now();
  const kids = children.map((c) => {
    const devs = devices.filter((d) => d.childId === c.id);
    const health = computeHealth(devs, { ownerLabel: (d) => `${c.name}'s ${d.name}` });
    return {
      ...c,
      age: new Date().getFullYear() - c.birthYear,
      devices: devs,
      primary: devs[0] ?? null,
      health,
      status: !devs.length ? ("notconfigured" as const) : health.score === health.total ? ("protected" as const) : ("attention" as const),
    };
  });
  const familyHealth = computeHealth(devices);
  const deviceStates = Object.fromEntries(devices.map((d) => [d.id, deviceState(d, now)]));
  return { children: kids, devices, familyHealth, deviceStates };
});

export type FamilyGraph = Awaited<ReturnType<typeof getFamilyGraph>>;
export type ChildView = FamilyGraph["children"][number];
export type DeviceView = FamilyGraph["devices"][number];

/** Daily screen time per child for the last n days (oldest first). */
export async function getScreenTime(familyId: string, tz: string, n = 14) {
  const days = lastNDays(n, tz);
  const rows = await db.screenTimeDaily.groupBy({
    by: ["childId", "date"],
    where: { child: { familyId }, date: { gte: dateFromKey(days[0]) } },
    _sum: { minutes: true },
  });
  const byChild: Record<string, number[]> = {};
  for (const r of rows) {
    const k = r.date.toISOString().slice(0, 10);
    const i = days.indexOf(k);
    if (i < 0) continue;
    (byChild[r.childId] ??= Array(n).fill(0))[i] = r._sum.minutes ?? 0;
  }
  return { days, byChild };
}

/**
 * Minutes per app on one day, summed across each child's devices, most-used first.
 * (Rows are stored per device so a phone and a tablet don't overwrite each other.)
 */
export async function appMinutesOn(childIds: string[], date: Date) {
  const rows = await db.appUsageDaily.groupBy({
    by: ["childId", "app"], where: { childId: { in: childIds }, date }, _sum: { minutes: true },
  });
  return rows
    .map((r) => ({ childId: r.childId, app: r.app, minutes: r._sum.minutes ?? 0 }))
    .sort((a, b) => b.minutes - a.minutes);
}

export async function getAppUsage(familyId: string, from: string, to: string) {
  return db.appUsageDaily.groupBy({
    by: ["childId", "app"],
    where: { child: { familyId }, date: { gte: dateFromKey(from), lte: dateFromKey(to) } },
    _sum: { minutes: true },
    orderBy: { _sum: { minutes: "desc" } },
  });
}

export async function getAlerts(familyId: string, userId: string, opts: { category?: string; take?: number; includeResolved?: boolean } = {}) {
  const alerts = await db.alert.findMany({
    where: {
      familyId,
      ...(opts.category && opts.category !== "ALL" ? { category: opts.category as never } : {}),
      ...(opts.includeResolved ? {} : { resolvedAt: null }),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
    include: { reads: { where: { userId } } },
  });
  return alerts.map((a) => ({ ...a, read: a.reads.length > 0 }));
}

export async function unreadCount(familyId: string, userId: string) {
  return db.alert.count({
    where: { familyId, resolvedAt: null, severity: { not: "INFO" }, reads: { none: { userId } } },
  });
}
