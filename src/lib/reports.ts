import "server-only";
import { db } from "./db";
import { dateFromKey, dayKey, dayStart } from "./queries";

export type Period = "today" | "7d" | "30d" | "custom";

/** Longest custom range, in days */
export const MAX_RANGE_DAYS = 366;

const DAY = 864e5;
const addDays = (k: string, n: number) => new Date(dateFromKey(k).getTime() + n * DAY).toISOString().slice(0, 10);

export function resolveRange(period: Period, tz: string, from?: string, to?: string) {
  const today = dayKey(new Date(), tz);
  // A real calendar date: "2026-02-30" and "2026-13-45" match the pattern but aren't dates
  const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  if (period === "custom" && valid(from) && valid(to)) {
    // Clamp to today before comparing, so a range that starts in the future is rejected, not inverted
    const end = to! > today ? today : to!;
    if (from! <= end) {
      const earliest = addDays(end, -(MAX_RANGE_DAYS - 1));
      return { from: from! < earliest ? earliest : from!, to: end };
    }
  }
  const n = period === "today" ? 1 : period === "30d" ? 30 : 7;
  return { from: addDays(today, -(n - 1)), to: today };
}

export const daysBetween = (from: string, to: string) => Math.round((dateFromKey(to).getTime() - dateFromKey(from).getTime()) / DAY) + 1;

/**
 * Report for a range of day keys in the family's timezone.
 * `avg` / `prevAvg` compare complete days only: today is still in progress, so counting it as a full day
 * would make every range that ends today look like usage went down. `prevAvg` is null when there's no
 * complete day to compare (the Today view).
 * `maxChanges` caps the change list; leave it out to get every change (the CSV export).
 */
export async function reportData(familyId: string, tz: string, from: string, to: string, opts: { maxChanges?: number } = {}) {
  const f = dateFromKey(from), t = dateFromKey(to);
  const n = daysBetween(from, to);
  const today = dayKey(new Date(), tz);
  const complete = to === today ? n - 1 : n;
  const pf = dateFromKey(addDays(from, -Math.max(complete, 1))), pt = dateFromKey(addDays(from, -1));
  const [screen, prevScreen, apps, changes, children] = await Promise.all([
    db.screenTimeDaily.groupBy({ by: ["childId", "date"], where: { child: { familyId }, date: { gte: f, lte: t } }, _sum: { minutes: true }, orderBy: { date: "asc" } }),
    db.screenTimeDaily.aggregate({ where: { child: { familyId }, date: { gte: pf, lte: pt } }, _sum: { minutes: true } }),
    db.appUsageDaily.groupBy({ by: ["app"], where: { child: { familyId }, date: { gte: f, lte: t }, app: { not: "Others" } }, _sum: { minutes: true }, orderBy: { _sum: { minutes: "desc" } }, take: 8 }),
    // Changes are timestamps, so the range runs from local midnight to local midnight, not UTC
    db.configChange.findMany({ where: { familyId, createdAt: { gte: dayStart(from, tz), lt: dayStart(addDays(to, 1), tz) } }, orderBy: { createdAt: "desc" }, include: { child: true }, take: opts.maxChanges }),
    db.child.findMany({ where: { familyId }, select: { id: true, name: true } }),
  ]);
  const total = screen.reduce((s, r) => s + (r._sum.minutes ?? 0), 0);
  const todayTotal = screen.filter((r) => r.date.toISOString().slice(0, 10) === today).reduce((s, r) => s + (r._sum.minutes ?? 0), 0);
  const prevTotal = prevScreen._sum.minutes ?? 0;
  const avg = complete > 0 ? Math.round((total - (to === today ? todayTotal : 0)) / complete) : total;
  const prevAvg = complete > 0 ? Math.round(prevTotal / complete) : null;
  return { n, complete, screen, total, avg, prevAvg, apps, changes, children };
}
