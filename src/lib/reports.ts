import "server-only";
import { db } from "./db";
import { dateFromKey, dayKey } from "./queries";

export type Period = "today" | "7d" | "30d" | "custom";

export function resolveRange(period: Period, tz: string, from?: string, to?: string) {
  const today = dayKey(new Date(), tz);
  const base = dateFromKey(today).getTime();
  // A real calendar date: "2026-02-30" and "2026-13-45" match the pattern but aren't dates
  const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  if (period === "custom" && valid(from) && valid(to) && from! <= to!) return { from: from!, to: to! > today ? today : to! };
  const n = period === "today" ? 1 : period === "30d" ? 30 : 7;
  return { from: new Date(base - (n - 1) * 864e5).toISOString().slice(0, 10), to: today };
}

export const daysBetween = (from: string, to: string) => Math.round((dateFromKey(to).getTime() - dateFromKey(from).getTime()) / 864e5) + 1;

export async function reportData(familyId: string, from: string, to: string) {
  const f = dateFromKey(from), t = dateFromKey(to);
  const n = daysBetween(from, to);
  const pf = new Date(f.getTime() - n * 864e5), pt = new Date(f.getTime() - 864e5);
  const [screen, prevScreen, apps, changes, children] = await Promise.all([
    db.screenTimeDaily.groupBy({ by: ["childId", "date"], where: { child: { familyId }, date: { gte: f, lte: t } }, _sum: { minutes: true }, orderBy: { date: "asc" } }),
    db.screenTimeDaily.aggregate({ where: { child: { familyId }, date: { gte: pf, lte: pt } }, _sum: { minutes: true } }),
    db.appUsageDaily.groupBy({ by: ["app"], where: { child: { familyId }, date: { gte: f, lte: t }, app: { not: "Others" } }, _sum: { minutes: true }, orderBy: { _sum: { minutes: "desc" } }, take: 8 }),
    db.configChange.findMany({ where: { familyId, createdAt: { gte: f, lt: new Date(t.getTime() + 864e5) } }, orderBy: { createdAt: "desc" }, include: { child: true } }),
    db.child.findMany({ where: { familyId }, select: { id: true, name: true } }),
  ]);
  const total = screen.reduce((s, r) => s + (r._sum.minutes ?? 0), 0);
  const prevTotal = prevScreen._sum.minutes ?? 0;
  return { n, screen, total, prevTotal, apps, changes, children };
}
